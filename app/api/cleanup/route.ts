import { NextRequest, NextResponse } from 'next/server';
import { getPendingDocuments, checkArweavePublishStatus, markDocumentAsPublished, removeDocumentFromRedis, getDocumentFromRedis, removeUserPendingTransaction } from '@/lib/redis-utils';

/**
 * Cleanup endpoint to check pending documents and mark them as published
 * This should be called periodically (e.g., via cron job or scheduled task)
 */
export async function POST(request: NextRequest) {
    try {
        // Optional: Add authentication/authorization here
        const authHeader = request.headers.get('authorization');
        const expectedToken = process.env.CLEANUP_API_TOKEN;

        if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const pendingDocs = await getPendingDocuments();
        const results = {
            checked: 0,
            published: 0,
            stillPending: 0,
            errors: 0
        };

        for (const txId of pendingDocs) {
            try {
                results.checked++;
                const redisDoc = await getDocumentFromRedis(txId);
                const walletAddress = redisDoc?.walletAddress;
                const isPublished = await checkArweavePublishStatus(txId);

                if (isPublished) {
                    await markDocumentAsPublished(txId);
                    // Remove from Redis after publishing (no longer needed since it's on Arweave)
                    await removeDocumentFromRedis(txId);
                    if (walletAddress) {
                        await removeUserPendingTransaction(walletAddress, txId);
                    }
                    results.published++;
                    console.log(`Document ${txId} is now published and removed from Redis`);
                } else {
                    results.stillPending++;
                }
            } catch (error) {
                results.errors++;
                console.error(`Error checking document ${txId}:`, error);
            }
        }

        return NextResponse.json({
            success: true,
            results,
            message: `Checked ${results.checked} documents. ${results.published} are now published.`
        });

    } catch (error) {
        console.error('Cleanup error:', error);
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
 * GET endpoint for manual cleanup trigger
 */
export async function GET(request: NextRequest) {
    return POST(request);
}

