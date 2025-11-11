"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    PencilIcon,
    SearchIcon,
    ArrowUpDownIcon,
    LayoutGridIcon,
    SignalIcon as SignInIcon,
    ChevronDownIcon,
    SunIcon,
    XIcon,
    Folder,
    Clock,
    Upload,
} from "lucide-react"

import {
    getAllDocuments,
    getCurrentDocument,
    getVersionContent,
    Document,
    DocumentVersion
} from '@/lib/arweave-utils'

interface Note {
    id: string
    title: string
    preview: string
    createdAt: Date
}

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
    onLoadVersion?: (versionNumber: number) => void
    onLoadDocument?: (documentId: string) => void
}

export default function Sidebar({ isOpen, onClose, onLoadVersion, onLoadDocument }: SidebarProps) {
    console.log('Sidebar props received:', { isOpen, onClose: typeof onClose, onLoadVersion: typeof onLoadVersion, onLoadDocument: typeof onLoadDocument })

    const pathname = usePathname()
    const [notes, setNotes] = useState<Note[]>([
        {
            id: "1",
            title: "hi whats up",
            preview: "This is a sample note...",
            createdAt: new Date(),
        },
    ])
    const [searchQuery, setSearchQuery] = useState("")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
    const [documents, setDocuments] = useState<Document[]>([])
    const [currentDocument, setCurrentDocument] = useState<Document | null>(null)
    const [activeTab, setActiveTab] = useState<"notes" | "documents">("documents")

    const filteredNotes = notes.filter((note) => note.title.toLowerCase().includes(searchQuery.toLowerCase()))
    const filteredDocuments = documents
        .filter((doc) => (doc.title || "").toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortOrder === "asc") {
                return new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
            }
            return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
        })

    // Initialize documents
    useEffect(() => {
        const allDocs = getAllDocuments()
        const currentDoc = getCurrentDocument()
        setDocuments(allDocs)
        setCurrentDocument(currentDoc)
    }, [])

    const handleLoadVersion = (versionNumber: number) => {
        console.log('Sidebar: handleLoadVersion called with:', versionNumber)
        console.log('Sidebar: onLoadVersion type:', typeof onLoadVersion)
        if (onLoadVersion && typeof onLoadVersion === 'function') {
            console.log('Sidebar: onLoadVersion called with:', versionNumber)
            onLoadVersion(versionNumber)
        } else {
            console.log('Sidebar: onLoadVersion is not a function or undefined')
        }
        onClose() // Close sidebar after loading
    }

    const handleLoadDocument = (documentId: string) => {
        console.log('Sidebar: handleLoadDocument called with:', documentId)
        console.log('Sidebar: onLoadDocument type:', typeof onLoadDocument)
        if (onLoadDocument && typeof onLoadDocument === 'function') {
            console.log('Sidebar: onLoadDocument called with:', documentId)
            onLoadDocument(documentId)
        } else {
            console.log('Sidebar: onLoadDocument is not a function or undefined')
        }
        onClose() // Close sidebar after loading
    }

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

                {/* Top Actions */}
                <div className="p-4 border-b border-gray-200">
                    {/* Tab Navigation */}
                    {/* <div className="flex mb-4">
                        <button
                            onClick={() => setActiveTab("documents")}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "documents"
                                ? "bg-blue-100 text-blue-700"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            Documents
                        </button>
                        <button
                            onClick={() => setActiveTab("notes")}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "notes"
                                ? "bg-blue-100 text-blue-700"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            Notes
                        </button>
                    </div> */}

                    <div className="flex items-center gap-2 mb-4">
                        {/* <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="New note">
                                <PencilIcon className="w-5 h-5 text-gray-700" />
                            </button> */}
                        <div className="flex-1 relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {/* <button
                            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Sort"
                        >
                            <ArrowUpDownIcon className="w-5 h-5 text-gray-700" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View options">
                            <LayoutGridIcon className="w-5 h-5 text-gray-700" />
                        </button> */}
                    </div>
                </div>

                {/* Content List */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4">
                        {activeTab === "documents" ? (
                            <>
                                {/* <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Documents</h3> */}

                                {/* Current Document */}
                                {currentDocument && (
                                    <div className="mb-4">
                                        <div className="bg-blue-50 p-3 rounded-lg mb-3">
                                            <div className="font-medium text-blue-900 text-sm">{currentDocument.title}</div>
                                            <div className="text-xs text-blue-700 mt-1">
                                                {currentDocument.versions.length} version{currentDocument.versions.length !== 1 ? 's' : ''}
                                            </div>
                                            <div className="text-xs text-blue-600 mt-1">
                                                Last modified: {new Date(currentDocument.lastModified).toLocaleDateString()}
                                            </div>
                                        </div>

                                        {/* Document Versions */}
                                        {currentDocument.versions.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Versions</h4>
                                                {currentDocument.versions.map((version, index) => (
                                                    <div
                                                        key={version.versionNumber}
                                                        className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => handleLoadVersion(version.versionNumber)}
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="font-medium text-sm text-gray-900">
                                                                        Version {version.versionNumber}
                                                                    </div>
                                                                    {version.versionNumber === 1 ? (
                                                                        <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                                            Initial
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                                            v{version.versionNumber}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {version.preview}
                                                                </div>
                                                                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(version.timestamp).toLocaleString()}
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-gray-400 ml-2">
                                                                #{version.versionNumber}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* All Documents */}
                                {filteredDocuments.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">All Documents</h4>
                                        {filteredDocuments.map((doc) => (
                                            <div
                                                key={doc.id}
                                                className={`border rounded-lg p-3 cursor-pointer ${doc.id === currentDocument?.id
                                                    ? 'border-blue-300 bg-blue-50'
                                                    : 'border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                onClick={() => handleLoadDocument(doc.id)}
                                            >
                                                <div className="font-medium text-sm text-gray-900">
                                                    {doc.title}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {doc.versions.length} version{doc.versions.length !== 1 ? 's' : ''}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {new Date(doc.lastModified).toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {(documents.length === 0 || filteredDocuments.length === 0) && (
                                    <div className="text-center text-gray-500 py-8">
                                        <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        {documents.length === 0 ? (
                                            <>
                                                <p className="text-sm">No documents yet</p>
                                                <p className="text-xs">Upload content to create your first document</p>
                                            </>
                                        ) : (
                                            <p className="text-sm">No documents match your search</p>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h3>
                                <div className="space-y-2">
                                    {filteredNotes.length > 0 ? (
                                        filteredNotes.map((note) => (
                                            <Link
                                                key={note.id}
                                                href={`/notes/${note.id}`}
                                                className="block p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                                            >
                                                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">{note.title}</p>
                                                <p className="text-xs text-gray-500 truncate mt-1">{note.preview}</p>
                                            </Link>
                                        ))
                                    ) : (
                                        <p className="text-sm text-gray-500 text-center py-8">No notes found</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="border-t border-gray-200 p-4 space-y-3">
                    <Link
                        href="/signin"
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        <SignInIcon className="w-4 h-4" />
                        Sign In
                    </Link>
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
