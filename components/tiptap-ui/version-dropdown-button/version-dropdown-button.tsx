"use client"

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Clock, FileText, Lock } from 'lucide-react'
import { DocumentVersion } from '@/lib/types/document'

interface VersionDropdownButtonProps {
    versions: DocumentVersion[]
    currentVersionNumber: number
    onVersionSelect: (versionNumber: number) => void
    disabled?: boolean
}

export function VersionDropdownButton({
    versions,
    currentVersionNumber,
    onVersionSelect,
    disabled = false
}: VersionDropdownButtonProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const handleVersionClick = (versionNumber: number) => {
        console.log('VersionDropdownButton: handleVersionClick called with version:', versionNumber)
        onVersionSelect(versionNumber)
        setIsOpen(false)
    }

    const currentVersion = versions.find(v => v.versionNumber === currentVersionNumber)
    const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)

    // Debug logging to track version changes
    useEffect(() => {
        console.log('VersionDropdownButton: currentVersionNumber changed to:', currentVersionNumber)
        console.log('VersionDropdownButton: currentVersion:', currentVersion)
    }, [currentVersionNumber, currentVersion])

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled || versions.length === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Select version"
            >
                <FileText className="w-4 h-4" />
                <span>
                    {currentVersion ? `V${currentVersion.versionNumber}` : 'No versions'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && versions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-2">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
                            Select Version
                        </div>
                        <div className="space-y-1">
                            {sortedVersions.map((version) => (
                                <button
                                    key={version.versionNumber}
                                    onClick={() => handleVersionClick(version.versionNumber)}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${version.versionNumber === currentVersionNumber
                                        ? 'bg-blue-50 border border-blue-200'
                                        : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="font-medium text-sm text-gray-900">
                                                    V{version.versionNumber}
                                                </div>
                                                {(version.password === 1) && (
                                                    <div className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                                        <Lock className="w-3 h-3" />
                                                        Protected
                                                    </div>
                                                )}
                                                {version.versionNumber === currentVersionNumber && (
                                                    <div className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                                                        Current
                                                    </div>
                                                )}
                                            </div>
                                            {/* <div className="text-xs text-gray-500 mt-1 overflow-hidden" style={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical'
                                            }}>
                                                {version.preview}
                                            </div> */}
                                            <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(version.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-400 ml-2">
                                            #{version.versionNumber}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
