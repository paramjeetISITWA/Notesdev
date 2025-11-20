import { NextRequest, NextResponse } from 'next/server';
import { checkArweavePublishStatus, markDocumentAsPublished, removeDocumentFromRedis, getDocumentFromRedis, removeUserPendingTransaction } from '@/lib/redis-utils';

export async function POST(request: NextRequest) {
    try {
        const { transactionId } = await request.json();

        if (!transactionId) {
            return NextResponse.json(
                { success: false, error: 'Transaction ID is required' },
                { status: 400 }
            );
        }

        // Check if document exists in Redis
        const redisDoc = await getDocumentFromRedis(transactionId);
        if (!redisDoc) {
            return NextResponse.json({
                success: true,
                published: true,
                message: 'Document not in Redis (may already be published or removed)'
            });
        }

        const walletAddress = redisDoc.walletAddress;

        // If already marked as published, remove from Redis and return
        if (redisDoc.published) {
            // Remove from Redis since it's already published (cleanup legacy entries)
            await removeDocumentFromRedis(transactionId);
            if (walletAddress) {
                await removeUserPendingTransaction(walletAddress, transactionId);
            }
            return NextResponse.json({
                success: true,
                published: true,
                message: 'Document already marked as published and removed from Redis'
            });
        }

        // Check if published on Arweave
        const isPublished = await checkArweavePublishStatus(transactionId);

        if (isPublished) {
            // Mark as published
            await markDocumentAsPublished(transactionId);

            // Remove from Redis after publishing (no longer needed since it's on Arweave)
            await removeDocumentFromRedis(transactionId);
            if (walletAddress) {
                await removeUserPendingTransaction(walletAddress, transactionId);
            }

            return NextResponse.json({
                success: true,
                published: true,
                message: 'Document is now published on Arweave and removed from Redis'
            });
        } else {
            return NextResponse.json({
                success: true,
                published: false,
                message: 'Document not yet published on Arweave'
            });
        }

    } catch (error) {
        console.error('Error checking publish status:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint to check publish status
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const transactionId = searchParams.get('transactionId');

        if (!transactionId) {
            return NextResponse.json(
                { success: false, error: 'Transaction ID is required' },
                { status: 400 }
            );
        }

        // Check if document exists in Redis
        const redisDoc = await getDocumentFromRedis(transactionId);
        if (!redisDoc) {
            // Check Arweave directly
            const isPublished = await checkArweavePublishStatus(transactionId);
            return NextResponse.json({
                success: true,
                published: isPublished,
                inRedis: false
            });
        }

        const walletAddress = redisDoc.walletAddress;

        // If already marked as published, remove from Redis and check Arweave to confirm
        if (redisDoc.published) {
            const isPublished = await checkArweavePublishStatus(transactionId);
            // Remove from Redis since it's already published (cleanup legacy entries)
            await removeDocumentFromRedis(transactionId);
            if (walletAddress) {
                await removeUserPendingTransaction(walletAddress, transactionId);
            }
            return NextResponse.json({
                success: true,
                published: isPublished,
                inRedis: false, // Removed from Redis
                publishedAt: redisDoc.savedAt
            });
        }

        // Check if published on Arweave
        const isPublished = await checkArweavePublishStatus(transactionId);

        if (isPublished) {
            // Mark as published
            await markDocumentAsPublished(transactionId);

            // Remove from Redis after publishing (no longer needed since it's on Arweave)
            await removeDocumentFromRedis(transactionId);
            if (walletAddress) {
                await removeUserPendingTransaction(walletAddress, transactionId);
            }
        }

        return NextResponse.json({
            success: true,
            published: isPublished,
            inRedis: !isPublished // Only in Redis if not yet published
        });

    } catch (error) {
        console.error('Error checking publish status:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        );
    }
}

