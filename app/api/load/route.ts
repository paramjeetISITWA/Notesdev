import { NextRequest, NextResponse } from 'next/server';
import Arweave from 'arweave';
import { getDocumentFromRedis } from '@/lib/redis-utils';

// Initialize Arweave instance (matching getdata.js)
const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
        return NextResponse.json(
            { success: false, error: 'Transaction ID is required' },
            { status: 400 }
        );
    }

    // Validate transaction ID format
    if (transactionId.length !== 43) {
        return NextResponse.json(
            { success: false, error: 'Invalid transaction ID format' },
            { status: 400 }
        );
    }

    try {
        console.log(`Attempting to fetch data for transaction: ${transactionId}`);

        // First, check Redis for the document (since Arweave may not be published yet)
        const redisDoc = await getDocumentFromRedis(transactionId);
        if (redisDoc && redisDoc.content) {
            console.log('Document found in Redis');
            return NextResponse.json({
                success: true,
                content: redisDoc.content,
                transactionId: transactionId,
                arweaveUrl: `https://arweave.net/${transactionId}`,
                fromRedis: true,
                published: redisDoc.published
            });
        }

        // If not in Redis, try to get from Arweave
        console.log('Document not found in Redis, checking Arweave...');

        // Get transaction data (like getdata.js)
        const data = await arweave.transactions.getData(transactionId, {
            decode: true,
            string: true
        });

        console.log('Data retrieved successfully from Arweave');

        return NextResponse.json({
            success: true,
            content: data as string,
            transactionId: transactionId,
            arweaveUrl: `https://arweave.net/${transactionId}`,
            fromRedis: false,
            published: true
        });

    } catch (error) {
        console.error('Error fetching data:', error instanceof Error ? error.message : 'Unknown error');

        // Try alternative approach with different options (like getdata.js)
        try {
            console.log('Trying alternative method...');
            const data = await arweave.transactions.getData(transactionId, {
                decode: true,
                string: true
            });
            console.log('Data retrieved with alternative method');

            return NextResponse.json({
                success: true,
                content: data as string,
                transactionId: transactionId,
                arweaveUrl: `https://arweave.net/${transactionId}`,
                fromRedis: false,
                published: true
            });

        } catch (altError) {
            console.error('Alternative method also failed:', altError instanceof Error ? altError.message : 'Unknown error');
            console.log('The transaction may not exist or may not be accessible.');

            // Final check: try Redis one more time (in case it was just saved)
            const redisDoc = await getDocumentFromRedis(transactionId);
            if (redisDoc && redisDoc.content) {
                console.log('Document found in Redis on retry');
                return NextResponse.json({
                    success: true,
                    content: redisDoc.content,
                    transactionId: transactionId,
                    arweaveUrl: `https://arweave.net/${transactionId}`,
                    fromRedis: true,
                    published: redisDoc.published
                });
            }

            return NextResponse.json(
                {
                    success: false,
                    error: 'The transaction may not exist or may not be accessible. Both methods failed.'
                },
                { status: 404 }
            );
        }
    }
}
