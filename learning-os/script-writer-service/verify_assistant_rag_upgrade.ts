import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Bible } from './src/models/Bible';
import { MasterScript } from './src/models/MasterScript';
import { Scene } from './src/models/Scene';
import { VoiceSample } from './src/models/VoiceSample';
import { aiServiceManager } from './src/services/ai.manager';
import { assistantRagService } from './src/services/assistantRag.service';
import { vectorService } from './src/services/vector.service';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os';

async function run() {
    await mongoose.connect(MONGODB_URI);

    const bibleId = new mongoose.Types.ObjectId();
    const sceneId = new mongoose.Types.ObjectId();
    const masterScriptId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId().toString();
    const scriptVersion = `verify-${Date.now()}`;
    const projectSampleId = new mongoose.Types.ObjectId();
    const masterSampleId = new mongoose.Types.ObjectId();

    try {
        const bible = await Bible.create({
            _id: bibleId,
            userId,
            title: 'Verification Project',
            logline: 'A writer tries to outsmart an invisible rival.',
            genre: 'Thriller',
            tone: 'Tense',
            language: 'English',
            visualStyle: 'Noir',
            storySoFar: 'The protagonist knows someone is manipulating events behind the curtain.',
            globalOutline: [
                'A hidden enemy begins pressing the hero from the shadows.',
                'The hero misreads the threat and loses control.',
                'A direct confrontation finally exposes the enemy.'
            ],
            rules: ['Keep tension escalating.']
        });

        const scene = await Scene.create({
            _id: sceneId,
            bibleId,
            sequenceNumber: 3,
            slugline: 'INT. WRITER ROOM - NIGHT',
            summary: 'The writer senses that someone else is inside the room.',
            goal: 'Force the writer to react before they are ready.',
            content: 'INT. WRITER ROOM - NIGHT\nShe studies the silence and realizes the room is listening back.',
            previousSceneSummary: 'The rival hacked the building lights and trapped the writer upstairs.',
            status: 'drafted',
            charactersInvolved: [],
            mentionedItems: []
        });

        await MasterScript.create({
            _id: masterScriptId,
            title: 'Verification Master',
            director: 'Debug Director',
            description: 'Synthetic master script for assistant retrieval verification.',
            language: 'English',
            tags: ['Thriller', 'Noir', 'Tense'],
            rawContent: 'INT. SAFEHOUSE - NIGHT\nHe waits in the dark, listening for the door to betray her.',
            status: 'indexed',
            progress: 100,
            processedChunks: 1,
            activeScriptVersion: scriptVersion,
            sourceFormat: 'raw_text',
            pageCount: 1,
            layoutVersion: 'verify',
            readerReady: true,
            ragReady: true,
            gateStatus: 'passed'
        });

        const projectContent = 'She studies the silence and realizes the room is listening back.';
        const masterContent = 'A tense beat hangs before the intruder steps from the dark and claims the room.';

        const [projectEmbedding, masterEmbedding] = await Promise.all([
            aiServiceManager.generateEmbedding(projectContent),
            aiServiceManager.generateEmbedding(masterContent)
        ]);

        await VoiceSample.create([
            {
                _id: projectSampleId,
                bibleId,
                content: projectContent,
                embedding: projectEmbedding,
                language: 'English',
                chunkType: 'action',
                elementType: 'action',
                tags: ['tense', 'suspense'],
                source: 'Verification Project Voice Sample'
            },
            {
                _id: masterSampleId,
                masterScriptId,
                content: masterContent,
                embedding: masterEmbedding,
                language: 'English',
                chunkType: 'action',
                elementType: 'action',
                tags: ['thriller', 'noir'],
                source: 'Debug Director: Verification Master (Scene 1)',
                scriptVersion,
                chunkId: `verify_${masterScriptId.toString()}_${scriptVersion}_1`,
                sceneSeq: 1,
                elementSeq: 1
            }
        ]);

        await Promise.all([
            vectorService.upsertSample({
                id: projectSampleId.toString(),
                content: projectContent,
                embedding: projectEmbedding,
                metadata: {
                    bibleId: bibleId.toString(),
                    language: 'English',
                    chunkType: 'action',
                    elementType: 'action',
                    isHierarchicalNode: false,
                    tags: ['tense', 'suspense'],
                    source: 'Verification Project Voice Sample'
                }
            }),
            vectorService.upsertSample({
                id: masterSampleId.toString(),
                content: masterContent,
                embedding: masterEmbedding,
                metadata: {
                    masterScriptId: masterScriptId.toString(),
                    language: 'English',
                    chunkType: 'action',
                    elementType: 'action',
                    isHierarchicalNode: false,
                    tags: ['thriller', 'noir'],
                    source: 'Debug Director: Verification Master (Scene 1)',
                    scriptVersion,
                    chunkId: `verify_${masterScriptId.toString()}_${scriptVersion}_1`,
                    sceneSeq: 1,
                    elementSeq: 1
                }
            })
        ]);

        const pack = await assistantRagService.buildAssistantReferencePack({
            instruction: 'Explain how the room listening back and the intruder stepping from the dark make this scene more suspenseful without losing clarity.',
            mode: 'ask',
            target: 'scene',
            language: 'English',
            currentContent: scene.content,
            bible,
            scene,
            selection: null
        });

        assert.ok(pack.promptSections.includes('PROJECT STYLE REFERENCES'), 'Project references section should exist');
        assert.ok(pack.promptSections.includes('MASTER FEED REFERENCES'), 'Master-feed references section should exist');
        assert.ok(pack.retrievalMetadata.sourceMix.project > 0, 'Project retrieval should contribute references');
        assert.ok(pack.retrievalMetadata.sourceMix.master > 0, 'Master-feed retrieval should contribute references');

        console.log('Assistant RAG upgrade verification passed.');
    } finally {
        await Promise.allSettled([
            vectorService.deleteSamplesByBibleId(bibleId.toString()),
            vectorService.deleteSamplesByMasterScriptId(masterScriptId.toString()),
            VoiceSample.deleteMany({ $or: [{ bibleId }, { masterScriptId }] }),
            Scene.deleteMany({ _id: sceneId }),
            MasterScript.deleteMany({ _id: masterScriptId }),
            Bible.deleteMany({ _id: bibleId })
        ]);
        await mongoose.disconnect();
    }
}

void run().catch((error) => {
    console.error('Assistant RAG upgrade verification failed.');
    console.error(error);
    process.exit(1);
});
