"use client"

import type React from "react"

import { useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import {
  Bookmark,
  Info,
  Save,
  Edit3,
  Folder,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Type,
  Palette,
  Code,
  ChevronDown,
  Upload,
  Download,
  Wallet,
  Plus,
  Menu,
  MoreVertical,
  Copy,
} from "lucide-react"
import toast from "react-hot-toast"

import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { VersionDropdownButton } from '@/components/tiptap-ui/version-dropdown-button/version-dropdown-button'
import { PasswordPopup } from '@/components/tiptap-ui/password-popup/password-popup'
import { PasswordPromptPopup } from '@/components/tiptap-ui/password-prompt-popup/password-prompt-popup'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/tiptap-ui-primitive/dropdown-menu/dropdown-menu'
import { usePathname } from 'next/navigation'
import {
  loadOrCreateSolanaWallet,
  uploadToArweave,
  loadFromArweave,
  getSolanaWalletAddress,
  getWalletFundingInstructions,
  getCurrentDocument,
  addDocumentVersion,
  getAllDocuments,
  createDocument,
  getVersionContent,
  getVersionContentWithPassword,
  getLatestVersionContent,
  getDocumentVersions,
  saveDocuments,
  getAllPreviousTransactionIds,
  Document,
  DocumentVersion
} from '@/lib/arweave-utils'
import { useEditorContext } from '@/hooks/use-editor-context'
import CryptoJS from 'crypto-js';


interface EditorProps {
  content: string
  setContent: (content: string) => void
  onSidebarToggle?: () => void
}

export interface EditorRef {
  loadFromVersion: (versionNumber: number) => void
  loadDocument: (documentId: string) => void
}

const Editor = forwardRef<EditorRef, EditorProps>(({ content, setContent, onSidebarToggle }, ref) => {
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
  const { editor } = useEditorContext()
  const pathname = usePathname()

  // Initialize wallet and documents on component mount
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const wallet = await loadOrCreateSolanaWallet()
        setWalletAddress(wallet.address)
        toast.success(`Solana wallet initialized: ${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}`, { duration: 1000 })
      } catch (error) {
        console.error('Wallet initialization error:', error)
        toast.error('Failed to initialize Solana wallet')
      }
    }

    const initializeDocuments = () => {
      const allDocs = getAllDocuments()
      setDocuments(allDocs)
      // Don't create a document automatically - let user create one when needed
      setCurrentDocument(null)
      setDocumentTitle('')
    }

    initializeWallet()
    initializeDocuments()
  }, [])

  // Update wallet address display when it changes
  useEffect(() => {
    const currentAddress = getSolanaWalletAddress()
    if (currentAddress) {
      setWalletAddress(currentAddress)

    }
  }, [])

  // Debug logging to track currentDocument changes
  useEffect(() => {
    console.log('Editor: currentDocument changed:', currentDocument)
    if (currentDocument) {
      console.log('Editor: currentVersionNumber:', currentDocument.currentVersionNumber)
    }
  }, [currentDocument])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    setIsSaved(false)
  }

  const handleSave = () => {
    setIsSaved(true)
  }

  const handleSaveToArweave = () => {
    if (!editor) {
      toast.error('Editor not ready. Please wait for the editor to load.')
      return
    }

    if (isUploading) {
      console.log('Upload already in progress, skipping...')
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
      const previousTransactionIds = currentDocument ? getAllPreviousTransactionIds(currentDocument.id) : []

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

      console.log('Content with password:', password ? 'ENCRYPTED' : 'UNENCRYPTED')

      console.log('Uploading content:', contentString.substring(0, 100) + '...')

      // Check if this is a new document or existing document
      // A document is considered "new" if:
      // 1. No current document exists, OR
      // 2. The title has changed significantly (indicating user wants a new document)
      const effectiveTitle = titleFromPopup?.trim() || documentTitle?.trim()
      const isNewDocument = !currentDocument ||
        (currentDocument.title !== effectiveTitle && (effectiveTitle ?? '') !== '')

      let documentId: string

      if (isNewDocument) {
        // Check if a document with this title already exists to prevent duplicates
        const existingDocs = getAllDocuments()
        const titleToCheck = effectiveTitle || 'Untitled Document'
        const existingDoc = existingDocs.find(doc => doc.title === titleToCheck)

        if (existingDoc) {
          // Document with this title already exists, use it instead
          console.log('Document with title already exists, using existing:', existingDoc.id)
          documentId = existingDoc.id
          setCurrentDocument(existingDoc)
          setDocumentTitle(existingDoc.title)
        } else {
          // Create a new document with initial content
          console.log('Creating new document with title:', titleToCheck)
          const newDoc = createDocument(titleToCheck, contentString, password || undefined, previousTransactionIds)
          if (!newDoc) {
            toast.error('Failed to create new document')
            setIsUploading(false)
            return
          }
          documentId = newDoc.id
          setCurrentDocument(newDoc)
          setDocumentTitle(titleToCheck)
          const updatedDocs = getAllDocuments()
          setDocuments(updatedDocs)
          console.log('Created new document:', newDoc.id)
          console.log('Total documents after creation:', updatedDocs.length)
        }
      } else {
        // Existing document - add new version
        documentId = currentDocument.id
        console.log('Updating existing document:', documentId)
      }

      // Upload the entire document (with all versions) to Arweave
      console.log('Uploading content to Arweave:', contentString)
      const result = await uploadToArweave(contentString, documentId)

      if (result.success) {
        if (isNewDocument) {
          // For new documents, update the existing version with transaction ID
          const documents = getAllDocuments()
          const docIndex = documents.findIndex(doc => doc.id === documentId)
          if (docIndex !== -1) {
            documents[docIndex].arweaveTransactionId = result.transactionId
            documents[docIndex].lastModified = new Date().toISOString()
            saveDocuments(documents)
            setCurrentDocument(documents[docIndex])
            setDocuments(documents)
          }
        } else {
          // For existing documents, add new version
          const updatedDoc = addDocumentVersion(
            documentId,
            contentString,
            result.transactionId,
            password || undefined,
            previousTransactionIds
          )

          if (updatedDoc) {
            setCurrentDocument(updatedDoc)
            setDocuments(getAllDocuments())
          }
        }

        toast.success(`Content saved to Arweave! Transaction ID: ${result.transactionId}`, { duration: 1000 })
        setIsSaved(true)
      } else {
        // Check if it's a balance issue and show funding instructions
        if (result.error?.includes('Insufficient SOL balance')) {
          toast.error(
            <div className="max-w-md">
              <div className="font-semibold mb-2">Insufficient SOL Balance</div>
              <div className="text-sm whitespace-pre-line">
                To fund your wallet for Arweave uploads:
                1. Copy this wallet address: {walletAddress || 'N/A'}
                2. Send at least 0.01 SOL to this address
                3. You can buy SOL on exchanges like Coinbase, Binance, or use a faucet for testnet
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
      console.error('Save error:', error)
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
      toast.error('Failed to load content from Arweave', { duration: 1000 } )
      console.error('Load error:', error)
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

  const handleMenuLoad = () => {
    setShowLoadModal(true)
  }

  const handleMenuSave = () => {
    handleSaveToArweave()
  }

  const handleLoadFromVersion = (versionNumber: number) => {
    console.log('Loading version:', versionNumber)

    if (!currentDocument) {
      toast.error('No current document found', { duration: 1000 } )
      return
    }

    if (!editor) {
      toast.error('Editor not ready. Please wait for the editor to load.', { duration: 1000 } )
      return
    }

    // Check if version is password protected
    const version = currentDocument.versions.find(v => v.versionNumber === versionNumber)
    if (!version) {
      toast.error(`Version ${versionNumber} not found`, { duration: 1000 } )
      return
    }

    if (version.password === 1) {
      // Version is password protected, show password prompt popup
      setPromptVersionNumber(versionNumber)
      setShowPasswordPromptPopup(true)
    } else {
      // Version is not password protected, load normally
      const storedContent = getVersionContent(currentDocument.id, versionNumber)
      if (storedContent) {
        loadVersionContent(storedContent, versionNumber)
      } else {
        toast.error(`Version ${versionNumber} content not found in local storage`, { duration: 1000 } )
      }
    }
  }

  const handlePasswordPromptConfirm = (password: string) => {
    if (!promptVersionNumber || !currentDocument) {
      toast.error('No version selected for decryption', { duration: 1000 } )
      return
    }

    try {
      const decryptedContent = getVersionContentWithPassword(currentDocument.id, promptVersionNumber, password)
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

    try {
      // Try to parse as JSON first
      const parsedContent = JSON.parse(content)
      console.log('Parsed content:', parsedContent)

      // If it's an object with a 'data' field, extract just the data
      if (parsedContent && typeof parsedContent === 'object' && parsedContent.data) {
        console.log('Setting content from data field:', parsedContent.data)
        editor.commands.setContent(parsedContent.data)
        toast.success(`Version ${versionNumber} loaded successfully!`, { duration: 1000 })
      } else if (parsedContent && typeof parsedContent === 'object' && parsedContent.type === 'doc') {
        // If it's editor JSON format, use it directly
        console.log('Setting editor JSON content:', parsedContent)
        editor.commands.setContent(parsedContent)
        toast.success(`Version ${versionNumber} loaded successfully!`, { duration: 1000 })
      } else {
        // If it's already the editor content, use it directly
        console.log('Setting content directly:', parsedContent)
        editor.commands.setContent(parsedContent)
        toast.success(`Version ${versionNumber} loaded successfully!`, { duration: 1000 })
      }
    } catch (error) {
      console.log('Not JSON, setting as text:', content)
      // If not JSON, try to set as HTML or plain text
      editor.commands.setContent(content)
      toast.success(`Version ${versionNumber} loaded successfully!`, { duration: 1000 })
    }

    // Update the current document to reflect the selected version
    if (currentDocument) {
      console.log('Editor: Updating current version from', currentDocument.currentVersionNumber, 'to', versionNumber)
      // Update the current version number in the document
      const documents = getAllDocuments()
      const docIndex = documents.findIndex(doc => doc.id === currentDocument.id)
      if (docIndex !== -1) {
        documents[docIndex].currentVersionNumber = versionNumber
        saveDocuments(documents)
        console.log('Editor: Setting new currentDocument:', documents[docIndex])
        setCurrentDocument(documents[docIndex])
        setDocumentTitle(documents[docIndex].title)
      }
    }
  }

  const handleLoadDocument = (documentId: string) => {
    console.log('Loading document:', documentId)
    // Get the document and update current document
    const doc = documents.find((d) => d.id === documentId)
    if (doc) {
      setCurrentDocument(doc)
      setDocumentTitle(doc.title)

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

    // Get latest version content from document (instant loading)
    const latestContent = getLatestVersionContent(documentId)
    console.log('Latest content:', latestContent)

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
          console.log('Parsed content:', parsedContent)

          // If it's an object with a 'data' field, extract just the data
          if (parsedContent && typeof parsedContent === 'object' && parsedContent.data) {
            console.log('Setting content from data field:', parsedContent.data)
            editor.commands.setContent(parsedContent.data)
            toast.success('Document loaded successfully!', { duration: 1000 })
          } else if (parsedContent && typeof parsedContent === 'object' && parsedContent.type === 'doc') {
            // If it's editor JSON format, use it directly
            console.log('Setting editor JSON content:', parsedContent)
            editor.commands.setContent(parsedContent)
            toast.success('Document loaded successfully!', { duration: 1000 })
          } else {
            // If it's already the editor content, use it directly
            console.log('Setting content directly:', parsedContent)
            editor.commands.setContent(parsedContent)
            toast.success('Document loaded successfully!', { duration: 1000 })
          }
        } catch (error) {
          console.log('Not JSON, setting as text:', latestContent)
          // If not JSON, try to set as HTML or plain text
          editor.commands.setContent(latestContent)
          toast.success('Document loaded successfully!', { duration: 1000 })
        }
      }, 200)
    } else {
      toast.error('Document content not found in local storage', { duration: 1000 })
    }

    // Refresh the documents list to ensure we have the latest data
    const updatedDocs = getAllDocuments()
    setDocuments(updatedDocs)
  }

  // Expose functions to parent components
  useImperativeHandle(ref, () => {
    console.log('Editor: useImperativeHandle called')
    return {
      loadFromVersion: handleLoadFromVersion,
      loadDocument: handleLoadDocument
    }
  })

  return (
    <div className="w-full mx-auto bg-white notesbox">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-2 md:p-0">
        <div className="flex gap-2 items-center md:absolute z-[100] top-[4px] left-[4px]">
          {/* Document title moved to Save popup */}

          {/* <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
            <Info className="w-5 h-5" />
          </Button> */}

          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900 cursor-pointer"
            onClick={onSidebarToggle}
            title="Show Documents"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900"
            onClick={() => {
              setDocumentTitle('')
              setCurrentDocument(null)
              editor?.commands.clearContent()
            }}
            title="New Document"
          >
            <Plus className="w-5 h-5" />
          </Button> */}

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
          {/* {walletAddress && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs">
              <Wallet className="w-3 h-3" />
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
            </div>
          )} */}
        </div>

        <div className="flex gap-2 items-center md:absolute z-[100] top-[4px] right-[8px] ">
          <DropdownMenu open={showMoreMenu} onOpenChange={setShowMoreMenu}>
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
            >
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
                }}
                className="cursor-pointer flex items-center whitespace-nowrap px-3 py-2 rounded-md hover:bg-green-50 hover:text-green-700 transition-colors"
              >
                <Copy className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>Copy</span>
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

    </div>
  )
})

Editor.displayName = 'Editor'

export default Editor