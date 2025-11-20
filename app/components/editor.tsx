"use client"
import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Save,
  Download,
  Wallet,
  Plus,
  Menu,
  MoreVertical,
  Copy,
  Globe,
  Home,
  Share2,
} from "lucide-react"
import toast from "react-hot-toast"

import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { VersionDropdownButton } from '@/components/tiptap-ui/version-dropdown-button/version-dropdown-button'
import { PasswordPopup } from '@/components/tiptap-ui/password-popup/password-popup'
import { PasswordPromptPopup } from '@/components/tiptap-ui/password-prompt-popup/password-prompt-popup'
import { AccountDetailsModal } from '@/app/components/account-details-modal'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/tiptap-ui-primitive/dropdown-menu/dropdown-menu'
import { usePathname, useRouter } from 'next/navigation'
import {
  loadOrCreateArweaveWallet,
  uploadToArweave,
  loadFromArweave,
  getArweaveWalletAddress,
  getWalletFundingInstructions,
} from '@/lib/arweave-utils'
import {
  createDocumentRecord,
  addDocumentVersionRecord,
  getVersionContent,
  getVersionContentWithPassword,
  getLatestVersionContent,
  getAllPreviousTransactionIds,
} from '@/lib/document-utils'
import { fetchDocumentsForWallet, saveDocumentsForWallet } from '@/lib/document-service'
import type { Document, DocumentVersion } from '@/lib/types/document'
import { useEditorContext } from '@/hooks/use-editor-context'
import CryptoJS from 'crypto-js';


interface EditorProps {
  content: string
  setContent: (content: string) => void
  onSidebarToggle?: () => void
  dataSource?: 'api' | 'redis' | null
  transactionId?: string
}

export interface EditorRef {
  loadFromVersion: (versionNumber: number) => void
  loadDocument: (documentId: string) => void
}

const Editor = forwardRef<EditorRef, EditorProps>(({ content, setContent, onSidebarToggle, dataSource: propDataSource, transactionId }, ref) => {
  const [isSaved, setIsSaved] = useState(true)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadTransactionId, setLoadTransactionId] = useState('')
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [documentTitle, setDocumentTitle] = useState('')
  const [showPasswordPopup, setShowPasswordPopup] = useState(false)
  const [showPasswordPromptPopup, setShowPasswordPromptPopup] = useState(false)
  const [promptVersionNumber, setPromptVersionNumber] = useState<number | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showAccountDetails, setShowAccountDetails] = useState(false)
  const [dataSource, setDataSource] = useState<'api' | 'redis' | null>(null)
  const [showIndicator, setShowIndicator] = useState(false)
  const { editor } = useEditorContext()
  const pathname = usePathname()
  const router = useRouter()
  const dropdownMenuRef = useRef<HTMLDivElement>(null)

  const persistDocuments = useCallback(async (nextDocuments: Document[], nextCurrentId: string | null) => {
    if (!walletAddress) {
      return
    }
    try {
      await saveDocumentsForWallet(walletAddress, nextDocuments, nextCurrentId)
    } catch (error) {
      console.error('Failed to sync documents to Redis:', error)
      toast.error('Failed to sync documents to Redis', { duration: 1500 })
    }
  }, [walletAddress])


  // Initialize wallet on mount
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const wallet = await loadOrCreateArweaveWallet()
        setWalletAddress(wallet.address)
      } catch (error) {
        toast.error('Failed to initialize Arweave wallet')
      }
    }

    initializeWallet()
  }, [])

  // Update wallet address display when it changes
  useEffect(() => {
    const currentAddress = getArweaveWalletAddress()
    if (currentAddress) {
      setWalletAddress(currentAddress)
    }
  }, [])

  useEffect(() => {
    if (!walletAddress) {
      setDocuments([])
      setCurrentDocument(null)
      setDocumentTitle('')
      return
    }

    let cancelled = false

    const loadDocumentsForWallet = async () => {
      try {
        const { documents: loadedDocuments, currentDocumentId } = await fetchDocumentsForWallet(walletAddress)
        if (cancelled) {
          return
        }

        setDocuments(loadedDocuments)
        const initialDocument = loadedDocuments.find(doc => doc.id === currentDocumentId) || loadedDocuments[0] || null
        setCurrentDocument(initialDocument || null)
        setDocumentTitle(initialDocument?.title || '')
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load documents from Redis:', error)
          toast.error('Failed to load documents from Redis', { duration: 1500 })
        }
      }
    }

    loadDocumentsForWallet()

    return () => {
      cancelled = true
    }
  }, [walletAddress])

  // Close dropdown menu when clicking outside (fallback for modal={false})
  useEffect(() => {
    if (!showMoreMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      // Find dropdown menu content (portaled by Radix)
      const menuElement = document.querySelector('[role="menu"]')

      // Check if click is inside the menu
      if (menuElement && menuElement.contains(target)) {
        return
      }

      // Check if click is on the trigger button or its parent
      if (dropdownMenuRef.current && dropdownMenuRef.current.contains(target)) {
        return
      }

      // Close menu if clicking outside
      setShowMoreMenu(false)
    }

    // Add listener with a delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMoreMenu])



  // const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  //   setContent(e.target.value)
  //   setIsSaved(false)
  // }

  // const handleSave = () => {
  //   setIsSaved(true)
  // }

  const handleSaveToArweave = () => {
    if (!editor) {
      toast.error('Editor not ready. Please wait for the editor to load.')
      return
    }

    if (isUploading) {
      return
    }

    // Show password popup first
    setShowPasswordPopup(true)
  }

  const handlePasswordPopupSave = async (password: string | null, titleFromPopup: string) => {
    if (!editor) {
      toast.error('Editor not ready. Please wait for the editor to load.')
      return
    }

    setIsUploading(true)
    try {
      // Get editor content as JSON
      const editorContent = editor.getJSON()

      // Get all previous transaction IDs from document history
      const previousTransactionIds = getAllPreviousTransactionIds(currentDocument)

      // Encrypt the complete editorContent if password is provided
      let contentString: string
      if (password) {
        // Encrypt the entire editorContent JSON
        const editorContentString = JSON.stringify(editorContent)
        const encryptedContent = CryptoJS.AES.encrypt(editorContentString, password).toString()

        // Wrap encrypted content with metadata
        const contentWithPassword = {
          encrypted: true,
          content: encryptedContent,
          password: 1,
          passwordProtected: true,
          timestamp: new Date().toISOString(),
          previousTransactionId: previousTransactionIds
        }
        contentString = JSON.stringify(contentWithPassword, null, 2)
      } else {
        // No password - add metadata to original content
        const contentWithPassword = {
          ...editorContent,
          password: 0,
          passwordProtected: false,
          timestamp: new Date().toISOString(),
          previousTransactionId: previousTransactionIds
        }
        contentString = JSON.stringify(contentWithPassword, null, 2)
      }

      // Check if this is a new document or existing document
      // A document is considered "new" if:
      // 1. No current document exists, OR
      // 2. The title has changed significantly (indicating user wants a new document)
      const effectiveTitle = titleFromPopup?.trim() || documentTitle?.trim()
      const normalizedTitle = effectiveTitle && effectiveTitle.length > 0 ? effectiveTitle : ''
      const titleForLocalDoc = normalizedTitle || 'Untitled Document'
      const titleForUpload = normalizedTitle || 'Untitled document'
      const isNewDocument = !currentDocument ||
        (currentDocument.title !== effectiveTitle && (effectiveTitle ?? '') !== '')

      let documentId: string

      if (isNewDocument) {
        const titleToCheck = titleForLocalDoc
        const existingDoc = documents.find(doc => doc.title === titleToCheck)

        if (existingDoc) {
          documentId = existingDoc.id
          setCurrentDocument(existingDoc)
          setDocumentTitle(existingDoc.title)
          await persistDocuments(documents, existingDoc.id)
        } else {
          const newDoc = createDocumentRecord(titleToCheck, contentString, {
            password: password || undefined,
            previousTransactionIds,
          })
          documentId = newDoc.id
          const updatedDocs = [...documents, newDoc]
          setDocuments(updatedDocs)
          setCurrentDocument(newDoc)
          setDocumentTitle(titleToCheck)
          await persistDocuments(updatedDocs, newDoc.id)
        }
      } else if (currentDocument) {
        documentId = currentDocument.id
      } else {
        documentId = `doc_${Date.now()}`
      }

      // Upload the entire document (with all versions) to Arweave
      const result = await uploadToArweave(contentString, documentId, titleForUpload)

      if (result.success) {
        if (isNewDocument) {
          const updatedDocs = documents.map(doc => {
            if (doc.id === documentId) {
              return {
                ...doc,
                arweaveTransactionId: result.transactionId,
                lastModified: new Date().toISOString(),
              }
            }
            return doc
          })
          setDocuments(updatedDocs)
          const updated = updatedDocs.find(doc => doc.id === documentId) || null
          if (updated) {
            setCurrentDocument(updated)
          }
          persistDocuments(updatedDocs, updated?.id || null)
        } else if (currentDocument) {
          const updatedDoc = addDocumentVersionRecord(
            currentDocument,
            contentString,
            {
              arweaveTransactionId: result.transactionId,
              password: password || undefined,
              previousTransactionIds,
            }
          )

          const updatedDocs = documents.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc)
          setDocuments(updatedDocs)
          setCurrentDocument(updatedDoc)
          persistDocuments(updatedDocs, updatedDoc.id)
        }

        toast.success(`Content saved to Arweave! Transaction ID: ${result.transactionId}`, { duration: 1000 })
        setIsSaved(true)

        // Redirect to document page with transaction ID
        if (result.transactionId) {
          // Small delay to ensure Redis save is complete
          setTimeout(() => {
            router.push(`/document/${result.transactionId}`)
          }, 500)
        }
      } else {
        // Check if it's a balance issue and show funding instructions
        if (result.error?.includes('Insufficient') || result.error?.includes('balance')) {
          toast.error(
            <div className="max-w-md">
              <div className="font-semibold mb-2">Insufficient AR Balance</div>
              <div className="text-sm whitespace-pre-line">
                To fund your wallet for Arweave uploads:
                1. Copy this wallet address: {walletAddress || 'N/A'}
                2. Send at least 0.01 AR to this address
                3. You can buy AR on exchanges like Binance, Gate.io, or use a faucet for testnet
                4. Once funded, try uploading again
              </div>
            </div>,
            { duration: 10000 }
          )
        } else {
          toast.error(`Upload failed: ${result.error}`, { duration: 1000 })
        }
      }
    } catch (error) {
      toast.error('Failed to save content to Arweave', { duration: 1000 })
    } finally {
      setIsUploading(false)
    }
  }

  const handleLoadFromArweave = async () => {
    if (!loadTransactionId.trim()) {
      toast.error('Please enter a transaction ID', { duration: 1000 })
      return
    }

    setIsLoading(true)
    try {
      const result = await loadFromArweave(loadTransactionId.trim())

      if (result.success) {
        // Track data source: API (Arweave) = green, Redis = not green
        if (result.fromRedis === false) {
          // Loaded from Arweave API (not Redis)
          setDataSource('api')
          setShowIndicator(true)
          // Hide indicator after 5 seconds
          setTimeout(() => setShowIndicator(false), 5000)
        } else if (result.fromRedis === true) {
          // Loaded from Redis
          setDataSource('redis')
          setShowIndicator(true)
          // Hide indicator after 5 seconds
          setTimeout(() => setShowIndicator(false), 5000)
        } else {
          // Fallback to api if not specified
          setDataSource('api')
          setShowIndicator(true)
          setTimeout(() => setShowIndicator(false), 5000)
        }

        try {
          // Try to parse as JSON first
          const parsedContent = JSON.parse(result.content)

          // If it's an object with a 'data' field, extract just the data
          if (parsedContent && typeof parsedContent === 'object' && parsedContent.data) {
            editor?.commands.setContent(parsedContent.data)
            toast.success('Content loaded successfully!')
          } else {
            // If it's already the editor content, use it directly
            editor?.commands.setContent(parsedContent)
            toast.success('Content loaded successfully!', { duration: 1000 })
          }
        } catch {
          // If not JSON, try to set as HTML
          editor?.commands.setContent(result.content)
          toast.success('Content loaded successfully!')
        }
        setShowLoadModal(false)
        setLoadTransactionId('')
        setShowMoreMenu(false)
      } else {
        toast.error(`Load failed: ${result.error}`, { duration: 1000 })
      }
    } catch (error) {
      toast.error('Failed to load content from Arweave', { duration: 1000 })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyShareLink = async () => {
    try {
      // Check if we're on a document page
      const isDocumentPage = pathname?.startsWith('/document/')
      if (isDocumentPage) {
        const transactionId = pathname.split('/document/')[1]
        if (transactionId) {
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          const shareUrl = `${origin}/document/${transactionId}`
          await navigator.clipboard.writeText(shareUrl)
          toast.success('Link copied to clipboard', { duration: 1000 })
        }
      } else {
        // If not on document page, copy the editor content as JSON
        if (editor) {
          const content = editor.getJSON()
          const contentString = JSON.stringify(content, null, 2)
          await navigator.clipboard.writeText(contentString)
          toast.success('Content copied to clipboard')
        } else {
          toast.error('Editor not ready', { duration: 1000 })
        }
      }
    } catch (e) {
      toast.error('Failed to copy', { duration: 1000 })
    } finally {
      setShowMoreMenu(false)
    }
  }

  const handleShare = async () => {
    try {
      // Check if we're on a document page
      const isDocumentPage = pathname?.startsWith('/document/')
      const isStatusPage = pathname?.startsWith('/status/')

      let shareUrl = ''
      let shareTitle = 'Document'

      if (isDocumentPage) {
        const transactionId = pathname.split('/document/')[1]
        if (transactionId) {
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          shareUrl = `${origin}/document/${transactionId}`
          shareTitle = 'View Document'
        }
      } else if (isStatusPage) {
        const transactionId = pathname.split('/status/')[1]
        if (transactionId) {
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          shareUrl = `${origin}/status/${transactionId}`
          shareTitle = 'Document Status'
        }
      } else {
        // If not on a specific page, use current URL
        shareUrl = typeof window !== 'undefined' ? window.location.href : ''
        shareTitle = 'Document Editor'
      }

      if (!shareUrl) {
        toast.error('No shareable link available', { duration: 2000 })
        return
      }

      // Try Web Share API first (mobile and modern browsers)
      if (navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: 'Check out this document',
            url: shareUrl,
          })
          toast.success('Shared successfully', { duration: 1500 })
        } catch (shareError: any) {
          // User cancelled or share failed, fall back to copy
          if (shareError.name !== 'AbortError') {
            throw shareError
          }
          return
        }
      } else {
        // Fallback to copying link
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Link copied to clipboard', { duration: 1500 })
      }
    } catch (e) {
      // If Web Share API fails, try copying as fallback
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        const currentPath = pathname || ''
        const shareUrl = `${origin}${currentPath}`
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Link copied to clipboard', { duration: 1500 })
      } catch (copyError) {
        toast.error('Failed to share', { duration: 2000 })
      }
    } finally {
      setShowMoreMenu(false)
    }
  }

  const handleMenuLoad = () => {
    setShowLoadModal(true)
  }

  const handleMenuSave = () => {
    handleSaveToArweave()
  }

  const handleShowAccountDetails = () => {
    setShowAccountDetails(true)
    setShowMoreMenu(false)
  }

  const handleWalletChange = (newAddress: string) => {
    setWalletAddress(newAddress)
  }

  const handleLoadFromVersion = (versionNumber: number) => {

    if (!currentDocument) {
      toast.error('No current document found', { duration: 1000 })
      return
    }

    if (!editor) {
      toast.error('Editor not ready. Please wait for the editor to load.', { duration: 1000 })
      return
    }

    // Check if version is password protected
    const version = currentDocument.versions.find(v => v.versionNumber === versionNumber)
    if (!version) {
      toast.error(`Version ${versionNumber} not found`, { duration: 1000 })
      return
    }

    if (version.password === 1) {
      // Version is password protected, show password prompt popup
      setPromptVersionNumber(versionNumber)
      setShowPasswordPromptPopup(true)
    } else {
      // Version is not password protected, load normally
      const storedContent = getVersionContent(currentDocument, versionNumber)
      if (storedContent) {
        loadVersionContent(storedContent, versionNumber)
      } else {
        toast.error(`Version ${versionNumber} content not found in document store`, { duration: 1000 })
      }
    }
  }

  const handlePasswordPromptConfirm = (password: string) => {
    if (!promptVersionNumber || !currentDocument) {
      toast.error('No version selected for decryption', { duration: 1000 })
      return
    }

    try {
      const decryptedContent = getVersionContentWithPassword(currentDocument, promptVersionNumber, password)
      if (decryptedContent) {
        loadVersionContent(decryptedContent, promptVersionNumber)
      } else {
        toast.error('Failed to decrypt version content')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to decrypt version')
    }
  }

  const loadVersionContent = (content: string, versionNumber: number) => {
    if (!editor) return

    // Track that this is from Redis document store
    setDataSource('redis')
    setShowIndicator(true)
    // Hide indicator after 5 seconds
    setTimeout(() => setShowIndicator(false), 5000)

    try {
      // Try to parse as JSON first
      const parsedContent = JSON.parse(content)

      // If it's an object with a 'data' field, extract just the data
      if (parsedContent && typeof parsedContent === 'object' && parsedContent.data) {
        editor.commands.setContent(parsedContent.data)
        toast.success(`Version ${versionNumber} loaded successfully!`, { duration: 1000 })
      } else if (parsedContent && typeof parsedContent === 'object' && parsedContent.type === 'doc') {
        // If it's editor JSON format, use it directly
        editor.commands.setContent(parsedContent)
        toast.success(`Version ${versionNumber} loaded successfully!`, { duration: 1000 })
      } else {
        // If it's already the editor content, use it directly
        editor.commands.setContent(parsedContent)
        toast.success(`Version ${versionNumber} loaded successfully!`, { duration: 1000 })
      }
    } catch (error) {
      // If not JSON, try to set as HTML or plain text
      editor.commands.setContent(content)
      toast.success(`Version ${versionNumber} loaded successfully!`, { duration: 1000 })
    }

    // Update the current document to reflect the selected version
    if (currentDocument) {
      const updatedDoc: Document = {
        ...currentDocument,
        currentVersionNumber: versionNumber,
      }
      const updatedDocs = documents.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc)
      setCurrentDocument(updatedDoc)
      setDocumentTitle(updatedDoc.title)
      setDocuments(updatedDocs)
      persistDocuments(updatedDocs, updatedDoc.id)
    }
  }

  const handleLoadDocument = (documentId: string) => {
    // Get the document and update current document
    const doc = documents.find((d) => d.id === documentId)
    if (doc) {
      setCurrentDocument(doc)
      setDocumentTitle(doc.title)
      persistDocuments(documents, doc.id)

      // If latest version is password protected, prompt immediately
      const latest = doc.versions?.[0]
      if (latest) {
        // Primary check using explicit flag
        if (latest.password === 1) {
          setPromptVersionNumber(latest.versionNumber)
          setShowPasswordPromptPopup(true)
          return
        }
        // Fallback: detect new encrypted wrapper format
        try {
          const parsed = JSON.parse(latest.content)
          if (parsed && parsed.encrypted === true && typeof parsed.content === 'string') {
            setPromptVersionNumber(latest.versionNumber)
            setShowPasswordPromptPopup(true)
            return
          }
        } catch {
          // not JSON, continue with normal flow
        }
      }
    }

    const latestContent = doc ? getLatestVersionContent(doc) : null

    // Track that this is from Redis
    setDataSource('redis')
    setShowIndicator(true)
    // Hide indicator after 5 seconds
    setTimeout(() => setShowIndicator(false), 5000)

    if (!editor) {
      toast.error('Editor not ready. Please wait for the editor to load.')
      return
    }

    if (latestContent) {
      // Add a small delay to ensure editor is fully ready
      setTimeout(() => {
        try {
          // Try to parse as JSON first
          const parsedContent = JSON.parse(latestContent)

          // If it's an object with a 'data' field, extract just the data
          if (parsedContent && typeof parsedContent === 'object' && parsedContent.data) {
            editor.commands.setContent(parsedContent.data)
            toast.success('Document loaded successfully!', { duration: 1000 })
          } else if (parsedContent && typeof parsedContent === 'object' && parsedContent.type === 'doc') {
            // If it's editor JSON format, use it directly
            editor.commands.setContent(parsedContent)
            toast.success('Document loaded successfully!', { duration: 1000 })
          } else {
            // If it's already the editor content, use it directly
            editor.commands.setContent(parsedContent)
            toast.success('Document loaded successfully!', { duration: 1000 })
          }
        } catch (error) {
          // If not JSON, try to set as HTML or plain text
          editor.commands.setContent(latestContent)
          toast.success('Document loaded successfully!', { duration: 1000 })
        }
      }, 200)
    } else {
      toast.error('Document content not found in Redis storage', { duration: 1000 })
    }
  }

  const handleNewDocument = () => {
    setCurrentDocument(null)
    setDocumentTitle('')
    editor?.commands.setContent('')
    persistDocuments(documents, null)
  }

  // Expose functions to parent components
  useImperativeHandle(ref, () => {
    return {
      loadFromVersion: handleLoadFromVersion,
      loadDocument: handleLoadDocument
    }
  })

  return (
    <div className="w-full mx-auto bg-white notesbox">

      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-2 md:p-0">
        <div className="flex items-center md:absolute z-[100] top-[4px] left-[4px]">


          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900 cursor-pointer"
            onClick={onSidebarToggle}
            title="Show Documents"
          >
            <Menu className="w-8 h-8 text-xl" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900 cursor-pointer"
            onClick={() => router.push('/')}
            title="Home"
          >
            <Home className="w-8 h-8 text-xl" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900 cursor-pointer"
            onClick={() => handleNewDocument()}
            title="New Document"
          >
            <Plus className="w-8 h-8 text-xl" />
          </Button>









          {/* Version Dropdown */}
          {currentDocument && currentDocument.versions.length > 0 && (
            <VersionDropdownButton
              key={`version-dropdown-${currentDocument.id}-${currentDocument.currentVersionNumber}`}
              versions={currentDocument.versions}
              currentVersionNumber={currentDocument.currentVersionNumber}
              onVersionSelect={handleLoadFromVersion}
              disabled={!editor}
            />
          )}

        </div>

        <div className="flex gap-2 items-center md:absolute z-[100] top-[6px] right-[8px] ">
          {/* Permanent Data Source Indicator - to the left of Save button */}
          {(propDataSource || dataSource) && (
            <div className="flex items-center gap-1.5">
              {/* {propDataSource === 'api' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-md border border-green-300 ">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
              )}
              {propDataSource === 'redis' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 rounded-md border border-gray-300">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                </div>
              )} */}
              {/* Earth icon for Arweave - redirects to Arweave transaction */}
              {transactionId && (
                <button
                  onClick={() => router.push(`/status/${transactionId}`)}
                  className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-blue-50 transition-colors"
                  title="View on Arweave"
                // disabled={propDataSource !== 'api'}
                >
                  <Globe className={`w-4 h-4 ${propDataSource === 'api' ? 'text-blue-600' : 'text-gray-500'}`} />
                </button>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50 bg-transparent"
            onClick={handleSaveToArweave}
            disabled={isUploading || !editor}
            title="Save to Arweave"
          >
            <Save className="w-4 h-4" />
            {isUploading ? "Saving..." : "Save"}
          </Button>
          <div ref={dropdownMenuRef}>
            <DropdownMenu
              open={showMoreMenu}
              onOpenChange={setShowMoreMenu}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                  title="More options"
                >
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                portal={true}
                className="bg-gray-50 border border-gray-200 rounded-lg shadow-lg p-1 min-w-[160px]"
                onInteractOutside={(e) => {
                  e.preventDefault()
                  setShowMoreMenu(false)
                }}
                onEscapeKeyDown={() => {
                  setShowMoreMenu(false)
                }}
              >


                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    handleShowAccountDetails()
                    setShowMoreMenu(false)
                  }}
                  className="cursor-pointer flex items-center whitespace-nowrap px-3 py-2 rounded-md hover:bg-orange-50 hover:text-orange-700 transition-colors"
                >
                  <Wallet className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Account Detail</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    handleMenuLoad()
                    setShowMoreMenu(false)
                  }}
                  disabled={isLoading}
                  className="cursor-pointer flex items-center whitespace-nowrap px-3 py-2 rounded-md hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Load</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    handleCopyShareLink()
                    setShowMoreMenu(false)
                  }}
                  className="cursor-pointer flex items-center whitespace-nowrap px-3 py-2 rounded-md hover:bg-green-50 hover:text-green-700 transition-colors"
                >
                  <Copy className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Copy</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    handleShare()
                    setShowMoreMenu(false)
                  }}
                  className="cursor-pointer flex items-center whitespace-nowrap px-3 py-2 rounded-md hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <Share2 className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Share</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    handleMenuSave()
                    setShowMoreMenu(false)
                  }}
                  disabled={isUploading || !editor}
                  className="cursor-pointer flex items-center whitespace-nowrap px-3 py-2 rounded-md hover:bg-purple-50 hover:text-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{isUploading ? 'Saving...' : 'Save'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Editor Area */}
      <SimpleEditor />

      {/* Password Popup */}
      <PasswordPopup
        isOpen={showPasswordPopup}
        onClose={() => setShowPasswordPopup(false)}
        onSave={(pwd, title) => handlePasswordPopupSave(pwd, title)}
        initialTitle={currentDocument?.title ?? documentTitle}
      />

      {/* Password Prompt Popup */}
      <PasswordPromptPopup
        isOpen={showPasswordPromptPopup}
        onClose={() => {
          setShowPasswordPromptPopup(false)
          setPromptVersionNumber(null)
        }}
        onConfirm={handlePasswordPromptConfirm}
        versionNumber={promptVersionNumber || 0}
      />

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Load from Arweave</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction ID
                </label>
                <input
                  type="text"
                  value={loadTransactionId}
                  onChange={(e) => setLoadTransactionId(e.target.value)}
                  placeholder="Enter Arweave transaction ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLoadModal(false)
                    setLoadTransactionId('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleLoadFromArweave}
                  disabled={isLoading || !loadTransactionId.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? 'Loading...' : 'Load Content'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Details Modal */}
      <AccountDetailsModal
        isOpen={showAccountDetails}
        onClose={() => setShowAccountDetails(false)}
        walletAddress={walletAddress}
        onWalletChange={handleWalletChange}
      />

    </div>
  )
})

Editor.displayName = 'Editor'

export default Editor