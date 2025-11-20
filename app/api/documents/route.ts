import { NextRequest, NextResponse } from 'next/server';
import { getUserDocuments, saveUserDocuments, getUserCurrentDocumentId, setUserCurrentDocumentId } from '@/lib/redis-utils';
import type { Document } from '@/lib/types/document';

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

        const [documents, currentDocumentId] = await Promise.all([
            getUserDocuments(walletAddress),
            getUserCurrentDocumentId(walletAddress),
        ]);

        return NextResponse.json({
            success: true,
            documents,
            currentDocumentId,
            count: documents.length,
        });
    } catch (error) {
        console.error('Error fetching user documents:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            { status: 500 }
        );
    }
}

interface SaveDocumentsPayload {
    walletAddress?: string;
    documents?: Document[];
    currentDocumentId?: string | null;
}

export async function POST(request: NextRequest) {
    try {
        const body: SaveDocumentsPayload = await request.json();
        const { walletAddress, documents, currentDocumentId } = body;

        if (!walletAddress) {
            return NextResponse.json(
                { success: false, error: 'Wallet address is required' },
                { status: 400 }
            );
        }

        if (!Array.isArray(documents)) {
            return NextResponse.json(
                { success: false, error: 'Documents array is required' },
                { status: 400 }
            );
        }

        const [documentsSaved] = await Promise.all([
            saveUserDocuments(walletAddress, documents),
            setUserCurrentDocumentId(walletAddress, currentDocumentId ?? null),
        ]);

        if (!documentsSaved) {
            return NextResponse.json(
                { success: false, error: 'Failed to save documents' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving user documents:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            { status: 500 }
        );
    }
}

