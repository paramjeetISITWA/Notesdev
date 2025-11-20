import { encryptContent, decryptContent } from '@/lib/arweave-utils';
import type { Document, DocumentVersion } from '@/lib/types/document';

export function extractTransactionIdsFromVersion(versionContent: string): string[] {
    try {
        const parsedContent = JSON.parse(versionContent);
        if (parsedContent.previousTransactionId && Array.isArray(parsedContent.previousTransactionId)) {
            return parsedContent.previousTransactionId;
        }
    } catch {
        // ignore parse errors
    }
    return [];
}

export function getAllPreviousTransactionIds(document?: Document | null): string[] {
    if (!document) {
        return [];
    }

    const allTransactionIds: string[] = [];

    for (const version of document.versions) {
        const transactionIds = extractTransactionIdsFromVersion(version.content);
        allTransactionIds.push(...transactionIds);
    }

    if (document.arweaveTransactionId) {
        allTransactionIds.push(document.arweaveTransactionId);
    }

    return [...new Set(allTransactionIds)];
}

function extractContentPreview(content: string): string {
    try {
        const parsed = JSON.parse(content);

        if (parsed && parsed.encrypted === true && typeof parsed.content === 'string') {
            return '[Encrypted content]';
        }

        if (parsed && typeof parsed === 'object' && parsed.data) {
            return parsed.data;
        }

        if (parsed && parsed.type === 'doc' && parsed.content) {
            return extractTextFromEditorContent(parsed.content);
        }

        return content;
    } catch {
        return content;
    }
}

function extractTextFromEditorContent(content: any[]): string {
    let text = '';

    for (const node of content) {
        if (node.type === 'paragraph' && node.content) {
            for (const textNode of node.content) {
                if (textNode.type === 'text') {
                    text += textNode.text + ' ';
                }
            }
        } else if (node.type === 'heading' && node.content) {
            for (const textNode of node.content) {
                if (textNode.type === 'text') {
                    text += textNode.text + ' ';
                }
            }
        }
    }

    return text.trim();
}

export function createDocumentRecord(
    title: string,
    content: string,
    options?: {
        password?: string;
        previousTransactionIds?: string[];
    }
): Document {
    const now = new Date().toISOString();
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    const { password, previousTransactionIds } = options || {};

    const { finalContent, isPasswordProtected } = processContentForStorage(content, password, previousTransactionIds);

    return {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        createdAt: now,
        lastModified: now,
        versions: [{
            versionNumber: 1,
            timestamp: now,
            content: finalContent,
            preview,
            password: isPasswordProtected,
        }],
        currentVersionNumber: 1,
    };
}

export function addDocumentVersionRecord(
    document: Document,
    content: string,
    options?: {
        arweaveTransactionId?: string;
        password?: string;
        previousTransactionIds?: string[];
    }
): Document {
    const now = new Date().toISOString();
    const previewSource = extractContentPreview(content);
    const preview = previewSource.length > 50 ? previewSource.substring(0, 50) + '...' : previewSource;
    const { arweaveTransactionId, password, previousTransactionIds } = options || {};

    const { finalContent, isPasswordProtected } = processContentForStorage(content, password, previousTransactionIds);

    const newVersion: DocumentVersion = {
        versionNumber: document.versions.length + 1,
        timestamp: now,
        content: finalContent,
        preview,
        password: isPasswordProtected,
    };

    const updatedDocument: Document = {
        ...document,
        versions: [newVersion, ...document.versions],
        currentVersionNumber: newVersion.versionNumber,
        lastModified: now,
        arweaveTransactionId: arweaveTransactionId ?? document.arweaveTransactionId,
    };

    return updatedDocument;
}

function processContentForStorage(
    content: string,
    password?: string,
    previousTransactionIds?: string[],
): { finalContent: string; isPasswordProtected: number } {
    let finalContent = content;
    let isPasswordProtected = 0;

    try {
        let contentObj: any;
        try {
            contentObj = JSON.parse(content);
        } catch {
            contentObj = null;
        }

        if (contentObj && contentObj.encrypted === true && contentObj.password === 1) {
            finalContent = content;
            isPasswordProtected = 1;
        } else if (password) {
            if (contentObj) {
                contentObj.password = 1;
                contentObj.passwordProtected = true;
                contentObj.timestamp = new Date().toISOString();
                contentObj.previousTransactionId = previousTransactionIds || [];
                finalContent = encryptContent(JSON.stringify(contentObj), password);
            } else {
                const wrapped = {
                    content,
                    password: 1,
                    passwordProtected: true,
                    timestamp: new Date().toISOString(),
                    previousTransactionId: previousTransactionIds || [],
                };
                finalContent = encryptContent(JSON.stringify(wrapped), password);
            }
            isPasswordProtected = 1;
        } else {
            if (contentObj) {
                contentObj.password = 0;
                contentObj.passwordProtected = false;
                contentObj.timestamp = new Date().toISOString();
                contentObj.previousTransactionId = previousTransactionIds || [];
                finalContent = JSON.stringify(contentObj);
            } else {
                finalContent = JSON.stringify({
                    content,
                    password: 0,
                    passwordProtected: false,
                    timestamp: new Date().toISOString(),
                    previousTransactionId: previousTransactionIds || [],
                });
            }
        }
    } catch (error) {
        console.error('Failed to process content:', error);
        throw new Error('Failed to process content');
    }

    return { finalContent, isPasswordProtected };
}

export function getVersionContent(document: Document, versionNumber: number): string | null {
    const version = document.versions.find(v => v.versionNumber === versionNumber);
    if (!version) {
        return null;
    }

    if (version.password !== 1) {
        try {
            const parsedContent = JSON.parse(version.content);
            if (parsedContent.password !== undefined) {
                const { password, passwordProtected, timestamp, previousTransactionId, ...cleanContent } = parsedContent;
                return JSON.stringify(cleanContent);
            }
        } catch {
            // ignore parse error
        }
    }

    return version.content;
}

export function getVersionContentWithPassword(
    document: Document,
    versionNumber: number,
    password?: string,
): string | null {
    const version = document.versions.find(v => v.versionNumber === versionNumber);
    if (!version) {
        return null;
    }

    if (version.password !== 1) {
        return version.content;
    }

    if (!password) {
        throw new Error('Password required for this version');
    }

    try {
        let versionContentObj: any;
        try {
            versionContentObj = JSON.parse(version.content);
        } catch {
            versionContentObj = null;
        }

        if (versionContentObj && versionContentObj.encrypted === true && versionContentObj.content) {
            const decryptedEditorContent = decryptContent(versionContentObj.content, password);
            return decryptedEditorContent;
        }

        const decryptedContent = decryptContent(version.content, password);
        try {
            const parsedContent = JSON.parse(decryptedContent);
            const { password: pw, passwordProtected, timestamp, previousTransactionId, ...cleanContent } = parsedContent;
            return JSON.stringify(cleanContent);
        } catch {
            return decryptedContent;
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('Failed to decrypt')) {
            throw error;
        }
        throw new Error('Failed to decrypt content. Please check your password.');
    }
}

export function getLatestVersionContent(document: Document): string | null {
    if (!document || document.versions.length === 0) {
        return null;
    }
    return document.versions[0].content;
}

export function getDocumentVersions(document: Document): DocumentVersion[] {
    if (!document) {
        return [];
    }
    return document.versions;
}

export function getCurrentVersionNumber(document: Document): number {
    if (!document) {
        return 0;
    }
    return document.currentVersionNumber;
}

