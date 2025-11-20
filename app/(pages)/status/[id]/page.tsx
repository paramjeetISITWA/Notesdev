'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Copy, CheckCircle, AlertCircle, Loader2, ExternalLink, Globe, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface PublishStatus {
    transactionId: string
    published: boolean
    wallet?: string
    timestamp?: string
}

interface RawData {
    [key: string]: any
}

export default function StatusPage() {
    const params = useParams()
    const router = useRouter()
    const id = params?.id as string
    const [status, setStatus] = useState<PublishStatus | null>(null)
    const [rawData, setRawData] = useState<RawData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [showRawData, setShowRawData] = useState(false)

    // Check publish status
    const checkPublishStatus = useCallback(async () => {
        if (!id) return

        try {
            const response = await fetch(`/api/check-publish?transactionId=${encodeURIComponent(id)}`)
            const result = await response.json()

            if (result.success) {
                setStatus({
                    transactionId: id,
                    published: result.published,
                    timestamp: new Date().toISOString()
                })
                setIsLoading(false)
            } else {
                setError(result.error || 'Failed to check status')
                setIsLoading(false)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to check status')
            setIsLoading(false)
        }
    }, [id])

    // Load raw data
    const loadRawData = useCallback(async () => {
        if (!id) return

        try {
            const response = await fetch(`/api/load?transactionId=${encodeURIComponent(id)}`)
            const result = await response.json()

            if (result.success && result.content) {
                try {
                    const parsed = JSON.parse(result.content)
                    setRawData(parsed)
                } catch {
                    setRawData({ raw: result.content })
                }
            }
        } catch (err) {
            console.error('Failed to load raw data:', err)
        }
    }, [id])

    // Initial check and periodic polling
    useEffect(() => {
        if (!id) {
            setError('Invalid transaction ID')
            setIsLoading(false)
            return
        }

        checkPublishStatus()

        // Poll every 5 seconds if not published
        const interval = setInterval(() => {
            if (!status?.published) {
                checkPublishStatus()
            }
        }, 5000)

        return () => clearInterval(interval)
    }, [id, checkPublishStatus, status?.published])

    // Load raw data when showing raw data
    useEffect(() => {
        if (showRawData && !rawData) {
            loadRawData()
        }
    }, [showRawData, rawData, loadRawData])

    // Copy to clipboard
    const handleCopy = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }, [])

    // Handle globe icon click - redirect to document page
    const handleGlobeClick = useCallback(() => {
        router.push(`/document/${id}`)
    }, [router, id])


    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.back()}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">Document Publishing Status</h1>
                    <p className="text-muted-foreground">Track your document's publication on Arweave</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Status Card */}
                        <Card className="p-6">
                            <div className="flex items-start gap-4">
                                <div>
                                    {isLoading && !status?.published ? (
                                        <div className="flex items-center gap-3">
                                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                            <div>
                                                <h2 className="text-lg font-semibold">Publishing to Arweave...</h2>
                                                <p className="text-sm text-muted-foreground">Usually takes 20-25 minutes</p>
                                            </div>
                                        </div>
                                    ) : status?.published ? (
                                        <div className="flex items-center gap-3">
                                            <CheckCircle className="w-8 h-8 text-green-500" />
                                            <div>
                                                <h2 className="text-lg font-semibold">Published Successfully!</h2>
                                                <p className="text-sm text-muted-foreground">Your document is now permanently stored on Arweave</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="w-8 h-8 text-yellow-500" />
                                            <div>
                                                <h2 className="text-lg font-semibold">Pending Publication</h2>
                                                <p className="text-sm text-muted-foreground">Checking status...</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Transaction Details */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-4">Transaction Details</h3>
                            <div className="space-y-4">
                                {/* Transaction ID */}
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
                                    <div className="flex items-center gap-2 mt-2">
                                        <code className="flex-1 bg-muted p-3 rounded-md text-sm break-all">
                                            {id}
                                        </code>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-shrink-0"
                                            onClick={() => handleCopy(id)}
                                        >
                                            <Copy className="w-4 h-4" />
                                            {copied ? 'Copied!' : 'Copy'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Arweave URL */}
                                {/* {status?.published && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Arweave URL</label>
                                        <div className="flex items-center gap-2 mt-2">
                                            <code className="flex-1 bg-muted p-3 rounded-md text-sm break-all">
                                                /{id}
                                            </code>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => window.open(`https://arweave.net/${id}`, '_blank')}
                                                className="flex-shrink-0"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )} */}

                                {/* Wallet Address */}
                                {/* {status?.wallet && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Wallet Address</label>
                                        <div className="flex items-center gap-2 mt-2">
                                            <code className="flex-1 bg-muted p-3 rounded-md text-sm break-all">
                                                {status.wallet}
                                            </code>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-shrink-0"
                                                onClick={() => status.wallet && handleCopy(status.wallet)}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )} */}
                            </div>

                            {status?.published && (
                                <>
                                    <h3 className="text-lg font-semibold mb-4">Actions</h3>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button
                                            onClick={() => window.open(`https://viewblock.io/arweave/tx/${id}`, '_blank')}
                                            className="flex-1"
                                        >
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            View on Arweave
                                        </Button>
                                        <Button
                                            onClick={() => setShowRawData(!showRawData)}
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            {showRawData ? 'Hide' : 'View'} Raw Data
                                        </Button>
                                        <Button
                                            onClick={handleGlobeClick}
                                            variant="outline"
                                            className="flex-1"
                                            title="View Document"
                                        >
                                            <Globe className="w-4 h-4 mr-2" />
                                            View Document
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Card>

                        {/* Action Buttons */}
                        {/* {status?.published && (
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold mb-4">Actions</h3>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        onClick={() => window.open(`https://viewblock.io/arweave/tx/${id}`, '_blank')}
                                        className="flex-1"
                                    >
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        View on Arweave
                                    </Button>
                                    <Button
                                        onClick={() => setShowRawData(!showRawData)}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        {showRawData ? 'Hide' : 'View'} Raw Data
                                    </Button>
                                    <Button
                                        onClick={handleGlobeClick}
                                        variant="outline"
                                        className="flex-1"
                                        title="View Document"
                                    >
                                        <Globe className="w-4 h-4 mr-2" />
                                        View Document
                                    </Button>
                                </div>
                            </Card>
                        )} */}

                        {/* Raw Data Display */}
                        {showRawData && (
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold mb-4">Raw JSON Data</h3>
                                {rawData ? (
                                    <div className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs font-mono">
                                        <pre>{JSON.stringify(rawData, null, 2)}</pre>
                                    </div>
                                ) : (
                                    <div className="bg-muted p-4 rounded-md text-sm text-muted-foreground">
                                        Loading raw data...
                                    </div>
                                )}
                            </Card>
                        )}

                        {/* Arweave Information */}
                        <Card className="p-6 bg-blue-50 dark:bg-blue-950">
                            <h3 className="text-lg font-semibold mb-3">About Arweave</h3>
                            <p className="text-sm text-foreground/90 leading-relaxed">
                                Arweave is a blockchain-based storage network that ensures your documents are permanently stored and accessible.
                                Unlike traditional storage, Arweave provides permanent, immutable, and censorship-resistant data storage.
                                Your document will be retrievable indefinitely at the Arweave URL above.
                            </p>
                        </Card>


                    </div>

                    {/* Sidebar - Advertisement Placeholders */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Ad Slot 1 */}
                        <Card className="p-6 bg-muted flex items-center justify-center min-h-64">
                            <div className="text-center">
                                <div className="text-sm font-semibold text-muted-foreground mb-2">Advertisement</div>
                                <div className="text-xs text-muted-foreground">Advertisement space available</div>
                            </div>
                        </Card>

                        {/* Ad Slot 2 */}
                        <Card className="p-6 bg-muted flex items-center justify-center min-h-48">
                            <div className="text-center">
                                <div className="text-sm font-semibold text-muted-foreground mb-2">Advertisement</div>
                                <div className="text-xs text-muted-foreground">Advertisement space available</div>
                            </div>
                        </Card>

                        {/* Status Info Box */}
                        <Card className="p-4 border-primary">
                            <h4 className="font-semibold text-sm mb-2">Publishing Status</h4>
                            <div className="text-xs space-y-1">
                                <p className="flex justify-between">
                                    <span className="text-muted-foreground">Status:</span>
                                    <span className="font-medium">
                                        {status?.published ? '✓ Published' : '○ Processing'}
                                    </span>
                                </p>
                                {status?.timestamp && (
                                    <p className="flex justify-between">
                                        <span className="text-muted-foreground">Updated:</span>
                                        <span className="font-medium">
                                            {new Date(status.timestamp).toLocaleTimeString()}
                                        </span>
                                    </p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}

