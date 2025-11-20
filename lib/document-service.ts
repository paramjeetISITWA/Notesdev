import type { Document } from '@/lib/types/document';

interface FetchDocumentsResponse {
    success: boolean;
    documents: Document[];
    currentDocumentId: string | null;
}

export async function fetchDocumentsForWallet(walletAddress: string): Promise<{
    documents: Document[];
    currentDocumentId: string | null;
}> {
    if (!walletAddress) {
        return { documents: [], currentDocumentId: null };
    }

    const response = await fetch(`/api/documents?walletAddress=${encodeURIComponent(walletAddress)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to load documents');
    }

    const data: FetchDocumentsResponse = await response.json();
    return {
        documents: data.documents ?? [],
        currentDocumentId: data.currentDocumentId ?? null,
    };
}

export async function saveDocumentsForWallet(
    walletAddress: string,
    documents: Document[],
    currentDocumentId: string | null,
): Promise<void> {
    if (!walletAddress) {
        return;
    }

    const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            walletAddress,
            documents,
            currentDocumentId,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to save documents');
    }
}

