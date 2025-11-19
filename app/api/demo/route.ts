import { NextRequest, NextResponse } from 'next/server';
import { getDemoDocumentFromRedis } from '@/lib/redis-utils';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const txId = searchParams.get('txId') ?? searchParams.get('transactionId');

    if (!txId || !txId.trim()) {
        return NextResponse.json(
            { success: false, error: 'Transaction ID is required' },
            { status: 400 }
        );
    }

    try {
        const demoDoc = await getDemoDocumentFromRedis(txId.trim());

        if (!demoDoc || !demoDoc.content) {
            return NextResponse.json(
                { success: false, error: 'Demo content not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            content: demoDoc.content,
            txId: txId.trim(),
            fromRedis: true,
            published: demoDoc.published ?? false,
            metadata: {
                savedAt: demoDoc.savedAt,
                title: demoDoc.title,
                documentId: demoDoc.documentId,
            },
        });
    } catch (error) {
        console.error('Error loading demo content:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to load demo content' },
            { status: 500 }
        );
    }
}


