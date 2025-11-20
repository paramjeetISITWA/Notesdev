import { createClient, RedisClientType } from 'redis';
import type { Document } from '@/lib/types/document';

// Redis client instance
let redis: RedisClientType | null = null;
let redisEnabled = true;
let isConnecting = false;

/**
 * Get or create Redis client
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
    // Check if Redis is disabled (no env vars set)
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
    const redisUsername = process.env.REDIS_USERNAME;
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined;

    if (!redisUrl && !redisHost) {
        redisEnabled = false;
        return null;
    }

    if (!redis && redisEnabled && !isConnecting) {
        try {
            isConnecting = true;

            if (redisUrl) {
                // Use Redis URL if provided
                redis = createClient({
                    url: redisUrl
                });
            } else {
                // Use individual connection parameters (matching your format)
                redis = createClient({
                    username: redisUsername || 'default',
                    password: redisPassword,
                    socket: {
                        host: redisHost,
                        port: redisPort || 11474
                    }
                });
            }

            redis.on('error', (err: Error) => {
                console.error('Redis Client Error:', err);
                // Don't crash the app, just log the error
            });

            redis.on('connect', () => {
                console.log('Redis Client Connected');
            });

            redis.on('ready', () => {
                console.log('Redis Client Ready');
            });

            redis.on('end', () => {
                console.log('Redis Client Disconnected');
            });

            // Connect to Redis
            await redis.connect();
            isConnecting = false;
        } catch (error) {
            console.error('Failed to initialize Redis:', error);
            redisEnabled = false;
            isConnecting = false;
            return null;
        }
    }

    // If client exists but is not connected, try to reconnect
    if (redis && !redis.isOpen) {
        try {
            await redis.connect();
        } catch (error) {
            console.error('Failed to reconnect to Redis:', error);
            return null;
        }
    }

    return redis;
}

export interface PendingTransactionEntry {
    txId: string;
    documentId?: string;
    title?: string;
    savedAt: string;
}

const getUserPendingKey = (walletAddress: string) => `user:${walletAddress}:pending`;
const getUserDocumentsKey = (walletAddress: string) => `user:${walletAddress}:documents`;
const getUserCurrentDocumentKey = (walletAddress: string) => `user:${walletAddress}:current-doc`;

function normalizeWalletAddress(walletAddress?: string): string | null {
    if (!walletAddress) {
        return null;
    }
    const trimmed = walletAddress.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function parsePendingTransactions(raw: string | null): PendingTransactionEntry[] {
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
                return [];
            }

            const first = parsed[0];
            if (typeof first === 'string') {
                return (parsed as string[]).map((txId) => ({
                    txId,
                    savedAt: new Date().toISOString(),
                }));
            }

            if (first && typeof first === 'object' && 'txId' in first) {
                return parsed as PendingTransactionEntry[];
            }
        }
    } catch (error) {
        console.error('Error parsing pending transactions from Redis:', error);
    }

    return [];
}

export async function getUserDocuments(walletAddress: string): Promise<Document[]> {
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    if (!normalizedWallet) {
        return [];
    }

    try {
        const client = await getRedisClient();
        if (!client) {
            return [];
        }

        const key = getUserDocumentsKey(normalizedWallet);
        const data = await client.get(key);
        if (!data) {
            return [];
        }

        return JSON.parse(data);
    } catch (error) {
        console.error('Error getting user documents from Redis:', error);
        return [];
    }
}

export async function saveUserDocuments(walletAddress: string, documents: Document[]): Promise<boolean> {
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    if (!normalizedWallet) {
        return false;
    }

    try {
        const client = await getRedisClient();
        if (!client) {
            return false;
        }

        const key = getUserDocumentsKey(normalizedWallet);
        await client.set(key, JSON.stringify(documents));
        return true;
    } catch (error) {
        console.error('Error saving user documents to Redis:', error);
        return false;
    }
}

export async function getUserCurrentDocumentId(walletAddress: string): Promise<string | null> {
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    if (!normalizedWallet) {
        return null;
    }

    try {
        const client = await getRedisClient();
        if (!client) {
            return null;
        }

        const key = getUserCurrentDocumentKey(normalizedWallet);
        return await client.get(key);
    } catch (error) {
        console.error('Error getting current document id from Redis:', error);
        return null;
    }
}

export async function setUserCurrentDocumentId(walletAddress: string, documentId: string | null): Promise<boolean> {
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    if (!normalizedWallet) {
        return false;
    }

    try {
        const client = await getRedisClient();
        if (!client) {
            return false;
        }

        const key = getUserCurrentDocumentKey(normalizedWallet);

        if (!documentId) {
            await client.del(key);
        } else {
            await client.set(key, documentId);
        }

        return true;
    } catch (error) {
        console.error('Error setting current document id in Redis:', error);
        return false;
    }
}

/**
 * Save document to Redis by transaction ID
 */
export async function saveDocumentToRedis(txId: string, content: string, metadata?: {
    documentId?: string;
    title?: string;
    walletAddress?: string;
    timestamp?: string;
}): Promise<boolean> {
    try {
        const client = await getRedisClient();
        if (!client) {
            console.warn('Redis not configured, skipping save');
            return false;
        }

        const key = `doc:${txId}`;

        const documentData = {
            content,
            txId,
            ...metadata,
            savedAt: new Date().toISOString(),
            published: false,
        };

        // Save document with expiration (30 days)
        await client.setEx(key, 30 * 24 * 60 * 60, JSON.stringify(documentData));

        return true;
    } catch (error) {
        console.error('Error saving document to Redis:', error);
        return false;
    }
}

/**
 * Get document from Redis by transaction ID
 */
export async function getDocumentFromRedis(txId: string): Promise<{
    content: string;
    txId: string;
    published: boolean;
    savedAt: string;
    documentId?: string;
    title?: string;
    walletAddress?: string;
} | null> {
    try {
        const client = await getRedisClient();
        if (!client) {
            return null;
        }

        const key = `doc:${txId}`;
        const data = await client.get(key);

        if (!data) {
            return null;
        }

        return JSON.parse(data);
    } catch (error) {
        console.error('Error getting document from Redis:', error);
        return null;
    }
}

/**
 * Get demo document (demo:[txId]) from Redis
 */
export async function getDemoDocumentFromRedis(txId: string): Promise<{
    content: string;
    txId: string;
    savedAt?: string;
    published?: boolean;
    documentId?: string;
    title?: string;
    walletAddress?: string;
} | null> {
    try {
        const client = await getRedisClient();
        if (!client) {
            return null;
        }

        const demoKeys = [`demo:[${txId}]`, `demo:${txId}`];

        for (const key of demoKeys) {
            const data = await client.get(key);
            if (data) {
                return JSON.parse(data);
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting demo document from Redis:', error);
        return null;
    }
}

/**
 * Remove document from Redis (when published to Arweave)
 */
export async function removeDocumentFromRedis(txId: string): Promise<boolean> {
    try {
        const client = await getRedisClient();
        if (!client) {
            return false;
        }

        const key = `doc:${txId}`;
        await client.del(key);
        return true;
    } catch (error) {
        console.error('Error removing document from Redis:', error);
        return false;
    }
}

/**
 * Mark document as published in Redis
 */
export async function markDocumentAsPublished(txId: string): Promise<boolean> {
    try {
        const client = await getRedisClient();
        if (!client) {
            return false;
        }

        const key = `doc:${txId}`;
        const data = await client.get(key);

        if (data) {
            const documentData = JSON.parse(data);
            documentData.published = true;
            documentData.publishedAt = new Date().toISOString();

            // Update with new expiration (7 days after publishing)
            await client.setEx(key, 7 * 24 * 60 * 60, JSON.stringify(documentData));
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error marking document as published:', error);
        return false;
    }
}

/**
 * Save a pending transaction for a user (kept until published)
 */
export async function saveUserPendingTransaction(walletAddress: string, txId: string, metadata?: {
    documentId?: string;
    title?: string;
    savedAt?: string;
}): Promise<boolean> {
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    if (!normalizedWallet) {
        return false;
    }

    try {
        const client = await getRedisClient();
        if (!client) {
            return false;
        }

        const key = getUserPendingKey(normalizedWallet);

        // Get existing pending transactions
        const existing = await client.get(key);
        const pending = parsePendingTransactions(existing);

        // Add new transaction if not already present
        if (!pending.some(tx => tx.txId === txId)) {
            pending.push({
                txId,
                documentId: metadata?.documentId,
                title: metadata?.title,
                savedAt: metadata?.savedAt || new Date().toISOString(),
            });
            // Save with no expiration (permanent until cleaned)
            await client.set(key, JSON.stringify(pending));
        }

        return true;
    } catch (error) {
        console.error('Error saving user transaction IDs:', error);
        return false;
    }
}

/**
 * Get all transaction IDs for a user
 */
export async function getUserTransactionIds(walletAddress: string): Promise<string[]> {
    const pending = await getUserPendingTransactions(walletAddress);
    return pending.map(tx => tx.txId);
}

/**
 * Legacy helper (kept for backward compatibility)
 */
export async function saveUserTransactionIds(walletAddress: string, txId: string, metadata?: {
    documentId?: string;
    title?: string;
    savedAt?: string;
}): Promise<boolean> {
    return saveUserPendingTransaction(walletAddress, txId, metadata);
}

/**
 * Get all pending transactions for a user
 */
export async function getUserPendingTransactions(walletAddress: string): Promise<PendingTransactionEntry[]> {
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    if (!normalizedWallet) {
        return [];
    }

    try {
        const client = await getRedisClient();
        if (!client) {
            return [];
        }

        const key = getUserPendingKey(normalizedWallet);
        const data = await client.get(key);
        return parsePendingTransactions(data);
    } catch (error) {
        console.error('Error getting user pending transactions:', error);
        return [];
    }
}

/**
 * Remove a pending transaction once published
 */
export async function removeUserPendingTransaction(walletAddress: string, txId: string): Promise<boolean> {
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    if (!normalizedWallet) {
        return false;
    }

    try {
        const client = await getRedisClient();
        if (!client) {
            return false;
        }

        const key = getUserPendingKey(normalizedWallet);
        const data = await client.get(key);

        if (!data) {
            return false;
        }

        const pending = parsePendingTransactions(data);
        const filtered = pending.filter(tx => tx.txId !== txId);

        if (filtered.length === 0) {
            await client.del(key);
        } else {
            await client.set(key, JSON.stringify(filtered));
        }

        return true;
    } catch (error) {
        console.error('Error removing pending transaction:', error);
        return false;
    }
}

/**
 * Check if document is published on Arweave
 * Published means: data can be successfully loaded from Arweave using the transaction ID
 */
export async function checkArweavePublishStatus(txId: string): Promise<boolean> {
    try {
        const Arweave = require('arweave');
        const arweave = Arweave.init({
            host: 'arweave.net',
            port: 443,
            protocol: 'https'
        });

        // Try to get transaction data - if we can successfully load data, it's published
        const data = await arweave.transactions.getData(txId, {
            decode: true,
            string: true
        });

        // If we can get data (not null/undefined and has content), it's published
        if (data !== null && data !== undefined && data !== '') {
            console.log(`Document ${txId} is published on Arweave (data can be loaded)`);
            return true;
        }

        // Try alternative method if first attempt didn't work
        try {
            const altData = await arweave.transactions.getData(txId, {
                decode: true,
                string: true
            });
            if (altData !== null && altData !== undefined && altData !== '') {
                console.log(`Document ${txId} is published on Arweave (data can be loaded via alternative method)`);
                return true;
            }
        } catch (altError) {
            // Alternative method also failed
        }

        console.log(`Document ${txId} is not yet published on Arweave (cannot load data)`);
        return false;
    } catch (error) {
        // If error, assume not published yet (cannot load data)
        console.log(`Document ${txId} is not yet published on Arweave (error loading: ${error instanceof Error ? error.message : 'Unknown error'})`);
        return false;
    }
}

/**
 * Get all pending documents (not yet published)
 */
export async function getPendingDocuments(): Promise<string[]> {
    try {
        const client = await getRedisClient();
        if (!client) {
            return [];
        }

        const keys = await client.keys('doc:*');
        const pending: string[] = [];

        for (const key of keys) {
            const data = await client.get(key);
            if (data) {
                const doc = JSON.parse(data);
                if (!doc.published) {
                    const txId = key.replace('doc:', '');
                    pending.push(txId);
                }
            }
        }

        return pending;
    } catch (error) {
        console.error('Error getting pending documents:', error);
        return [];
    }
}
