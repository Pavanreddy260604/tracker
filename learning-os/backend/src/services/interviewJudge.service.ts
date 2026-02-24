import { ExecutionService } from './execution.service.js';

export type TechnicalQuestionType = 'coding' | 'sql' | 'system-design' | 'behavioral';

export interface JudgeTestCase {
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
    isEdgeCase?: boolean;
}

export interface JudgeTestResult {
    index: number;
    input?: string;
    expected?: string;
    actual?: string;
    passed: boolean;
    error?: string;
    isHidden?: boolean;
    isEdgeCase?: boolean;
}

export interface JudgeSubmitResult {
    status: 'pass' | 'fail';
    score: number;
    feedback: string;
    summary?: { passed: number; total: number };
    testResults?: JudgeTestResult[];
}

export interface JudgeRunResult {
    status: 'success' | 'fail' | 'error';
    summary: { passed: number; total: number };
    feedback?: string;
    testResults: JudgeTestResult[];
}

interface SqlColumn {
    name: string;
    type?: string;
}

interface SqlTable {
    name: string;
    columns: SqlColumn[];
    rows: Array<Record<string, unknown>>;
}

interface SqlCasePayload {
    tables: SqlTable[];
    orderSensitive?: boolean;
}

interface SqlExpectedPayload {
    rows: Array<Record<string, unknown>>;
    orderSensitive?: boolean;
}

interface SystemDesignRubric {
    requiredGroups: string[][];
    minWordCount?: number;
}

interface SqlTemplate {
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    description: string;
    testCases: JudgeTestCase[];
}

interface SystemDesignTemplate {
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    description: string;
    testCases: JudgeTestCase[];
}

const SQL_RESULT_MARKER = '__SQL_RESULT__';

const SQL_QUESTION_BANK: SqlTemplate[] = [
    {
        title: 'Completed Revenue By Active Customer',
        difficulty: 'medium',
        description: [
            'Given `customers(id, name, is_active)` and `orders(id, customer_id, amount, status)`,',
            'write a SQL query that returns `name` and `total_amount` for active customers only,',
            'counting only completed orders. Sort by `total_amount` descending.',
        ].join(' '),
        testCases: [
            {
                input: JSON.stringify({
                    orderSensitive: true,
                    tables: [
                        {
                            name: 'customers',
                            columns: [
                                { name: 'id', type: 'INTEGER' },
                                { name: 'name', type: 'TEXT' },
                                { name: 'is_active', type: 'INTEGER' },
                            ],
                            rows: [
                                { id: 1, name: 'Alice', is_active: 1 },
                                { id: 2, name: 'Bob', is_active: 1 },
                                { id: 3, name: 'Carol', is_active: 0 },
                            ],
                        },
                        {
                            name: 'orders',
                            columns: [
                                { name: 'id', type: 'INTEGER' },
                                { name: 'customer_id', type: 'INTEGER' },
                                { name: 'amount', type: 'INTEGER' },
                                { name: 'status', type: 'TEXT' },
                            ],
                            rows: [
                                { id: 1, customer_id: 1, amount: 120, status: 'completed' },
                                { id: 2, customer_id: 1, amount: 20, status: 'cancelled' },
                                { id: 3, customer_id: 2, amount: 75, status: 'completed' },
                                { id: 4, customer_id: 2, amount: 25, status: 'completed' },
                                { id: 5, customer_id: 3, amount: 200, status: 'completed' },
                            ],
                        },
                    ],
                }),
                expectedOutput: JSON.stringify({
                    orderSensitive: true,
                    rows: [
                        { name: 'Alice', total_amount: 120 },
                        { name: 'Bob', total_amount: 100 },
                    ],
                }),
                isHidden: false,
            },
            {
                input: JSON.stringify({
                    orderSensitive: true,
                    tables: [
                        {
                            name: 'customers',
                            columns: [
                                { name: 'id', type: 'INTEGER' },
                                { name: 'name', type: 'TEXT' },
                                { name: 'is_active', type: 'INTEGER' },
                            ],
                            rows: [
                                { id: 10, name: 'Nora', is_active: 1 },
                                { id: 11, name: 'Omar', is_active: 1 },
                                { id: 12, name: 'Pia', is_active: 1 },
                            ],
                        },
                        {
                            name: 'orders',
                            columns: [
                                { name: 'id', type: 'INTEGER' },
                                { name: 'customer_id', type: 'INTEGER' },
                                { name: 'amount', type: 'INTEGER' },
                                { name: 'status', type: 'TEXT' },
                            ],
                            rows: [
                                { id: 1, customer_id: 10, amount: 40, status: 'completed' },
                                { id: 2, customer_id: 10, amount: 10, status: 'completed' },
                                { id: 3, customer_id: 11, amount: 70, status: 'cancelled' },
                                { id: 4, customer_id: 12, amount: 33, status: 'completed' },
                            ],
                        },
                    ],
                }),
                expectedOutput: JSON.stringify({
                    orderSensitive: true,
                    rows: [
                        { name: 'Nora', total_amount: 50 },
                        { name: 'Pia', total_amount: 33 },
                        { name: 'Omar', total_amount: 0 },
                    ],
                }),
                isHidden: true,
                isEdgeCase: true,
            },
        ],
    },
    {
        title: 'Monthly User Signups',
        difficulty: 'easy',
        description: [
            'Given `users(id, created_at)` where `created_at` is in `YYYY-MM-DD` format,',
            'write a SQL query that returns each signup month as `month` (`YYYY-MM`) and the number',
            'of signups in that month as `new_users`, ordered by month ascending.',
        ].join(' '),
        testCases: [
            {
                input: JSON.stringify({
                    orderSensitive: true,
                    tables: [
                        {
                            name: 'users',
                            columns: [
                                { name: 'id', type: 'INTEGER' },
                                { name: 'created_at', type: 'TEXT' },
                            ],
                            rows: [
                                { id: 1, created_at: '2025-01-02' },
                                { id: 2, created_at: '2025-01-10' },
                                { id: 3, created_at: '2025-02-05' },
                                { id: 4, created_at: '2025-02-20' },
                                { id: 5, created_at: '2025-02-28' },
                            ],
                        },
                    ],
                }),
                expectedOutput: JSON.stringify({
                    orderSensitive: true,
                    rows: [
                        { month: '2025-01', new_users: 2 },
                        { month: '2025-02', new_users: 3 },
                    ],
                }),
                isHidden: false,
            },
        ],
    },
];

const SYSTEM_DESIGN_QUESTION_BANK: SystemDesignTemplate[] = [
    {
        title: 'Design a URL Shortener',
        difficulty: 'medium',
        description: [
            'Design a URL shortener service that supports high read traffic, custom aliases,',
            'and analytics. Provide API design, data model, scaling strategy, caching, and',
            'failure-handling choices.',
        ].join(' '),
        testCases: [
            {
                input: JSON.stringify({
                    minWordCount: 80,
                    requiredGroups: [
                        ['api', 'endpoint', 'http'],
                        ['database', 'storage'],
                        ['cache', 'redis', 'memory'],
                        ['unique id', 'id generator', 'hash'],
                        ['scal', 'shard', 'partition', 'replica'],
                        ['rate limit', 'throttle'],
                        ['availability', 'failover', 'redundan'],
                    ],
                } satisfies SystemDesignRubric),
                expectedOutput: '{}',
                isHidden: false,
            },
        ],
    },
    {
        title: 'Design a Notification Delivery Service',
        difficulty: 'hard',
        description: [
            'Design a multi-channel notification system (email, SMS, push) with retry policies,',
            'deduplication, and delivery guarantees. Explain architecture and operational trade-offs.',
        ].join(' '),
        testCases: [
            {
                input: JSON.stringify({
                    minWordCount: 100,
                    requiredGroups: [
                        ['queue', 'message broker', 'kafka', 'sqs', 'pub/sub'],
                        ['worker', 'consumer', 'processor'],
                        ['retry', 'backoff', 'dead-letter', 'dlq'],
                        ['idempot', 'dedup'],
                        ['monitor', 'metric', 'alert', 'observability'],
                        ['scale', 'partition', 'throughput'],
                    ],
                } satisfies SystemDesignRubric),
                expectedOutput: '{}',
                isHidden: false,
            },
        ],
    },
];

export const getSqlQuestionTemplate = (difficulty: 'easy' | 'medium' | 'hard' = 'medium') => {
    const exact = SQL_QUESTION_BANK.filter((q) => q.difficulty === difficulty);
    const pool = exact.length > 0 ? exact : SQL_QUESTION_BANK;
    return pool[Math.floor(Math.random() * pool.length)];
};

export const getSystemDesignQuestionTemplate = (difficulty: 'easy' | 'medium' | 'hard' = 'medium') => {
    const exact = SYSTEM_DESIGN_QUESTION_BANK.filter((q) => q.difficulty === difficulty);
    const pool = exact.length > 0 ? exact : SYSTEM_DESIGN_QUESTION_BANK;
    return pool[Math.floor(Math.random() * pool.length)];
};

export class InterviewJudgeService {
    private readonly execution = new ExecutionService();

    private normalizeQuestionType(questionType: TechnicalQuestionType): 'coding' | 'sql' | 'system-design' {
        if (questionType === 'behavioral') {
            return 'system-design';
        }
        return questionType;
    }

    private normalizeRuntimeLanguage(language?: string): string {
        const allowed = new Set(['javascript', 'python', 'java', 'cpp', 'go']);
        const normalized = typeof language === 'string' ? language.toLowerCase() : 'javascript';
        return allowed.has(normalized) ? normalized : 'javascript';
    }

    private getVisibleCases(testCases: JudgeTestCase[], includeHidden: boolean): JudgeTestCase[] {
        if (includeHidden) return testCases;
        return testCases.filter((tc) => !tc.isHidden);
    }

    async evaluateSubmission(params: {
        questionType: TechnicalQuestionType;
        language?: string;
        code?: string;
        answer?: string;
        testCases: JudgeTestCase[];
    }): Promise<JudgeSubmitResult> {
        const normalizedType = this.normalizeQuestionType(params.questionType);
        if (normalizedType === 'coding') {
            return this.evaluateCoding(params.code || '', this.normalizeRuntimeLanguage(params.language), params.testCases);
        }
        if (normalizedType === 'sql') {
            return this.evaluateSql(params.code || '', params.testCases);
        }
        return this.evaluateSystemDesign(params.answer || '', params.testCases);
    }

    async runSubmission(params: {
        questionType: TechnicalQuestionType;
        language?: string;
        code?: string;
        answer?: string;
        testCases: JudgeTestCase[];
        customInput?: string;
    }): Promise<JudgeRunResult> {
        const normalizedType = this.normalizeQuestionType(params.questionType);
        if (normalizedType === 'coding') {
            return this.runCoding(
                params.code || '',
                this.normalizeRuntimeLanguage(params.language),
                params.testCases,
                params.customInput
            );
        }
        if (normalizedType === 'sql') {
            return this.runSql(params.code || '', params.testCases, params.customInput);
        }
        return this.runSystemDesign(params.answer || '', params.testCases);
    }

    private async evaluateCoding(code: string, language: string, testCases: JudgeTestCase[]): Promise<JudgeSubmitResult> {
        const runnableCases = this.getVisibleCases(testCases, true);
        if (!code.trim()) {
            return {
                status: 'fail',
                score: 0,
                feedback: 'Compilation failed: empty submission.',
                summary: { passed: 0, total: runnableCases.length },
                testResults: [],
            };
        }
        if (runnableCases.length === 0) {
            return {
                status: 'fail',
                score: 0,
                feedback: 'No technical test cases are configured for this question.',
                summary: { passed: 0, total: 0 },
                testResults: [],
            };
        }

        const testResults: JudgeTestResult[] = [];
        let passedCount = 0;
        let errorCount = 0;

        for (const [index, testCase] of runnableCases.entries()) {
            const result = await this.execution.runTest(language, code, {
                input: testCase.input,
                expected: testCase.expectedOutput,
            });
            if (result.passed) passedCount += 1;
            if (result.error) errorCount += 1;
            testResults.push({
                index,
                input: testCase.input,
                expected: testCase.expectedOutput,
                actual: result.actual,
                passed: result.passed,
                error: result.error,
                isHidden: testCase.isHidden,
                isEdgeCase: testCase.isEdgeCase,
            });
        }

        const total = runnableCases.length;
        const score = total > 0 ? Math.round((passedCount / total) * 100) : 0;
        const status: 'pass' | 'fail' = passedCount === total ? 'pass' : 'fail';
        const firstError = testResults.find((r) => r.error)?.error;
        const feedbackParts = [
            `Compilation: ${errorCount > 0 ? 'failed on one or more test cases' : 'passed'}.`,
            `Technical correctness: ${passedCount}/${total} test cases passed.`,
        ];
        if (firstError) {
            feedbackParts.push(`First runtime/compiler error: ${firstError}`);
        }

        return {
            status,
            score,
            feedback: feedbackParts.join(' '),
            summary: { passed: passedCount, total },
            testResults,
        };
    }

    private async runCoding(
        code: string,
        language: string,
        testCases: JudgeTestCase[],
        customInput?: string
    ): Promise<JudgeRunResult> {
        if (!code.trim()) {
            return {
                status: 'error',
                feedback: 'Compilation failed: empty submission.',
                summary: { passed: 0, total: 0 },
                testResults: [],
            };
        }

        if (typeof customInput === 'string' && customInput.length > 0) {
            const runResult = await this.execution.executeWithInput(language, code, customInput);
            return {
                status: runResult.error ? 'error' : 'success',
                summary: { passed: runResult.error ? 0 : 1, total: 1 },
                testResults: [
                    {
                        index: 0,
                        input: customInput,
                        actual: runResult.actual,
                        passed: !runResult.error,
                        error: runResult.error,
                    },
                ],
                feedback: runResult.error ? `Compilation/runtime failed: ${runResult.error}` : undefined,
            };
        }

        const runnableCases = this.getVisibleCases(testCases, false);
        if (runnableCases.length === 0) {
            return {
                status: 'success',
                summary: { passed: 0, total: 0 },
                testResults: [],
            };
        }

        const testResults: JudgeTestResult[] = [];
        let passedCount = 0;
        let errorCount = 0;

        for (const [index, testCase] of runnableCases.entries()) {
            const result = await this.execution.runTest(language, code, {
                input: testCase.input,
                expected: testCase.expectedOutput,
            });
            if (result.passed) passedCount += 1;
            if (result.error) errorCount += 1;
            testResults.push({
                index,
                input: testCase.input,
                expected: testCase.expectedOutput,
                actual: result.actual,
                passed: result.passed,
                error: result.error,
                isHidden: testCase.isHidden,
                isEdgeCase: testCase.isEdgeCase,
            });
        }

        return {
            status: errorCount > 0 ? 'error' : passedCount === runnableCases.length ? 'success' : 'fail',
            summary: { passed: passedCount, total: runnableCases.length },
            testResults,
        };
    }

    private parseJson<T>(value: string): T | null {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }

    private stableStringify(value: unknown): string {
        if (value === null || value === undefined) return String(value);
        if (typeof value !== 'object') return JSON.stringify(value);
        if (Array.isArray(value)) {
            return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
        }
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        const entries = keys.map((key) => `${JSON.stringify(key)}:${this.stableStringify(obj[key])}`);
        return `{${entries.join(',')}}`;
    }

    private deepEqual(a: unknown, b: unknown): boolean {
        return this.stableStringify(a) === this.stableStringify(b);
    }

    private validateSqlQuery(query: string): { ok: boolean; error?: string } {
        const trimmed = query.trim();
        if (!trimmed) {
            return { ok: false, error: 'Compilation failed: empty SQL query.' };
        }
        const lower = trimmed.toLowerCase();
        if (!lower.startsWith('select') && !lower.startsWith('with')) {
            return { ok: false, error: 'Compilation failed: only SELECT/CTE queries are allowed.' };
        }
        if (/(insert|update|delete|drop|alter|truncate)\b/i.test(lower)) {
            return { ok: false, error: 'Compilation failed: mutating SQL statements are not allowed.' };
        }
        const statementCount = trimmed
            .split(';')
            .map((part) => part.trim())
            .filter((part) => part.length > 0).length;
        if (statementCount > 1) {
            return { ok: false, error: 'Compilation failed: only one SQL statement is allowed.' };
        }
        return { ok: true };
    }

    private normalizeSqlRows(rows: Array<Record<string, unknown>>, orderSensitive: boolean): Array<Record<string, unknown>> {
        if (orderSensitive) return rows;
        return [...rows].sort((a, b) => this.stableStringify(a).localeCompare(this.stableStringify(b)));
    }

    private parseSqlPayload(testCase: JudgeTestCase): SqlCasePayload | null {
        const parsed = this.parseJson<SqlCasePayload>(testCase.input);
        if (!parsed || !Array.isArray(parsed.tables)) return null;
        return {
            tables: parsed.tables,
            orderSensitive: parsed.orderSensitive ?? false,
        };
    }

    private parseSqlExpected(testCase: JudgeTestCase): { rows: Array<Record<string, unknown>>; orderSensitive: boolean } | null {
        const parsed = this.parseJson<SqlExpectedPayload | Array<Record<string, unknown>>>(testCase.expectedOutput);
        if (!parsed) return null;
        if (Array.isArray(parsed)) {
            return { rows: parsed, orderSensitive: false };
        }
        if (!Array.isArray(parsed.rows)) return null;
        return {
            rows: parsed.rows,
            orderSensitive: parsed.orderSensitive ?? false,
        };
    }

    private buildSqlExecutionScript(query: string, payload: SqlCasePayload): string {
        const payloadJson = JSON.stringify(payload);
        const payloadLiteral = JSON.stringify(payloadJson);
        const queryLiteral = JSON.stringify(query);
        return `
import json
import sqlite3

payload = json.loads(${payloadLiteral})
query = ${queryLiteral}

conn = sqlite3.connect(':memory:')
cursor = conn.cursor()

for table in payload.get('tables', []):
    table_name = table.get('name')
    columns = table.get('columns', [])
    if not table_name or not columns:
        continue

    column_defs = []
    column_names = []
    for col in columns:
        col_name = col.get('name')
        col_type = col.get('type', 'TEXT')
        column_defs.append(f'"{col_name}" {col_type}')
        column_names.append(col_name)

    create_sql = f'CREATE TABLE "{table_name}" (' + ', '.join(column_defs) + ')'
    cursor.execute(create_sql)

    rows = table.get('rows', [])
    if rows:
        placeholders = ', '.join(['?'] * len(column_names))
        quoted_columns = ', '.join([f'"{col}"' for col in column_names])
        insert_sql = f'INSERT INTO "{table_name}" (' + quoted_columns + ') VALUES (' + placeholders + ')'
        values = []
        for row in rows:
            values.append([row.get(col) for col in column_names])
        cursor.executemany(insert_sql, values)

conn.commit()
cursor.execute(query)
columns = [desc[0] for desc in cursor.description] if cursor.description else []
rows = cursor.fetchall()
result_rows = []
for row in rows:
    item = {}
    for idx, col_name in enumerate(columns):
        item[col_name] = row[idx]
    result_rows.append(item)

print('${SQL_RESULT_MARKER}' + json.dumps({'rows': result_rows, 'columns': columns}, sort_keys=True, default=str))
`;
    }

    private extractSqlResult(stdout: string): { rows: Array<Record<string, unknown>>; columns: string[] } | null {
        const lines = stdout.split(/\r?\n/);
        for (let i = lines.length - 1; i >= 0; i -= 1) {
            const line = lines[i];
            if (line.startsWith(SQL_RESULT_MARKER)) {
                const parsed = this.parseJson<{ rows: Array<Record<string, unknown>>; columns: string[] }>(
                    line.slice(SQL_RESULT_MARKER.length)
                );
                if (parsed) return parsed;
            }
        }
        return null;
    }

    private async executeSqlCase(query: string, payload: SqlCasePayload): Promise<{
        rows?: Array<Record<string, unknown>>;
        columns?: string[];
        error?: string;
    }> {
        const script = this.buildSqlExecutionScript(query, payload);
        const result = await this.execution.execute('python', script);
        if (result.run.code !== 0) {
            return {
                error: result.run.stderr || result.run.output || 'SQL execution failed.',
            };
        }
        const parsed = this.extractSqlResult(result.run.stdout || '');
        if (!parsed) {
            return { error: 'SQL execution failed: result payload missing.' };
        }
        return parsed;
    }

    private async evaluateSql(query: string, testCases: JudgeTestCase[]): Promise<JudgeSubmitResult> {
        const validation = this.validateSqlQuery(query);
        if (!validation.ok) {
            return {
                status: 'fail',
                score: 0,
                feedback: validation.error || 'Compilation failed.',
                summary: { passed: 0, total: 0 },
                testResults: [],
            };
        }

        const runnableCases = this.getVisibleCases(testCases, true);
        if (runnableCases.length === 0) {
            return {
                status: 'fail',
                score: 0,
                feedback: 'No SQL judge datasets are configured for this question.',
                summary: { passed: 0, total: 0 },
                testResults: [],
            };
        }

        const results: JudgeTestResult[] = [];
        let passed = 0;

        for (const [index, testCase] of runnableCases.entries()) {
            const payload = this.parseSqlPayload(testCase);
            const expected = this.parseSqlExpected(testCase);
            if (!payload || !expected) {
                results.push({
                    index,
                    passed: false,
                    error: 'Invalid SQL judge test configuration.',
                    isHidden: testCase.isHidden,
                    isEdgeCase: testCase.isEdgeCase,
                });
                continue;
            }

            const execution = await this.executeSqlCase(query, payload);
            if (execution.error || !execution.rows) {
                results.push({
                    index,
                    passed: false,
                    error: execution.error || 'SQL execution failed.',
                    isHidden: testCase.isHidden,
                    isEdgeCase: testCase.isEdgeCase,
                });
                continue;
            }

            const orderSensitive = expected.orderSensitive || payload.orderSensitive || false;
            const actualRows = this.normalizeSqlRows(execution.rows, orderSensitive);
            const expectedRows = this.normalizeSqlRows(expected.rows, orderSensitive);
            const casePassed = this.deepEqual(actualRows, expectedRows);
            if (casePassed) passed += 1;

            results.push({
                index,
                input: `SQL dataset #${index + 1}`,
                expected: this.stableStringify(expectedRows),
                actual: this.stableStringify(actualRows),
                passed: casePassed,
                error: casePassed ? undefined : 'Query result does not match expected output.',
                isHidden: testCase.isHidden,
                isEdgeCase: testCase.isEdgeCase,
            });
        }

        const total = runnableCases.length;
        const score = total > 0 ? Math.round((passed / total) * 100) : 0;
        const status: 'pass' | 'fail' = passed === total ? 'pass' : 'fail';
        return {
            status,
            score,
            feedback: `SQL compilation passed. Technical correctness: ${passed}/${total} datasets matched expected results.`,
            summary: { passed, total },
            testResults: results,
        };
    }

    private async runSql(query: string, testCases: JudgeTestCase[], customInput?: string): Promise<JudgeRunResult> {
        const validation = this.validateSqlQuery(query);
        if (!validation.ok) {
            return {
                status: 'error',
                feedback: validation.error || 'Compilation failed.',
                summary: { passed: 0, total: 0 },
                testResults: [],
            };
        }

        let payload: SqlCasePayload | null = null;
        if (typeof customInput === 'string' && customInput.trim().length > 0) {
            payload = this.parseJson<SqlCasePayload>(customInput);
        }
        if (!payload) {
            const firstCase = this.getVisibleCases(testCases, false)[0];
            payload = firstCase ? this.parseSqlPayload(firstCase) : null;
        }

        if (!payload) {
            return {
                status: 'error',
                feedback: 'No SQL dataset available for execution.',
                summary: { passed: 0, total: 0 },
                testResults: [],
            };
        }

        const execution = await this.executeSqlCase(query, payload);
        if (execution.error || !execution.rows) {
            return {
                status: 'error',
                feedback: execution.error || 'SQL execution failed.',
                summary: { passed: 0, total: 1 },
                testResults: [
                    {
                        index: 0,
                        passed: false,
                        error: execution.error || 'SQL execution failed.',
                        input: 'SQL run dataset',
                    },
                ],
            };
        }

        return {
            status: 'success',
            summary: { passed: 1, total: 1 },
            testResults: [
                {
                    index: 0,
                    passed: true,
                    input: 'SQL run dataset',
                    actual: this.stableStringify(execution.rows),
                },
            ],
        };
    }

    private parseSystemDesignRubric(testCases: JudgeTestCase[]): SystemDesignRubric {
        for (const testCase of testCases) {
            const parsed = this.parseJson<SystemDesignRubric>(testCase.input);
            if (parsed && Array.isArray(parsed.requiredGroups)) {
                return {
                    requiredGroups: parsed.requiredGroups.map((group) => group.map((token) => token.toLowerCase())),
                    minWordCount: parsed.minWordCount,
                };
            }
        }
        return {
            minWordCount: 60,
            requiredGroups: [
                ['api', 'endpoint'],
                ['database', 'storage'],
                ['cache'],
                ['scale', 'scalability', 'partition'],
                ['failure', 'availability', 'replica'],
            ],
        };
    }

    private evaluateSystemDesign(answer: string, testCases: JudgeTestCase[]): JudgeSubmitResult {
        const normalized = answer.trim().toLowerCase();
        if (!normalized) {
            return {
                status: 'fail',
                score: 0,
                feedback: 'Technical evaluation failed: no system design response submitted.',
                summary: { passed: 0, total: 0 },
                testResults: [],
            };
        }

        const rubric = this.parseSystemDesignRubric(testCases);
        const words = normalized.split(/\s+/).filter(Boolean).length;
        const results: JudgeTestResult[] = [];
        let passed = 0;
        let index = 0;

        if (rubric.minWordCount) {
            const ok = words >= rubric.minWordCount;
            if (ok) passed += 1;
            results.push({
                index,
                passed: ok,
                input: 'Minimum detail check',
                expected: `${rubric.minWordCount} words`,
                actual: `${words} words`,
                error: ok ? undefined : 'Insufficient technical depth in response.',
            });
            index += 1;
        }

        for (const group of rubric.requiredGroups) {
            const ok = group.some((token) => normalized.includes(token));
            if (ok) passed += 1;
            results.push({
                index,
                passed: ok,
                input: 'Required architecture component',
                expected: group.join(' OR '),
                actual: ok ? 'present' : 'missing',
                error: ok ? undefined : `Missing required technical component: ${group[0]}`,
            });
            index += 1;
        }

        const total = results.length;
        const score = total > 0 ? Math.round((passed / total) * 100) : 0;
        const status: 'pass' | 'fail' = score >= 70 ? 'pass' : 'fail';
        return {
            status,
            score,
            feedback: `Technical design checks passed ${passed}/${total}.`,
            summary: { passed, total },
            testResults: results,
        };
    }

    private runSystemDesign(answer: string, testCases: JudgeTestCase[]): JudgeRunResult {
        const result = this.evaluateSystemDesign(answer, testCases);
        return {
            status: result.status === 'pass' ? 'success' : 'fail',
            feedback: result.feedback,
            summary: result.summary || { passed: 0, total: 0 },
            testResults: result.testResults || [],
        };
    }
}
