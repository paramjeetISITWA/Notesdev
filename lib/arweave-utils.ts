import Arweave from 'arweave';
import CryptoJS from 'crypto-js';

export interface WalletInfo {
    address: string;
    key: any;
}

export interface UploadResult {
    transactionId: string;
    success: boolean;
    error?: string;
}

export interface LoadResult {
    content: string;
    success: boolean;
    error?: string;
    fromRedis?: boolean;
    published?: boolean;
}

export async function generateArweaveWallet(): Promise<WalletInfo> {
    const arweave = Arweave.init({
        host: 'arweave.net',
        port: 443,
        protocol: 'https',
    });

    const wallet = await arweave.wallets.generate();
    const address = await arweave.wallets.jwkToAddress(wallet);
    localStorage.setItem('arweave_wallet', JSON.stringify({ address, jwk: wallet }));
    return { address, key: wallet };
}

export async function loadOrCreateArweaveWallet(): Promise<WalletInfo> {
    const storedWallet = localStorage.getItem('arweave_wallet');
    if (storedWallet) {
        try {
            const wallet = JSON.parse(storedWallet);
            return { address: wallet.address, key: wallet.jwk };
        } catch (error) {
            console.error('Error parsing stored Arweave wallet:', error);
        }
    }
    return await generateArweaveWallet();
}

export async function importArweaveWallet(jwk: any): Promise<WalletInfo> {
    const arweave = Arweave.init({
        host: 'arweave.net',
        port: 443,
        protocol: 'https',
    });

    try {
        const address = await arweave.wallets.jwkToAddress(jwk);
        localStorage.setItem('arweave_wallet', JSON.stringify({ address, jwk }));
        return { address, key: jwk };
    } catch (error) {
        console.error('Error importing Arweave wallet:', error);
        throw new Error('Invalid wallet key file. Please check the format and try again.');
    }
}

export async function uploadToArweave(content: string, documentId?: string, title?: string): Promise<UploadResult> {
    try {
        const storedWallet = localStorage.getItem('arweave_wallet');
        if (!storedWallet) {
            return {
                transactionId: '',
                success: false,
                error: 'No wallet found. Please generate a wallet first.',
            };
        }

        const wallet = JSON.parse(storedWallet);
        const jwk = wallet.jwk;

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, documentId, title, jwk }),
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                transactionId: '',
                success: false,
                error: result.error || 'Upload failed',
            };
        }

        return { transactionId: result.transactionId, success: true };
    } catch (error) {
        console.error('Upload error:', error);
        return {
            transactionId: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

export async function loadFromArweave(transactionId: string): Promise<LoadResult> {
    try {
        const response = await fetch(`/api/load?transactionId=${encodeURIComponent(transactionId)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                content: '',
                success: false,
                error: result.error || 'Load failed',
            };
        }

        return {
            content: result.content,
            success: true,
            fromRedis: result.fromRedis,
            published: result.published,
        };
    } catch (error) {
        console.error('Load error:', error);
        return {
            content: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

export function clearWallet(): void {
    localStorage.removeItem('arweave_wallet');
}

export function getArweaveWalletAddress(): string | null {
    const storedWallet = localStorage.getItem('arweave_wallet');
    if (storedWallet) {
        try {
            const wallet = JSON.parse(storedWallet);
            return wallet.address;
        } catch (error) {
            console.error('Error parsing stored Arweave wallet:', error);
        }
    }
    return null;
}

export function getSolanaWalletAddress(): string | null {
    return getArweaveWalletAddress();
}

export function getWalletFundingInstructions(): string {
    const address = getArweaveWalletAddress();
    if (!address) {
        return 'No wallet found. Please generate a wallet first.';
    }

    return `To fund your wallet for Arweave uploads:
1. Copy this wallet address: ${address}
2. Send at least 0.01 AR to this address
3. You can buy AR on exchanges like Binance, Gate.io, or use a faucet for testnet
4. Once funded, try uploading again

Note: Each upload costs a small amount of AR (usually < 0.001 AR)`;
}

export function encryptContent(content: string, password: string): string {
    try {
        return CryptoJS.AES.encrypt(content, password).toString();
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt content');
    }
}

export function decryptContent(encryptedContent: string, password: string): string {
    try {
        const decrypted = CryptoJS.AES.decrypt(encryptedContent, password);
        const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

        if (!decryptedString) {
            throw new Error('Invalid password or corrupted data');
        }

        return decryptedString;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt content. Please check your password.');
    }
}

