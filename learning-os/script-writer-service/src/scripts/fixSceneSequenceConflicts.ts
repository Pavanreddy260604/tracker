import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Scene } from '../models/Scene';

dotenv.config();

type DuplicateGroup = {
    _id: {
        bibleId: mongoose.Types.ObjectId;
        sequenceNumber: number;
    };
    ids: mongoose.Types.ObjectId[];
    count: number;
};

type BibleMaxRow = {
    _id: mongoose.Types.ObjectId;
    maxSequenceNumber: number;
};

type PlannedMove = {
    sceneId: mongoose.Types.ObjectId;
    bibleId: string;
    fromSequence: number;
    toSequence: number;
};

function parseArgs() {
    const args = process.argv.slice(2);
    return {
        apply: args.includes('--apply'),
        verbose: args.includes('--verbose')
    };
}

async function connect(): Promise<void> {
    const mongoUri = process.env.SCRIPT_WRITER_MONGODB_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('Missing DB URI. Set SCRIPT_WRITER_MONGODB_URI or MONGODB_URI.');
    }
    await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000
    });
}

async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
    return Scene.aggregate<DuplicateGroup>([
        {
            $group: {
                _id: {
                    bibleId: '$bibleId',
                    sequenceNumber: '$sequenceNumber'
                },
                ids: { $push: '$_id' },
                count: { $sum: 1 }
            }
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { '_id.bibleId': 1, '_id.sequenceNumber': 1 } }
    ]);
}

async function buildBibleMaxMap(): Promise<Map<string, number>> {
    const rows = await Scene.aggregate<BibleMaxRow>([
        {
            $group: {
                _id: '$bibleId',
                maxSequenceNumber: { $max: '$sequenceNumber' }
            }
        }
    ]);

    const map = new Map<string, number>();
    for (const row of rows) {
        map.set(row._id.toString(), row.maxSequenceNumber || 0);
    }
    return map;
}

async function planMoves(
    duplicateGroups: DuplicateGroup[],
    bibleMaxMap: Map<string, number>,
    verbose: boolean
): Promise<PlannedMove[]> {
    const planned: PlannedMove[] = [];

    for (const group of duplicateGroups) {
        const bibleId = group._id.bibleId.toString();
        const docs = await Scene.find({ _id: { $in: group.ids } })
            .select('_id createdAt sequenceNumber')
            .sort({ createdAt: 1, _id: 1 })
            .lean();

        if (docs.length <= 1) continue;

        let currentMax = bibleMaxMap.get(bibleId) ?? 0;

        // Keep the oldest scene at the original sequence number.
        for (let i = 1; i < docs.length; i += 1) {
            const scene = docs[i];
            currentMax += 1;
            planned.push({
                sceneId: scene._id as mongoose.Types.ObjectId,
                bibleId,
                fromSequence: scene.sequenceNumber,
                toSequence: currentMax
            });
        }

        bibleMaxMap.set(bibleId, currentMax);

        if (verbose) {
            console.log(
                `[Planner] bible=${bibleId} seq=${group._id.sequenceNumber} duplicates=${docs.length} moved=${docs.length - 1}`
            );
        }
    }

    return planned;
}

async function applyMoves(moves: PlannedMove[]): Promise<void> {
    if (moves.length === 0) return;

    const ops = moves.map((move) => ({
        updateOne: {
            filter: { _id: move.sceneId },
            update: { $set: { sequenceNumber: move.toSequence } }
        }
    }));

    await Scene.bulkWrite(ops, { ordered: true });
}

async function ensureUniqueIndex(apply: boolean): Promise<void> {
    const collection = Scene.collection;
    const indexes = await collection.indexes();
    const target = indexes.find(
        (idx) => idx.key?.bibleId === 1 && idx.key?.sequenceNumber === 1
    );

    if (target?.unique) {
        console.log('[Index] Unique index already present on { bibleId: 1, sequenceNumber: 1 }');
        return;
    }

    if (!apply) {
        if (target) {
            console.log(`[Index][DRY-RUN] Would drop non-unique index: ${target.name}`);
        }
        console.log('[Index][DRY-RUN] Would create unique index: { bibleId: 1, sequenceNumber: 1 }');
        return;
    }

    if (target) {
        const indexName = target.name || 'bibleId_1_sequenceNumber_1';
        await collection.dropIndex(indexName);
        console.log(`[Index] Dropped non-unique index: ${indexName}`);
    }

    await collection.createIndex(
        { bibleId: 1, sequenceNumber: 1 },
        { unique: true, name: 'bibleId_1_sequenceNumber_1' }
    );
    console.log('[Index] Created unique index: bibleId_1_sequenceNumber_1');
}

async function verifyNoDuplicates(): Promise<void> {
    const remaining = await findDuplicateGroups();
    if (remaining.length > 0) {
        throw new Error(`Duplicate scene sequences still exist: ${remaining.length} groups remaining`);
    }
}

async function main() {
    const { apply, verbose } = parseArgs();

    console.log(`[SceneSeqFix] Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
    await connect();

    try {
        const duplicateGroups = await findDuplicateGroups();
        console.log(`[SceneSeqFix] Duplicate groups found: ${duplicateGroups.length}`);

        const bibleMaxMap = await buildBibleMaxMap();
        const plannedMoves = await planMoves(duplicateGroups, bibleMaxMap, verbose);
        console.log(`[SceneSeqFix] Planned scene moves: ${plannedMoves.length}`);

        if (!apply) {
            console.log('[SceneSeqFix] Dry-run complete. Re-run with --apply to execute.');
            await ensureUniqueIndex(false);
            return;
        }

        await applyMoves(plannedMoves);
        console.log('[SceneSeqFix] Sequence repair applied.');

        await verifyNoDuplicates();
        console.log('[SceneSeqFix] Duplicate verification passed.');

        await ensureUniqueIndex(true);
        console.log('[SceneSeqFix] Done.');
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error('[SceneSeqFix] Failed:', error);
    process.exit(1);
});
