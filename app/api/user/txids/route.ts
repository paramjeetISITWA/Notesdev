import { NextRequest, NextResponse } from 'next/server';
import { getUserTransactionIds } from '@/lib/redis-utils';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('walletAddress');

        if (!walletAddress) {
            return NextResponse.json(
                { success: false, error: 'Wallet address is required' },
                { status: 400 }
            );
        }

        const txIds = await getUserTransactionIds(walletAddress);

        return NextResponse.json({
            success: true,
            transactionIds: txIds,
            count: txIds.length
        });

    } catch (error) {
        console.error('Error getting user transaction IDs:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        );
    }
}

