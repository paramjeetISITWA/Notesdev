"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    SearchIcon,
    SignalIcon as SignInIcon,
    ChevronDownIcon,
    SunIcon,
    XIcon,
    Clock,
    Globe,
    Copy as CopyIcon,
    Wallet as WalletIcon,
} from "lucide-react"

import { getArweaveWalletAddress } from '@/lib/arweave-utils'

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
    onLoadVersion?: (versionNumber: number) => void
    onLoadDocument?: (documentId: string) => void
}

interface PendingTransaction {
    txId: string
    documentId?: string
    title?: string
    savedAt: string
}

interface PublishedTransaction {
    txId: string
    blockTimestamp?: number | null
    blockHeight?: number | null
    arweaveUrl: string
    tags: Record<string, string>
}

type TransactionListItem =
    | { kind: 'pending'; tx: PendingTransaction }
    | { kind: 'published'; tx: PublishedTransaction }

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")
    const [walletAddress, setWalletAddress] = useState<string | null>(null)
    const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([])
    const [publishedTransactions, setPublishedTransactions] = useState<PublishedTransaction[]>([])
    const [transactionsLoading, setTransactionsLoading] = useState(false)
    const [transactionsError, setTransactionsError] = useState<string | null>(null)
    const [walletCopyState, setWalletCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

    useEffect(() => {
        const address = getArweaveWalletAddress()
        setWalletAddress(address)
    }, [])

    useEffect(() => {
        if (!walletAddress || !isOpen) {
            if (!walletAddress) {
                setPendingTransactions([])
                setPublishedTransactions([])
                setWalletCopyState('idle')
            }
            setTransactionsLoading(false)
            setTransactionsError(null)
            return
        }

        const currentWalletAddress = walletAddress

        let isActive = true
        const controller = new AbortController()

        async function fetchTransactions() {
            setTransactionsLoading(true)
            setTransactionsError(null)

            try {
                const response = await fetch(`/api/user/txids?walletAddress=${encodeURIComponent(currentWalletAddress)}&limit=25`, {
                    signal: controller.signal,
                })

                if (!response.ok) {
                    const text = await response.text()
                    throw new Error(text || 'Failed to load transactions')
                }

                const data = await response.json()
                if (!isActive) {
                    return
                }

                setPendingTransactions(data.pendingTransactions ?? [])
                setPublishedTransactions(data.publishedTransactions ?? [])
            } catch (error) {
                if (!isActive || (error instanceof DOMException && error.name === 'AbortError')) {
                    return
                }
                console.error('Failed to load wallet transactions:', error)
                setTransactionsError(error instanceof Error ? error.message : 'Failed to load wallet transactions')
            } finally {
                if (isActive) {
                    setTransactionsLoading(false)
                }
            }
        }

        fetchTransactions()

        return () => {
            isActive = false
            controller.abort()
        }
    }, [walletAddress, isOpen])

    const handleTransactionClick = (transactionId: string) => {
        router.push(`/document/${transactionId}`)
        onClose()
    }

    const formatTxId = (txId: string) => {
        if (txId.length <= 12) {
            return txId
        }
        return `${txId.slice(0, 6)}...${txId.slice(-6)}`
    }

    const formatSavedAt = (timestamp?: string) => {
        if (!timestamp) {
            return 'Unknown'
        }
        const date = new Date(timestamp)
        if (Number.isNaN(date.getTime())) {
            return 'Unknown'
        }
        return date.toLocaleString()
    }

    const formatBlockTimestamp = (timestamp?: number | null) => {
        if (!timestamp) {
            return 'Unknown'
        }
        const date = new Date(timestamp * 1000)
        if (Number.isNaN(date.getTime())) {
            return 'Unknown'
        }
        return date.toLocaleString()
    }

    const handleCopyWalletAddress = async () => {
        if (!walletAddress) {
            return
        }
        try {
            if (navigator?.clipboard) {
                await navigator.clipboard.writeText(walletAddress)
            } else {
                const textarea = document.createElement('textarea')
                textarea.value = walletAddress
                textarea.style.position = 'fixed'
                textarea.style.opacity = '0'
                document.body.appendChild(textarea)
                textarea.focus()
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
            }
            setWalletCopyState('copied')
            setTimeout(() => setWalletCopyState('idle'), 2000)
        } catch (error) {
            console.error('Failed to copy wallet address:', error)
            setWalletCopyState('error')
            setTimeout(() => setWalletCopyState('idle'), 2000)
        }
    }

    const getPublishedTitle = (tx: PublishedTransaction) => {
        const tagPriority = ['Title', 'title', 'Document-Title', 'document-title', 'Document-ID', 'document-id', 'App', 'app', 'Name', 'name']
        for (const key of tagPriority) {
            const value = tx.tags?.[key]
            if (value && typeof value === 'string') {
                return value
            }
        }
        return 'Published transaction'
    }

    const transactionItems = useMemo<TransactionListItem[]>(() => {
        const pendingList = [...pendingTransactions]
            .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
            .map((tx) => ({ kind: 'pending' as const, tx }))

        const publishedList = [...publishedTransactions]
            .sort((a, b) => {
                const aTime = a.blockTimestamp ?? 0
                const bTime = b.blockTimestamp ?? 0
                return bTime - aTime
            })
            .map((tx) => ({ kind: 'published' as const, tx }))

        return [...pendingList, ...publishedList]
    }, [pendingTransactions, publishedTransactions])

    const filteredTransactions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) {
            return transactionItems
        }

        return transactionItems.filter((item) => {
            const title = item.kind === 'pending'
                ? (item.tx.title?.trim() || 'Untitled document')
                : getPublishedTitle(item.tx)

            return title.toLowerCase().includes(query) || item.tx.txId.toLowerCase().includes(query)
        })
    }, [transactionItems, searchQuery])

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-gray-200 bg-opacity-50 z-99"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed left-0 top-0 w-80 bg-white border-r border-gray-200 flex flex-col h-screen z-99 transform transition-transform duration-300 ease-in-out  ${isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                {/* Close Button */}
                <div className="flex justify-end p-4 border-b border-gray-200">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Close Sidebar"
                    >
                        <XIcon className="w-5 h-5 text-gray-700" />
                    </button>
                </div>

                {/* Search & Wallet Info */}
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search transactions"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                </div>

                {/* Transactions List */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 space-y-4">
                        {!walletAddress && (
                            <p className="text-sm text-gray-500">
                                Import or generate an Arweave wallet to see your uploads.
                            </p>
                        )}

                        {walletAddress && (
                            <>
                                {transactionsLoading && (
                                    <p className="text-sm text-gray-500">Loading transactions...</p>
                                )}

                                {transactionsError && (
                                    <p className="text-sm text-red-500">{transactionsError}</p>
                                )}

                                {!transactionsLoading && !transactionsError && filteredTransactions.length === 0 && (
                                    <p className="text-sm text-gray-500">
                                        {searchQuery.trim()
                                            ? 'No transactions match your search.'
                                            : 'No transactions found yet.'}
                                    </p>
                                )}

                                {!transactionsLoading && !transactionsError && filteredTransactions.length > 0 && (
                                    <div className="space-y-2">
                                        {filteredTransactions.map((item) => {
                                            const title = item.kind === 'pending'
                                                ? (item.tx.title?.trim() || 'Untitled document')
                                                : getPublishedTitle(item.tx)
                                            const timestampLabel = item.kind === 'pending'
                                                ? formatSavedAt(item.tx.savedAt)
                                                : formatBlockTimestamp(item.tx.blockTimestamp)
                                            const statusLabel = item.kind === 'pending' ? 'Pending' : 'Published'
                                            const iconClasses = item.kind === 'pending'
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-emerald-100 text-emerald-700'
                                            const IconComponent = item.kind === 'pending' ? Clock : Globe

                                            return (
                                                <button
                                                    key={`${item.kind}-${item.tx.txId}`}
                                                    className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                                    onClick={() => handleTransactionClick(item.tx.txId)}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="text-sm font-semibold text-gray-900">
                                                                {title}
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {statusLabel} • {timestampLabel}
                                                            </div>
                                                            <div className="text-[11px] text-gray-400 font-mono mt-2">
                                                                {formatTxId(item.tx.txId)}
                                                            </div>
                                                        </div>
                                                        <div className={`p-2 rounded-full ${iconClasses}`}>
                                                            <IconComponent className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="border-t border-gray-200 p-4 space-y-3">
                    {walletAddress && (
                        <div className="mt-4 rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-sm p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                        <WalletIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                                            Active Wallet
                                        </p>
                                        <p className="text-xs font-mono text-gray-800 mt-0.5">
                                            {formatTxId(walletAddress)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopyWalletAddress}
                                    className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
                                    title="Copy wallet address"
                                    aria-label="Copy wallet address"
                                >
                                    <CopyIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="mt-2 h-px bg-gray-100" />
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
                                {walletCopyState === 'copied' && (
                                    <span className="text-emerald-600 font-semibold">Copied to clipboard</span>
                                )}
                                {walletCopyState === 'error' && (
                                    <span className="text-red-600 font-semibold">Copy failed</span>
                                )}
                                {walletCopyState === 'idle' && (
                                    <span>Tap copy to use this address elsewhere</span>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Accessibility">
                            <span className="text-xs font-semibold text-gray-600">A</span>
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Theme">
                            <SunIcon className="w-4 h-4 text-gray-700" />
                        </button>
                        <button className="flex items-center gap-1 ml-auto px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors">
                            Legal
                            <ChevronDownIcon className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
