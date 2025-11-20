import { NextRequest, NextResponse } from 'next/server';
import Bundlr from '@bundlr-network/client';
import Arweave from 'arweave';
import { saveDocumentToRedis, saveUserTransactionIds } from '@/lib/redis-utils';

export async function POST(request: NextRequest) {
    try {
        const { content, documentId, jwk, title } = await request.json();

        if (!content) {
            return NextResponse.json(
                { success: false, error: 'Content is required' },
                { status: 400 }
            );
        }

        if (!jwk) {
            return NextResponse.json(
                { success: false, error: 'Arweave wallet (JWK) is required' },
                { status: 400 }
            );
        }

        // Initialize Arweave to get wallet address and check balance
        const arweave = Arweave.init({
            host: 'arweave.net',
            port: 443,
            protocol: 'https'
        });

        // Get wallet address from JWK
        const walletAddress = await arweave.wallets.jwkToAddress(jwk);
        console.log('Arweave wallet address:', walletAddress);

        // Check AR balance
        const balance = await arweave.wallets.getBalance(walletAddress);
        const arBalance = arweave.ar.winstonToAr(balance);
        console.log("AR Balance:", arBalance, "AR");

        // Initialize Bundlr client with Arweave wallet
        const bundlr = new Bundlr(
            'https://node1.bundlr.network',
            'arweave',
            jwk
        );

        // Convert content to Buffer like server.js does
        const data = Buffer.from(content, 'utf8');

        console.log('Uploading file to Arweave...');

        // Prepare tags
        const tags = [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'App', value: 'Tiptap-Editor' },
            { name: 'Timestamp', value: Date.now().toString() },
        ];

        // Add document ID tag if provided
        if (documentId) {
            tags.push({ name: 'Document-ID', value: documentId });
        }

        if (title) {
            tags.push({ name: 'Title', value: title });
        }

        const transaction = await bundlr.upload(data, {
            tags,
            // waitForConfirmation: false,
        });

        console.log('data:', data);

        console.log('File uploaded successfully!');
        console.log('Arweave URL: https://arweave.net/' + transaction.id);
        console.log('Transaction:', transaction);

        const txId = transaction.id;

        // Save document to Redis immediately (before Arweave publishes)
        try {
            await saveDocumentToRedis(txId, content, {
                documentId: documentId,
                title: title || 'Untitled document',
                walletAddress: walletAddress,
                timestamp: new Date().toISOString(),
            });

            // Save transaction ID to user's pending transaction list
            await saveUserTransactionIds(walletAddress, txId, {
                documentId: documentId,
                title: title || 'Untitled document',
                savedAt: new Date().toISOString(),
            });

            console.log('Document saved to Redis with transaction ID:', txId);
        } catch (redisError) {
            console.error('Error saving to Redis (non-fatal):', redisError);
            // Continue even if Redis fails - Arweave upload was successful
        }

        return NextResponse.json({
            success: true,
            transactionId: txId,
            arweaveUrl: `https://arweave.net/${txId}`,
            walletAddress: walletAddress,
            balance: arBalance
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        );
    }
}
