'use client'

import { useState, useRef, useEffect } from 'react'
import { Wallet, Copy, FileDown, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { importArweaveWallet } from '@/lib/arweave-utils'

interface AccountDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    walletAddress: string | null
    onWalletChange?: (newAddress: string) => void
}

export function AccountDetailsModal({
    isOpen,
    onClose,
    walletAddress,
    onWalletChange
}: AccountDetailsModalProps) {
    const [showImport, setShowImport] = useState(false)
    const [importKey, setImportKey] = useState('')
    const [isImporting, setIsImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const modalContentRef = useRef<HTMLDivElement>(null)

    // Close modal when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isOpen) return

            const target = event.target as HTMLElement
            // Close if clicking on the backdrop (the overlay)
            if (target.classList.contains('modal-backdrop') ||
                (modalContentRef.current && !modalContentRef.current.contains(target))) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const handleCopyWalletAddress = async () => {
        if (walletAddress) {
            try {
                await navigator.clipboard.writeText(walletAddress)
                toast.success('Wallet address copied to clipboard', { duration: 1000 })
            } catch (error) {
                toast.error('Failed to copy wallet address', { duration: 1000 })
            }
        }
    }

    const handleCopyWalletKey = async () => {
        try {
            const storedWallet = localStorage.getItem('arweave_wallet')
            if (!storedWallet) {
                toast.error('No wallet found', { duration: 1000 })
                return
            }

            const wallet = JSON.parse(storedWallet)
            const keyJson = JSON.stringify(wallet.jwk, null, 2)
            await navigator.clipboard.writeText(keyJson)
            toast.success('Wallet key copied to clipboard', { duration: 1000 })
        } catch (error) {
            toast.error('Failed to copy wallet key', { duration: 1000 })
        }
    }

    const handleDownloadWalletKey = () => {
        try {
            const storedWallet = localStorage.getItem('arweave_wallet')
            if (!storedWallet) {
                toast.error('No wallet found', { duration: 1000 })
                return
            }

            const wallet = JSON.parse(storedWallet)
            const keyJson = JSON.stringify(wallet.jwk, null, 2)
            const blob = new Blob([keyJson], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `arweave-wallet-${wallet.address.slice(0, 8)}.json`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
            toast.success('Wallet key downloaded', { duration: 1000 })
        } catch (error) {
            toast.error('Failed to download wallet key', { duration: 1000 })
        }
    }

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string
                const jwk = JSON.parse(content)
                await handleImportWallet(jwk)
            } catch (error) {
                toast.error('Invalid wallet key file. Please check the format.', { duration: 3000 })
            }
        }
        reader.readAsText(file)
    }

    const handleImportWallet = async (jwk?: any) => {
        setIsImporting(true)
        try {
            let walletKey = jwk

            // If no JWK provided, try to parse from importKey text
            if (!walletKey && importKey.trim()) {
                try {
                    walletKey = JSON.parse(importKey.trim())
                } catch {
                    toast.error('Invalid JSON format. Please paste a valid wallet key.', { duration: 3000 })
                    setIsImporting(false)
                    return
                }
            }

            if (!walletKey) {
                toast.error('Please provide a wallet key', { duration: 2000 })
                setIsImporting(false)
                return
            }

            // Validate JWK structure
            if (!walletKey.kty || !walletKey.n || !walletKey.e) {
                toast.error('Invalid wallet key format. Missing required fields.', { duration: 3000 })
                setIsImporting(false)
                return
            }

            const result = await importArweaveWallet(walletKey)
            toast.success('Wallet imported successfully!', { duration: 2000 })

            // Reset form
            setImportKey('')
            setShowImport(false)

            // Notify parent component
            if (onWalletChange) {
                onWalletChange(result.address)
            }

            // Reload page to update wallet address
            setTimeout(() => {
                window.location.reload()
            }, 500)
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Failed to import wallet',
                { duration: 3000 }
            )
        } finally {
            setIsImporting(false)
        }
    }

    const handlePasteKey = async () => {
        try {
            const text = await navigator.clipboard.readText()
            setImportKey(text)
        } catch (error) {
            toast.error('Failed to read from clipboard', { duration: 2000 })
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-backdrop"
            onClick={(e) => {
                // Close when clicking on backdrop
                if (e.target === e.currentTarget) {
                    onClose()
                }
            }}
        >
            <div
                ref={modalContentRef}
                className="bg-white rounded-lg p-6 w-96 max-w-md mx-4 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Wallet className="w-5 h-5" />
                        Account Details
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Wallet Address */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Wallet Address
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={walletAddress || 'No wallet found'}
                                readOnly
                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-mono text-sm"
                            />
                            {walletAddress && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyWalletAddress}
                                    className="flex-shrink-0"
                                    title="Copy address"
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Wallet Key Actions */}
                    {walletAddress && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Wallet Key File (JWK)
                            </label>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyWalletKey}
                                    className="flex-1"
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Key
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownloadWalletKey}
                                    className="flex-1"
                                >
                                    <FileDown className="w-4 h-4 mr-2" />
                                    Download Key
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                ⚠️ Keep your wallet key file secure. Anyone with access to this file can control your wallet.
                            </p>
                        </div>
                    )}

                    {/* Import/Change Wallet Section */}
                    <div className="border-t pt-4">
                        {!showImport ? (
                            <Button
                                variant="outline"
                                onClick={() => setShowImport(true)}
                                className="w-full"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Import/Change Wallet
                            </Button>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Import Wallet Key
                                    </label>
                                    <button
                                        onClick={() => {
                                            setShowImport(false)
                                            setImportKey('')
                                        }}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-1"
                                        >
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload File
                                        </Button>
                                        {/* <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePasteKey}
                                            className="flex-1"
                                        >
                                            <Copy className="w-4 h-4 mr-2" />
                                            Paste Key
                                        </Button> */}
                                    </div>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json,application/json"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    <textarea
                                        value={importKey}
                                        onChange={(e) => setImportKey(e.target.value)}
                                        placeholder="Paste wallet key JSON here or upload a file..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-mono text-xs min-h-[120px] resize-none"
                                    />
                                </div>

                                <Button
                                    onClick={() => handleImportWallet()}
                                    disabled={isImporting || !importKey.trim()}
                                    className="w-full"
                                >
                                    {isImporting ? 'Importing...' : 'Import Wallet'}
                                </Button>

                                <p className="text-xs text-gray-500">
                                    ⚠️ Importing a new wallet will replace your current wallet. Make sure you have backed up your current wallet key before proceeding.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Close Button */}
                    <div className="flex gap-2 justify-end pt-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

