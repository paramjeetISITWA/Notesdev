"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Editor from "@/app/components/editor"
import Sidebar from "@/app/components/sidebar"
import { useEditorContext } from '@/hooks/use-editor-context'
import { loadFromArweave } from '@/lib/arweave-utils'
import toast from "react-hot-toast"
import CryptoJS from 'crypto-js'
import { PasswordPromptPopup } from '@/components/tiptap-ui/password-prompt-popup/password-prompt-popup'

export default function DocumentPage() {
    const params = useParams()
    const router = useRouter()
    const transactionId = params.id as string
    const { editor } = useEditorContext()
    const [content, setContent] = useState("")
    const [isEditorSidebarOpen, setIsEditorSidebarOpen] = useState(false)
    const editorRef = useRef<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
    const [encryptedContent, setEncryptedContent] = useState<string | null>(null)
    const [loadedContent, setLoadedContent] = useState<string | null>(null)
    const [dataSource, setDataSource] = useState<'api' | 'redis' | null>(null)
    const hasLoadedFromUrl = useRef(false)

    const toggleEditorSidebar = useCallback(() => {
        setIsEditorSidebarOpen(!isEditorSidebarOpen)
    }, [isEditorSidebarOpen])

    const closeEditorSidebar = () => {
        setIsEditorSidebarOpen(false)
    }

    useEffect(() => {
        const loadDocument = async () => {
            if (!transactionId) {
                setError('Invalid transaction ID')
                setIsLoading(false)
                return
            }

            // Reset the flag when loading a new document
            hasLoadedFromUrl.current = false
            setIsLoading(true)
            setError(null)

            try {
                const result = await loadFromArweave(transactionId)

                if (result.success) {
                    // Track data source: API (Arweave) = green, Redis = not green, localStorage = not green
                    if (result.fromRedis === false) {
                        // Loaded from Arweave API (not Redis)
                        setDataSource('api')
                    } else if (result.fromRedis === true) {
                        // Loaded from Redis
                        setDataSource('redis')
                    } else {
                        // Fallback to api if not specified
                        setDataSource('api')
                    }

                    // Check if content is encrypted
                    try {
                        const parsedContent = JSON.parse(result.content)

                        // Check if it's password protected (new format)
                        if (parsedContent && parsedContent.password === 1) {
                            // Content is encrypted, show password prompt
                            setEncryptedContent(result.content)
                            setShowPasswordPrompt(true)
                            setIsLoading(false)
                            return
                        }

                        // Content is not encrypted, load it directly
                        setLoadedContent(result.content)
                    } catch {
                        // If not JSON, try to load as plain text/HTML
                        setLoadedContent(result.content)
                    }

                    // If loaded from Redis (not yet published), check publish status in background
                    if (result.fromRedis && !result.published) {
                        // Check publish status after a delay
                        setTimeout(async () => {
                            try {
                                const checkResponse = await fetch(`/api/check-publish?transactionId=${transactionId}`)
                                const checkResult = await checkResponse.json()
                                if (checkResult.published) {
                                    // Update data source to API when published
                                    setDataSource('api')
                                }
                            } catch (error) {
                                console.error('Error checking publish status:', error)
                            }
                        }, 5000) // Check after 5 seconds
                    }
                } else {
                    setError(result.error || 'Failed to load document')
                    toast.error(`Load failed: ${result.error}`)
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to load document'
                setError(errorMessage)
                toast.error('Failed to load content from Arweave')
            } finally {
                setIsLoading(false)
            }
        }

        loadDocument()
    }, [transactionId])

    // Load content into editor when both editor and content are ready
    useEffect(() => {
        if (!editor || !loadedContent || hasLoadedFromUrl.current) return

        // Add a small delay to ensure editor is fully ready (same as main page)
        const timer = setTimeout(() => {
            loadContentToEditor(loadedContent)
            hasLoadedFromUrl.current = true
        }, 200)

        return () => clearTimeout(timer)
    }, [editor, loadedContent])

    const loadContentToEditor = (content: string) => {
        if (!editor) return

        try {
            // Try to parse as JSON first
            const parsedContent = JSON.parse(content)

            // If it's an object with a 'data' field, extract just the data
            if (parsedContent && typeof parsedContent === 'object' && parsedContent.data) {
                editor.commands.setContent(parsedContent.data)
                toast.success('Content loaded successfully!')
            } else if (parsedContent && typeof parsedContent === 'object' && parsedContent.type === 'doc') {
                // If it's editor JSON format, use it directly
                editor.commands.setContent(parsedContent)
                toast.success('Content loaded successfully!')
            } else {
                // Check if it has metadata fields to strip
                if (parsedContent && typeof parsedContent === 'object' && parsedContent.password !== undefined) {
                    const { password: _p, passwordProtected: _pp, timestamp: _t, previousTransactionId: _ptx, ...cleanContent } = parsedContent
                    editor.commands.setContent(cleanContent as any)
                    toast.success('Content loaded successfully!')
                } else {
                    // If it's already the editor content, use it directly
                    editor.commands.setContent(parsedContent)
                    toast.success('Content loaded successfully!')
                }
            }
            // Clear loaded content after successful load
            setLoadedContent(null)
        } catch (error) {
            // If not JSON, try to set as HTML or plain text
            editor.commands.setContent(content)
            toast.success('Content loaded successfully!')
            // Clear loaded content after successful load
            setLoadedContent(null)
        }
    }


    const handlePasswordConfirm = (password: string) => {
        if (!encryptedContent || !editor) {
            toast.error('Failed to decrypt content')
            return
        }

        try {
            // Parse the encrypted content wrapper
            const parsedContent = JSON.parse(encryptedContent)

            if (parsedContent && parsedContent.encrypted === true && parsedContent.content) {
                // Decrypt the content field
                const decryptedEditorContent = CryptoJS.AES.decrypt(parsedContent.content, password).toString(CryptoJS.enc.Utf8)

                if (!decryptedEditorContent) {
                    toast.error('Invalid password or corrupted data')
                    return
                }

                // Parse and load the decrypted content
                try {
                    const parsedDecrypted = JSON.parse(decryptedEditorContent)
                    // Set loaded content instead of directly loading
                    setLoadedContent(JSON.stringify(parsedDecrypted))
                    toast.success('Content decrypted successfully!')
                    setShowPasswordPrompt(false)
                    setEncryptedContent(null)
                } catch {
                    // If not JSON, set as plain text
                    setLoadedContent(decryptedEditorContent)
                    toast.success('Content decrypted successfully!')
                    setShowPasswordPrompt(false)
                    setEncryptedContent(null)
                }
            } else {
                toast.error('Invalid encrypted content format')
            }
        } catch (error) {
            toast.error('Failed to decrypt content. Please check your password.')
        }
    }


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 animate-pulse">Loading document from Arweave...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="text-red-600 text-2xl mb-4">⚠️</div>
                    <h2 className="text-xl font-semibold mb-2">Failed to Load Document</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="block">

                <Editor
                    ref={editorRef}
                    content={content}
                    setContent={setContent}
                    onSidebarToggle={toggleEditorSidebar}
                    dataSource={dataSource}
                    transactionId={transactionId}
                />
                {/* <Header /> */}
            </div>
            <Sidebar
                isOpen={isEditorSidebarOpen}
                onClose={closeEditorSidebar}
            />

            {/* Password Prompt Popup */}
            <PasswordPromptPopup
                isOpen={showPasswordPrompt}
                onClose={() => {
                    setShowPasswordPrompt(false)
                    setEncryptedContent(null)
                }}
                onConfirm={handlePasswordConfirm}
                versionNumber={0}
            />
        </>
    )
}

