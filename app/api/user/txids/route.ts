import { NextRequest, NextResponse } from 'next/server';
import { getUserPendingTransactions } from '@/lib/redis-utils';

type PublishedTransaction = {
    txId: string;
    blockTimestamp?: number | null;
    blockHeight?: number | null;
    arweaveUrl: string;
    tags: Record<string, string>;
};

async function fetchPublishedTransactions(walletAddress: string, limit: number): Promise<PublishedTransaction[]> {
    const owners = walletAddress.trim();
    if (!owners) {
        return [];
    }

    try {
        const query = `
            query ($owners: [String!], $limit: Int) {
                transactions(owners: $owners, first: $limit, sort: HEIGHT_DESC) {
                    edges {
                        node {
                            id
                            block {
                                timestamp
                                height
                            }
                            tags {
                                name
                                value
                            }
                        }
                    }
                }
            }
        `;

        const response = await fetch('https://arweave.net/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: {
                    owners: [owners],
                    limit,
                },
            }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch Arweave transactions:', errorText);
            return [];
        }

        const result = await response.json();
        const edges = result?.data?.transactions?.edges ?? [];

        return edges.map(({ node }: any) => ({
            txId: node.id,
            blockTimestamp: node.block?.timestamp ?? null,
            blockHeight: node.block?.height ?? null,
            arweaveUrl: `https://arweave.net/${node.id}`,
            tags: Array.isArray(node.tags)
                ? node.tags.reduce((acc: Record<string, string>, tag: any) => {
                    if (tag?.name && typeof tag.name === 'string') {
                        acc[tag.name] = tag.value;
                    }
                    return acc;
                }, {})
                : {},
        }));
    } catch (error) {
        console.error('Error fetching Arweave transactions:', error);
        return [];
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('walletAddress');
        const limitParam = searchParams.get('limit');

        if (!walletAddress) {
            return NextResponse.json(
                { success: false, error: 'Wallet address is required' },
                { status: 400 }
            );
        }

        const limit = Math.max(1, Math.min(Number(limitParam) || 25, 100));

        const [pendingTransactions, publishedTransactions] = await Promise.all([
            getUserPendingTransactions(walletAddress),
            fetchPublishedTransactions(walletAddress, limit),
        ]);

        return NextResponse.json({
            success: true,
            transactionIds: pendingTransactions.map(tx => tx.txId),
            pendingTransactions,
            publishedTransactions,
            counts: {
                pending: pendingTransactions.length,
                published: publishedTransactions.length,
            },
        });

    } catch (error) {
        console.error('Error getting user transactions:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        );
    }
}

