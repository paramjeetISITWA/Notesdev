import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import CryptoJS from 'crypto-js';

export interface WalletInfo {
    address: string;
    key: any;
}

export interface UploadResult {
    transactionId: string;
    success: boolean;
    error?: string;
}

export interface LoadResult {
    content: string;
    success: boolean;
    error?: string;
    fromRedis?: boolean;
    published?: boolean;
}

export interface DocumentVersion {
    versionNumber: number;
    timestamp: string;
    content: string;
    preview: string;
    password?: number; // 1 = password protected, 0 = no password (optional for backward compatibility)
    title?: string; // Optional version title
}

export interface Document {
    id: string;
    title: string;
    createdAt: string;
    lastModified: string;
    versions: DocumentVersion[];
    currentVersionNumber: number;
    arweaveTransactionId?: string; // Single transaction ID for the entire document
}

/**
 * Generate a new Solana wallet keypair for Bundlr
 */
export async function generateSolanaWallet(): Promise<WalletInfo> {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();

    // Store the wallet in localStorage
    const walletData = {
        address,
        privateKey: bs58.encode(keypair.secretKey),
    };
    localStorage.setItem('solana_wallet', JSON.stringify(walletData));

    return {
        address,
        key: keypair.secretKey,
    };
}

/**
 * Load Solana wallet from localStorage or generate a new one
 */
export async function loadOrCreateSolanaWallet(): Promise<WalletInfo> {
    const storedWallet = localStorage.getItem('solana_wallet');

    if (storedWallet) {
        try {
            const wallet = JSON.parse(storedWallet);
            const secretKey = bs58.decode(wallet.privateKey);
            return {
                address: wallet.address,
                key: secretKey,
            };
        } catch (error) {
            console.error('Error parsing stored Solana wallet:', error);
        }
    }

    // Generate new wallet if none exists or parsing failed
    return await generateSolanaWallet();
}


/**
 * Upload content to Arweave using API route (server-side approach)
 */
export async function uploadToArweave(content: string, documentId?: string): Promise<UploadResult> {
    try {
        console.log('Uploading content via API...');

        // Get the private key from localStorage
        const storedWallet = localStorage.getItem('solana_wallet');
        if (!storedWallet) {
            return {
                transactionId: '',
                success: false,
                error: 'No wallet found. Please generate a wallet first.',
            };
        }

        const wallet = JSON.parse(storedWallet);
        const privateKey = wallet.privateKey;

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content,
                documentId,
                privateKey
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                transactionId: '',
                success: false,
                error: result.error || 'Upload failed',
            };
        }

        console.log('Upload successful! Transaction ID:', result.transactionId);
        return {
            transactionId: result.transactionId,
            success: true,
        };

    } catch (error) {
        console.error('Upload error:', error);
        return {
            transactionId: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * Load content from Arweave using API route
 */
export async function loadFromArweave(transactionId: string): Promise<LoadResult> {
    try {
        console.log('Loading content via API for transaction:', transactionId);

        const response = await fetch(`/api/load?transactionId=${encodeURIComponent(transactionId)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                content: '',
                success: false,
                error: result.error || 'Load failed',
            };
        }

        console.log('Content loaded successfully via API');
        return {
            content: result.content,
            success: true,
            fromRedis: result.fromRedis,
            published: result.published,
        };

    } catch (error) {
        console.error('Load error:', error);
        return {
            content: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * Clear wallet from localStorage
 */
export function clearWallet(): void {
    localStorage.removeItem('solana_wallet');
}

/**
 * Get current Solana wallet address
 */
export function getSolanaWalletAddress(): string | null {
    const storedWallet = localStorage.getItem('solana_wallet');
    if (storedWallet) {
        try {
            const wallet = JSON.parse(storedWallet);
            return wallet.address;
        } catch (error) {
            console.error('Error parsing stored Solana wallet:', error);
        }
    }
    return null;
}

/**
 * Get wallet funding instructions
 */
export function getWalletFundingInstructions(): string {
    const address = getSolanaWalletAddress();
    if (!address) {
        return 'No wallet found. Please generate a wallet first.';
    }

    return `To fund your wallet for Arweave uploads:
1. Copy this wallet address: ${address}
2. Send at least 0.01 SOL to this address
3. You can buy SOL on exchanges like Coinbase, Binance, or use a faucet for testnet
4. Once funded, try uploading again

Note: Each upload costs a small amount of SOL (usually < 0.001 SOL)`;
}

/**
 * Encryption/Decryption Functions
 */

/**
 * Encrypt content with password
 */
export function encryptContent(content: string, password: string): string {
    try {
        const encrypted = CryptoJS.AES.encrypt(content, password).toString();
        return encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt content');
    }
}

/**
 * Decrypt content with password
 */
export function decryptContent(encryptedContent: string, password: string): string {
    try {
        const decrypted = CryptoJS.AES.decrypt(encryptedContent, password);
        const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

        if (!decryptedString) {
            throw new Error('Invalid password or corrupted data');
        }

        return decryptedString;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt content. Please check your password.');
    }
}

/**
 * Extract transaction IDs from version content
 */
export function extractTransactionIdsFromVersion(versionContent: string): string[] {
    try {
        const parsedContent = JSON.parse(versionContent);
        if (parsedContent.previousTransactionId && Array.isArray(parsedContent.previousTransactionId)) {
            return parsedContent.previousTransactionId;
        }
    } catch {
        // If not JSON or no previousTransactionId, return empty array
    }
    return [];
}

/**
 * Get all previous transaction IDs from document versions for a new version
 */
export function getAllPreviousTransactionIds(documentId: string): string[] {
    const document = getDocument(documentId);
    if (!document) {
        return [];
    }

    const allTransactionIds: string[] = [];

    // Collect transaction IDs from all existing versions
    for (const version of document.versions) {
        const transactionIds = extractTransactionIdsFromVersion(version.content);
        allTransactionIds.push(...transactionIds);
    }

    // Add the document's current transaction ID (this will be "previous" for the new version)
    if (document.arweaveTransactionId) {
        allTransactionIds.push(document.arweaveTransactionId);
    }

    // Remove duplicates and return
    return [...new Set(allTransactionIds)];
}

/**
 * Document Management Functions
 */

/**
 * Get all documents from localStorage
 */
export function getAllDocuments(): Document[] {
    try {
        const documents = localStorage.getItem('arweave_documents');
        return documents ? JSON.parse(documents) : [];
    } catch (error) {
        console.error('Error loading documents:', error);
        return [];
    }
}

/**
 * Save documents to localStorage
 */
export function saveDocuments(documents: Document[]): void {
    try {
        localStorage.setItem('arweave_documents', JSON.stringify(documents));
    } catch (error) {
        console.error('Error saving documents:', error);
    }
}

/**
 * Create a new document
 */
export function createDocument(title: string, content: string, password?: string, previousTransactionIds?: string[]): Document | null {
    console.log('createDocument called with title:', title);
    const now = new Date().toISOString();
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;

    // Handle content encryption/formatting
    let finalContent = content;
    let isPasswordProtected = 0;

    try {
        // Try to parse content to check if it's already in the new encrypted format
        let contentObj;
        try {
            contentObj = JSON.parse(content);
        } catch {
            // If not JSON, treat as plain text
            contentObj = null;
        }

        // Check if content is already in the new encrypted format (from Editor.tsx)
        if (contentObj && contentObj.encrypted === true && contentObj.password === 1) {
            // Content is already encrypted in new format, use as-is
            finalContent = content;
            isPasswordProtected = 1;
        } else if (password) {
            // Need to encrypt - use old method for backward compatibility or if not in new format
            if (contentObj) {
                // Add password information and previous transaction IDs
                contentObj.password = 1;
                contentObj.passwordProtected = true;
                contentObj.timestamp = new Date().toISOString();
                contentObj.previousTransactionId = previousTransactionIds || [];
                finalContent = encryptContent(JSON.stringify(contentObj), password);
            } else {
                // Not JSON, encrypt as plain text
                const wrapped = {
                    content: content,
                    password: 1,
                    passwordProtected: true,
                    timestamp: new Date().toISOString(),
                    previousTransactionId: previousTransactionIds || []
                };
                finalContent = encryptContent(JSON.stringify(wrapped), password);
            }
            isPasswordProtected = 1;
        } else {
            // No password - add metadata to content
            if (contentObj) {
                // Already JSON, just add metadata
                contentObj.password = 0;
                contentObj.passwordProtected = false;
                contentObj.timestamp = new Date().toISOString();
                contentObj.previousTransactionId = previousTransactionIds || [];
                finalContent = JSON.stringify(contentObj);
            } else {
                // Not JSON, wrap with metadata
                finalContent = JSON.stringify({
                    content: content,
                    password: 0,
                    passwordProtected: false,
                    timestamp: new Date().toISOString(),
                    previousTransactionId: previousTransactionIds || []
                });
            }
        }
    } catch (error) {
        console.error('Failed to process content:', error);
        throw new Error('Failed to process content');
    }

    const newDocument: Document = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        createdAt: now,
        lastModified: now,
        versions: [{
            versionNumber: 1,
            timestamp: now,
            content: finalContent,
            preview: preview,
            password: isPasswordProtected
        }],
        currentVersionNumber: 1
    };

    // Add the new document to the documents array and save
    const documents = getAllDocuments();
    console.log('Documents before adding new one:', documents.length);
    documents.push(newDocument);
    saveDocuments(documents);

    console.log(`Created new document: ${newDocument.id} with title: ${title}`);
    console.log(`Total documents now: ${documents.length}`);

    return newDocument;
}

/**
 * Extract content preview from JSON content
 */
function extractContentPreview(content: string): string {
    try {
        const parsed = JSON.parse(content);

        // New encrypted wrapper format
        if (parsed && parsed.encrypted === true && typeof parsed.content === 'string') {
            return '[Encrypted content]';
        }

        // If it's an object with a 'data' field, extract the data
        if (parsed && typeof parsed === 'object' && parsed.data) {
            return parsed.data;
        }

        // If it's already editor content (has type, content, etc.), extract text
        if (parsed && parsed.type === 'doc' && parsed.content) {
            return extractTextFromEditorContent(parsed.content);
        }

        // If it's plain text, return as is
        return content;
    } catch {
        // If not JSON, return as is
        return content;
    }
}

/**
 * Extract text content from editor JSON structure
 */
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

/**
 * Add a new version to a document
 */
export function addDocumentVersion(
    documentId: string,
    content: string,
    arweaveTransactionId?: string,
    password?: string,
    previousTransactionIds?: string[]
): Document | null {
    const documents = getAllDocuments();
    const docIndex = documents.findIndex(doc => doc.id === documentId);

    if (docIndex === -1) {
        console.error('Document not found:', documentId);
        return null;
    }

    const document = documents[docIndex];
    const now = new Date().toISOString();

    // Extract content preview
    const contentPreview = extractContentPreview(content);
    const preview = contentPreview.length > 50 ? contentPreview.substring(0, 50) + '...' : contentPreview;

    // Handle content encryption/formatting
    let finalContent = content;
    let isPasswordProtected = 0;

    try {
        // Try to parse content to check if it's already in the new encrypted format
        let contentObj;
        try {
            contentObj = JSON.parse(content);
        } catch {
            // If not JSON, treat as plain text
            contentObj = null;
        }

        // Check if content is already in the new encrypted format (from Editor.tsx)
        if (contentObj && contentObj.encrypted === true && contentObj.password === 1) {
            // Content is already encrypted in new format, use as-is
            finalContent = content;
            isPasswordProtected = 1;
        } else if (password) {
            // Need to encrypt - use old method for backward compatibility or if not in new format
            if (contentObj) {
                // Add password information and previous transaction IDs
                contentObj.password = 1;
                contentObj.passwordProtected = true;
                contentObj.timestamp = new Date().toISOString();
                contentObj.previousTransactionId = previousTransactionIds || [];
                finalContent = encryptContent(JSON.stringify(contentObj), password);
            } else {
                // Not JSON, encrypt as plain text
                const wrapped = {
                    content: content,
                    password: 1,
                    passwordProtected: true,
                    timestamp: new Date().toISOString(),
                    previousTransactionId: previousTransactionIds || []
                };
                finalContent = encryptContent(JSON.stringify(wrapped), password);
            }
            isPasswordProtected = 1;
        } else {
            // No password - add metadata to content
            if (contentObj) {
                // Already JSON, just add metadata
                contentObj.password = 0;
                contentObj.passwordProtected = false;
                contentObj.timestamp = new Date().toISOString();
                contentObj.previousTransactionId = previousTransactionIds || [];
                finalContent = JSON.stringify(contentObj);
            } else {
                // Not JSON, wrap with metadata
                finalContent = JSON.stringify({
                    content: content,
                    password: 0,
                    passwordProtected: false,
                    timestamp: new Date().toISOString(),
                    previousTransactionId: previousTransactionIds || []
                });
            }
        }
    } catch (error) {
        console.error('Failed to process content:', error);
        throw new Error('Failed to process content');
    }

    // Create new version
    const newVersion: DocumentVersion = {
        versionNumber: document.versions.length + 1,
        timestamp: now,
        content: finalContent,
        preview: preview,
        password: isPasswordProtected
    };

    // Add new version to the beginning of the array
    document.versions.unshift(newVersion);
    document.currentVersionNumber = newVersion.versionNumber;
    document.lastModified = now;

    // Update Arweave transaction ID if provided
    if (arweaveTransactionId) {
        document.arweaveTransactionId = arweaveTransactionId;
    }

    // Update the document in the array and save
    documents[docIndex] = document;
    saveDocuments(documents);

    console.log(`Added version ${newVersion.versionNumber} to document ${documentId}`);
    console.log(`Document now has ${document.versions.length} versions`);

    return document;
}

/**
 * Get a specific document by ID
 */
export function getDocument(documentId: string): Document | null {
    const documents = getAllDocuments();
    return documents.find(doc => doc.id === documentId) || null;
}

/**
 * Delete a document
 */
export function deleteDocument(documentId: string): boolean {
    const documents = getAllDocuments();
    const filteredDocs = documents.filter(doc => doc.id !== documentId);

    if (filteredDocs.length === documents.length) {
        return false; // Document not found
    }

    saveDocuments(filteredDocs);
    return true;
}

/**
 * Get current document ID from localStorage (for single document mode)
 */
export function getCurrentDocumentId(): string | null {
    return localStorage.getItem('current_document_id');
}

/**
 * Set current document ID
 */
export function setCurrentDocumentId(documentId: string): void {
    localStorage.setItem('current_document_id', documentId);
}

/**
 * Get current document (returns null if none exists)
 */
export function getCurrentDocument(): Document | null {
    let currentDocId = getCurrentDocumentId();
    return currentDocId ? getDocument(currentDocId) : null;
}

/**
 * Get or create current document (legacy function - use getCurrentDocument instead)
 * @deprecated Use getCurrentDocument() instead
 */
export function getOrCreateCurrentDocument(): Document {
    let currentDocId = getCurrentDocumentId();
    let currentDoc = currentDocId ? getDocument(currentDocId) : null;

    if (!currentDoc) {
        // Create a new document
        const newDoc = createDocument('Untitled Document', '');
        if (!newDoc) {
            throw new Error('Failed to create current document');
        }
        currentDoc = newDoc;
        setCurrentDocumentId(currentDoc.id);
    }

    return currentDoc;
}

/**
 * Get content from a specific version number
 */
export function getVersionContent(documentId: string, versionNumber: number): string | null {
    const document = getDocument(documentId);
    if (!document) {
        return null;
    }

    const version = document.versions.find(v => v.versionNumber === versionNumber);
    if (!version) {
        return null;
    }

    // For non-password protected versions, clean the JSON if it has password metadata
    if (version.password !== 1) {
        try {
            const parsedContent = JSON.parse(version.content);
            if (parsedContent.password !== undefined) {
                // Remove password metadata and return clean content
                const { password: _, passwordProtected: __, timestamp: ___, previousTransactionId: ____, ...cleanContent } = parsedContent;
                return JSON.stringify(cleanContent);
            }
        } catch {
            // If not JSON or no password metadata, return as is
        }
    }

    return version.content;
}

/**
 * Get content from a specific version number with password decryption
 */
export function getVersionContentWithPassword(documentId: string, versionNumber: number, password?: string): string | null {
    const document = getDocument(documentId);
    if (!document) {
        return null;
    }

    const version = document.versions.find(v => v.versionNumber === versionNumber);
    if (!version) {
        return null;
    }

    // If version is password protected, decrypt it
    if (version.password === 1) {
        if (!password) {
            throw new Error('Password required for this version');
        }
        try {
            // First, try to parse the version content to check the format
            let versionContentObj;
            try {
                versionContentObj = JSON.parse(version.content);
            } catch {
                // If not JSON, treat as old format (whole content is encrypted)
                versionContentObj = null;
            }

            // Check if it's the new format (encrypted: true with content field)
            if (versionContentObj && versionContentObj.encrypted === true && versionContentObj.content) {
                // New format: decrypt the content field which contains the encrypted editorContent
                try {
                    const decryptedEditorContent = decryptContent(versionContentObj.content, password);
                    // Return the decrypted editor content (already in JSON format)
                    return decryptedEditorContent;
                } catch (error) {
                    throw new Error('Failed to decrypt content. Please check your password.');
                }
            } else {
                // Old format: entire version.content is encrypted
                const decryptedContent = decryptContent(version.content, password);
                // Parse the decrypted JSON to extract the actual content
                try {
                    const parsedContent = JSON.parse(decryptedContent);
                    // Return the original content structure without password metadata
                    const { password: _, passwordProtected: __, timestamp: ___, previousTransactionId: ____, ...cleanContent } = parsedContent;
                    return JSON.stringify(cleanContent);
                } catch {
                    // If not JSON, return as is
                    return decryptedContent;
                }
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('Failed to decrypt')) {
                throw error;
            }
            throw new Error('Failed to decrypt content. Please check your password.');
        }
    }

    return version.content;
}

/**
 * Get latest version content from document (instant loading)
 */
export function getLatestVersionContent(documentId: string): string | null {
    const document = getDocument(documentId);
    if (!document || document.versions.length === 0) {
        return null;
    }

    // Get the first version (most recent)
    const latestVersion = document.versions[0];
    return latestVersion.content;
}

/**
 * Get all versions for a document (newest first)
 */
export function getDocumentVersions(documentId: string): DocumentVersion[] {
    const document = getDocument(documentId);
    if (!document) {
        return [];
    }

    return document.versions;
}

/**
 * Get current version number for a document
 */
export function getCurrentVersionNumber(documentId: string): number {
    const document = getDocument(documentId);
    if (!document) {
        return 0;
    }

    return document.currentVersionNumber;
}
