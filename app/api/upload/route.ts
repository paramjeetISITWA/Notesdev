import { NextRequest, NextResponse } from 'next/server';
import { Keypair, Connection } from '@solana/web3.js';
import Bundlr from '@bundlr-network/client';
import bs58 from 'bs58';
import { saveDocumentToRedis, saveUserTransactionIds } from '@/lib/redis-utils';

export async function POST(request: NextRequest) {
    try {
        const { content, documentId, privateKey } = await request.json();

        if (!content) {
            return NextResponse.json(
                { success: false, error: 'Content is required' },
                { status: 400 }
            );
        }

        if (!privateKey) {
            return NextResponse.json(
                { success: false, error: 'Private key is required' },
                { status: 400 }
            );
        }

        // Load Solana wallet from request body
        let solanaWallet: Keypair;

        try {
            console.log('Using private key from request');
            solanaWallet = Keypair.fromSecretKey(bs58.decode(privateKey));
        } catch (error) {
            console.error('Error parsing private key:', error);
            return NextResponse.json(
                { success: false, error: 'Invalid private key format' },
                { status: 400 }
            );
        }

        console.log('Wallet public key:', solanaWallet.publicKey.toBase58());

        // Connect to Solana Mainnet
        const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
        const connection = new Connection(RPC_URL, 'confirmed');

        // Check balance
        const balance = await connection.getBalance(solanaWallet.publicKey);
        const solBalance = balance / 1e9;
        console.log("SOL Balance:", solBalance, "SOL");



        // Initialize Bundlr client (using the working server approach)
        const bundlr = new Bundlr(
            'https://node1.bundlr.network',
            'solana',
            solanaWallet.secretKey,
            { providerUrl: RPC_URL }
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

        const transaction = await bundlr.upload(data, {
            tags,
            // waitForConfirmation: false,
        });

        console.log('data:', data);

        console.log('File uploaded successfully!');
        console.log('Arweave URL: https://arweave.net/' + transaction.id);
        console.log('Transaction:', transaction);

        const walletAddress = solanaWallet.publicKey.toBase58();
        const txId = transaction.id;

        // Save document to Redis immediately (before Arweave publishes)
        try {
            await saveDocumentToRedis(txId, content, {
                documentId: documentId,
                walletAddress: walletAddress,
                timestamp: new Date().toISOString(),
            });

            // Save transaction ID to user's transaction list
            await saveUserTransactionIds(walletAddress, txId);

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
            balance: solBalance
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
