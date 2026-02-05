
export interface ScriptTemplates {
    formats: {
        id: string;
        name: string;
        description: string;
    }[];
    styles: {
        id: string;
        name: string;
        description: string;
    }[];
}

export interface ScriptRequest {
    userId: string;
    idea: string;
    format: string;
    style: string;
    language?: string;
    duration?: number;
    genre?: string;
    tone?: string;
}

export interface ScriptHistoryItem {
    _id: string;
    title: string;
    prompt: string;
    format: string;
    style: string;
    status: 'generating' | 'completed' | 'failed' | 'draft';
    createdAt: string;
}


export interface IScriptDetail {
    _id: string;
    content: string;
    title: string;
    metadata: any;
}

// Force HMR update
