export interface DocumentVersion {
    versionNumber: number;
    timestamp: string;
    content: string;
    preview: string;
    password?: number;
    title?: string;
}

export interface Document {
    id: string;
    title: string;
    createdAt: string;
    lastModified: string;
    versions: DocumentVersion[];
    currentVersionNumber: number;
    arweaveTransactionId?: string;
}

