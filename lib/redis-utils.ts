import { createClient, RedisClientType } from 'redis';

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
 * Save user transaction IDs
 */
export async function saveUserTransactionIds(walletAddress: string, txId: string): Promise<boolean> {
    try {
        const client = await getRedisClient();
        if (!client) {
            return false;
        }

        const key = `user:${walletAddress}:txids`;

        // Get existing transaction IDs
        const existing = await client.get(key);
        const txIds: string[] = existing ? JSON.parse(existing) : [];

        // Add new transaction ID if not already present
        if (!txIds.includes(txId)) {
            txIds.push(txId);
            // Save with no expiration (permanent storage)
            await client.set(key, JSON.stringify(txIds));
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
    try {
        const client = await getRedisClient();
        if (!client) {
            return [];
        }

        const key = `user:${walletAddress}:txids`;
        const data = await client.get(key);

        if (!data) {
            return [];
        }

        return JSON.parse(data);
    } catch (error) {
        console.error('Error getting user transaction IDs:', error);
        return [];
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
