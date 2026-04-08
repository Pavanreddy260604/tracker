import axios from 'axios';
import { Groq } from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || '',
});

type ToolSuccess<T> = { status: 'ok' } & T;
type ToolError = { status: 'error'; message: string };
type ToolResult<T> = ToolSuccess<T> | ToolError;

type GitHubTreeItem = {
    path: string;
    type: 'blob' | 'tree';
    url: string;
};

const REPO_FILE_LIMIT = 18;
const TEXT_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|ya?ml|py|go|java|kt|rb|rs|php|css|scss|html|xml|sql|sh)$/i;
const EXCLUDED_PATH_PATTERN = /(^|\/)(node_modules|dist|build|coverage|vendor|\.next|out)\//i;
const MANIFEST_PATTERNS = [
    /^README\.md$/i,
    /package\.json$/i,
    /package-lock\.json$/i,
    /pnpm-lock\.yaml$/i,
    /yarn\.lock$/i,
    /tsconfig.*\.json$/i,
    /vite\.config\./i,
    /next\.config\./i,
    /docker-compose\.ya?ml$/i,
    /Dockerfile$/i,
    /\.env\.example$/i,
];
const ENTRYPOINT_PATTERNS = [
    /(^|\/)(src\/)?index\.(ts|tsx|js|jsx)$/i,
    /(^|\/)(src\/)?main\.(ts|tsx|js|jsx)$/i,
    /(^|\/)(src\/)?app\.(ts|tsx|js|jsx)$/i,
    /(^|\/)(src\/)?server\.(ts|js)$/i,
    /(^|\/)(src\/)?routes?\//i,
];
const CORE_PATTERNS = [
    /(service|controller|route|router|context|hook|store|model|schema|client|provider)\.(ts|tsx|js|jsx)$/i,
    /backend\/src\//i,
    /frontend\/src\//i,
];
const TEST_PATTERNS = [/__tests__\//i, /\.test\./i, /\.spec\./i];

const uniqueByPath = (items: GitHubTreeItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
        if (seen.has(item.path)) return false;
        seen.add(item.path);
        return true;
    });
};

const sortByPath = (items: GitHubTreeItem[]) =>
    [...items].sort((a, b) => a.path.localeCompare(b.path));

const decodeGitHubContent = (content: string) => Buffer.from(content, 'base64').toString('utf8');

const stripHtml = (html: string) => html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractTitle = (html: string, fallback: string) => {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match?.[1]?.replace(/\s+/g, ' ').trim() || fallback;
};

const isAxiosStatus = (error: unknown, statuses: number[]) =>
    axios.isAxiosError(error) && statuses.includes(error.response?.status || 0);

const getGitHubHeaders = () => {
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json'
    };

    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    return headers;
};

const pickFilesForReview = (tree: GitHubTreeItem[]) => {
    const blobs = sortByPath(tree.filter((item) =>
        item.type === 'blob' &&
        !EXCLUDED_PATH_PATTERN.test(item.path) &&
        (TEXT_FILE_PATTERN.test(item.path) || MANIFEST_PATTERNS.some((pattern) => pattern.test(item.path)))
    ));

    const selected: GitHubTreeItem[] = [];
    const appendMatches = (patterns: RegExp[], limit: number) => {
        for (const item of blobs) {
            if (selected.length >= REPO_FILE_LIMIT) break;
            if (selected.some((entry) => entry.path === item.path)) continue;
            if (!patterns.some((pattern) => pattern.test(item.path))) continue;
            selected.push(item);
            if (selected.filter((entry) => patterns.some((pattern) => pattern.test(entry.path))).length >= limit) {
                break;
            }
        }
    };

    appendMatches(MANIFEST_PATTERNS, 6);
    appendMatches(ENTRYPOINT_PATTERNS, 5);
    appendMatches(CORE_PATTERNS, 7);
    appendMatches(TEST_PATTERNS, 4);

    for (const item of blobs) {
        if (selected.length >= REPO_FILE_LIMIT) break;
        if (selected.some((entry) => entry.path === item.path)) continue;
        selected.push(item);
    }

    return uniqueByPath(selected).slice(0, REPO_FILE_LIMIT);
};

export class ChatToolsService {
    public async fetchRepoFile(
        repoUrl: string,
        path: string
    ): Promise<ToolResult<{ content: string; path: string }>> {
        try {
            const parsedUrl = new URL(repoUrl.startsWith('http') ? repoUrl : `https://${repoUrl}`);
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            if (pathParts.length < 2) return { status: 'error', message: 'Invalid GitHub URL' };

            const owner = pathParts[0];
            const repo = pathParts[1].replace(/\.git$/i, '');
            const headers = getGitHubHeaders();

            // First, get default branch if not provided in URL
            const repoInfo = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
            const defaultBranch = repoInfo.data.default_branch || 'main';

            const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${defaultBranch}`;
            try {
                const response = await axios.get(fileUrl, { headers });
                if (response.data.content) {
                    return {
                        status: 'ok',
                        path,
                        content: decodeGitHubContent(response.data.content)
                    };
                }
            } catch (err: any) {
                if (err.response?.status === 404) {
                    // Fuzzy match attempt: Fetch tree and look for closest path
                    console.log(`[ChatTools] 404 on ${path}, attempting fuzzy match...`);
                    const treeResponse = await axios.get(
                        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
                        { headers }
                    );
                    const tree = (treeResponse.data.tree || []) as any[];
                    const cleanPath = path.toLowerCase().replace(/\/$/, '');
                    
                    // Try to find the file that ends with or contains the most similar path
                    const match = tree.find(t => 
                        t.type === 'blob' && 
                        (t.path.toLowerCase().endsWith(cleanPath.split('/').pop() || '') || 
                         t.path.toLowerCase().includes(cleanPath))
                    );

                    if (match) {
                        console.log(`[ChatTools] Fuzzy matched to: ${match.path}`);
                        const fuzzyResponse = await axios.get(match.url, { headers });
                        return {
                            status: 'ok',
                            path: match.path,
                            content: decodeGitHubContent(fuzzyResponse.data.content)
                        };
                    }
                }
                throw err;
            }

            return { status: 'error', message: 'File is too large or not a text file' };
        } catch (error) {
            console.error('[ChatTools] fetchRepoFile failed:', error);
            return { status: 'error', message: `Failed to fetch file: ${path}` };
        }
    }

    public async reviewGitHubRepo(
        repoUrl: string,
        modelRequester: (prompt: string) => Promise<string>,
        onProgress?: (msg: string) => void
    ): Promise<ToolResult<{
        report: string;
        metadata: {
            owner: string;
            repo: string;
            defaultBranch: string;
            fileCount: number;
            structureSize: number;
        };
    }>> {
        let owner = '';
        let repo = '';

        try {
            const parsedUrl = new URL(repoUrl.startsWith('http') ? repoUrl : `https://${repoUrl}`);
            if (!/^(www\.)?github\.com$/i.test(parsedUrl.hostname)) {
                return { status: 'error', message: 'Invalid GitHub URL format.' };
            }

            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            if (pathParts.length < 2) {
                return { status: 'error', message: 'Invalid GitHub URL format.' };
            }

            owner = pathParts[0];
            repo = pathParts[1].replace(/\.git$/i, '');

            const headers = getGitHubHeaders();
            onProgress?.('Fetching repository metadata...');

            const repoInfo = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
            const defaultBranch = repoInfo.data.default_branch || 'main';

            onProgress?.(`Scanning ${defaultBranch} tree...`);
            const treeResponse = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
                { headers }
            );

            const fullTree = (treeResponse.data.tree || []) as GitHubTreeItem[];
            const prioritizedFiles = pickFilesForReview(fullTree);

            if (prioritizedFiles.length === 0) {
                return {
                    status: 'error',
                    message: 'Repository was reachable, but no reviewable text files were found.'
                };
            }

            onProgress?.(`Reading ${prioritizedFiles.length} prioritized files...`);

            // NEW: Batch fetch using GraphQL for 5-10x speedup
            let fileContents: string[] = [];
            try {
                const gqlQuery = `
                    query ($owner: String!, $repo: String!) {
                        repository(owner: $owner, name: $repo) {
                            ${prioritizedFiles.map((item, i) => `
                                f${i}: object(expression: "${defaultBranch}:${item.path}") {
                                    ... on Blob { text }
                                }
                            `).join('\n')}
                        }
                    }
                `;

                const gqlResponse = await axios.post(
                    'https://api.github.com/graphql',
                    { query: gqlQuery, variables: { owner, repo } },
                    { headers }
                );

                const repoData = gqlResponse.data?.data?.repository;
                if (repoData) {
                    fileContents = prioritizedFiles.map((item, i) => {
                        const blob = repoData[`f${i}`];
                        const text = blob?.text || '[Unable to fetch file contents]';
                        return `\n--- File: ${item.path} ---\n${text.slice(0, 2800)}\n`;
                    });
                } else {
                    throw new Error('GraphQL response missing repository data');
                }
            } catch (gqlError) {
                console.error('[ChatTools] GraphQL batch fetch failed, falling back to REST:', gqlError);
                fileContents = await Promise.all(prioritizedFiles.map(async (item) => {
                    try {
                        const fileResponse = await axios.get(item.url, { headers });
                        return `\n--- File: ${item.path} ---\n${decodeGitHubContent(fileResponse.data.content).slice(0, 2800)}\n`;
                    } catch {
                        return `\n--- File: ${item.path} ---\n[Unable to fetch file contents]\n`;
                    }
                }));
            }

            const structurePreview = sortByPath(fullTree)
                .slice(0, 200)
                .map((item) => `${item.type === 'tree' ? 'DIR' : 'FILE'} ${item.path}`)
                .join('\n');

            const prompt = `You are a principal engineer reviewing a GitHub repository.
Use ONLY the evidence below. If evidence is missing, say so directly.

Repository: ${owner}/${repo}
Default branch: ${defaultBranch}

### PRIORITIZED FILE CONTENTS
${fileContents.join('\n').slice(0, 32000)}

### STRUCTURE SNAPSHOT
${structurePreview}

Return Markdown with these sections:
1. ## Verdict
2. ## Severity-Ranked Findings
3. ## Architecture
4. ## Correctness
5. ## Security
6. ## Performance
7. ## Testing
8. ## Maintainability
9. ## Next Actions

Rules:
- Every major finding must cite at least one file path in square brackets, for example [src/app.ts].
- Focus on concrete bugs, reliability risks, missing tests, and architectural issues.
- If the repository cannot be fully assessed from the provided evidence, state the limitation instead of guessing.
- Keep the tone direct and professional.`;

            onProgress?.('Generating repository review...');
            const report = await modelRequester(prompt);

            return {
                status: 'ok',
                report,
                metadata: {
                    owner,
                    repo,
                    defaultBranch,
                    fileCount: prioritizedFiles.length,
                    structureSize: fullTree.length
                }
            };
        } catch (error) {
            console.error('[ChatTools] GitHub review failed:', error);
            if (isAxiosStatus(error, [401, 403, 404])) {
                return {
                    status: 'error',
                    message: `GitHub repository is inaccessible, private, or missing: ${owner}/${repo || 'unknown'}.`
                };
            }
            return { status: 'error', message: `GitHub review failed: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    public async scrapeWebpage(url: string): Promise<ToolResult<{
        url: string;
        title: string;
        content: string;
        length: number;
    }>> {
        try {
            const parsedUrl = new URL(url);
            if (!/^https?:$/i.test(parsedUrl.protocol)) {
                return { status: 'error', message: 'Only http and https URLs are supported.' };
            }

            const response = await axios.get(parsedUrl.toString(), {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                }
            });

            const html = typeof response.data === 'string' ? response.data : String(response.data);
            const content = stripHtml(html).slice(0, 15000);

            return {
                status: 'ok',
                url: parsedUrl.toString(),
                title: extractTitle(html, parsedUrl.toString()),
                content,
                length: content.length
            };
        } catch (error) {
            console.error('[ChatTools] Web scrape failed:', error);
            return { status: 'error', message: `Failed to fetch webpage: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    public async analyzeData(dataChunks: string[], query: string): Promise<ToolResult<{
        analysis: string;
    }>> {
        try {
            const fullData = dataChunks.join('\n').slice(0, 24000);
            const prompt = `You are an expert data analyst working inside a chat assistant.
Use the dataset fragments below to answer the user's request.

Dataset fragments:
${fullData}

User request: ${query}

Requirements:
- Answer in concise Markdown.
- Surface concrete findings, anomalies, comparisons, and caveats.
- Generate chart blocks only when the data clearly supports a trend, distribution, or comparison.
- Every chart block must use exactly this schema:
\`\`\`chart
{
  "type": "bar" | "line" | "area" | "pie",
  "title": "Chart Title",
  "data": [{ "label": "A", "value": 10 }],
  "xAxisKey": "label",
  "dataKey": "value"
}
\`\`\`
- Do not emit legacy keys like pieChart, barChart, slices, or trendInsights.
- If the data is too thin for a chart, skip charts entirely and explain that limitation in plain language.`;

            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.1,
            });

            return {
                status: 'ok',
                analysis: completion.choices[0]?.message?.content || 'Data analysis was unavailable.'
            };
        } catch (error) {
            console.error('[ChatTools] Data analysis failed:', error);
            return { status: 'error', message: `Failed to analyze data: ${error instanceof Error ? error.message : String(error)}` };
        }
    }
}

export const chatToolsService = new ChatToolsService();
