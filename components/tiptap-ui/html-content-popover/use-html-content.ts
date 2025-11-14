"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import toast from "react-hot-toast"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { Code2Icon } from "@/components/tiptap-icons/code2-icon"

/**
 * Configuration for the HTML content popover functionality
 */
export interface UseHtmlContentPopoverConfig {
    /**
     * The Tiptap editor instance.
     */
    editor?: Editor | null
    /**
     * Whether to hide the HTML content popover when not available.
     * @default false
     */
    hideWhenUnavailable?: boolean
    /**
     * Callback function called when the HTML content is updated.
     */
    onUpdateContent?: () => void
}

/**
 * Custom hook for handling HTML content operations in a Tiptap editor
 */
export function useHtmlContentHandler(props: {
    editor: Editor | null
    onUpdateContent?: () => void
}) {
    const { editor, onUpdateContent } = props
    const [htmlContent, setHtmlContent] = React.useState<string>("")

    const setHtmlContentToEditor = React.useCallback(() => {
        if (!editor || !htmlContent) return

        try {
            // Extract just the body content if it's a full HTML document
            let contentToInsert = htmlContent.trim()

            // Remove DOCTYPE, html, head, and body tags if present
            if (contentToInsert.includes('<!DOCTYPE') || contentToInsert.includes('<html')) {
                // Extract body content
                const bodyMatch = contentToInsert.match(/<body[^>]*>([\s\S]*)<\/body>/i)
                if (bodyMatch) {
                    contentToInsert = bodyMatch[1].trim()
                } else {
                    // If no body tag, try to extract content between html tags
                    const htmlMatch = contentToInsert.match(/<html[^>]*>([\s\S]*)<\/html>/i)
                    if (htmlMatch) {
                        contentToInsert = htmlMatch[1].trim()
                        // Remove head tag if present
                        const headMatch = contentToInsert.match(/<head[^>]*>[\s\S]*<\/head>/i)
                        if (headMatch) {
                            contentToInsert = contentToInsert.replace(headMatch[0], '').trim()
                        }
                    }
                }
            }

            // Use insertContent - Tiptap will parse it, but we've configured extensions to preserve styles
            // For advanced CSS, we need to ensure the HTML is inserted as-is
            editor.commands.insertContent(contentToInsert, {
                parseOptions: {
                    preserveWhitespace: 'full',
                },
            })

            onUpdateContent?.()
        } catch (error) {
            console.error("Failed to set HTML content:", error)
            // Try a simpler fallback
            try {
                editor.commands.insertContent(htmlContent)
                onUpdateContent?.()
            } catch (fallbackError) {
                console.error("Fallback insertion also failed:", fallbackError)
            }
        }
    }, [editor, htmlContent, onUpdateContent])

    const copyHtmlContent = React.useCallback(async () => {
        if (!htmlContent) return

        try {
            await navigator.clipboard.writeText(htmlContent)
            toast.success("HTML content copied to clipboard", { duration: 2000 })
        } catch (error) {
            console.error("Failed to copy HTML content:", error)
            toast.error("Failed to copy HTML content", { duration: 2000 })
        }
    }, [htmlContent])

    return {
        htmlContent,
        setHtmlContent,
        setHtmlContentToEditor,
        copyHtmlContent,
    }
}

/**
 * Determines if the HTML content button should be shown
 */
export function shouldShowHtmlContentButton(props: {
    editor: Editor | null
    hideWhenUnavailable: boolean
}): boolean {
    const { editor, hideWhenUnavailable } = props

    if (!editor) {
        return false
    }

    if (hideWhenUnavailable && !editor.isEditable) {
        return false
    }

    return true
}

/**
 * Custom hook for HTML content popover state management
 */
export function useHtmlContentState(props: {
    editor: Editor | null
    hideWhenUnavailable: boolean
}) {
    const { editor, hideWhenUnavailable = false } = props

    const [isVisible, setIsVisible] = React.useState(false)

    React.useEffect(() => {
        if (!editor) return

        const handleSelectionUpdate = () => {
            setIsVisible(
                shouldShowHtmlContentButton({
                    editor,
                    hideWhenUnavailable,
                })
            )
        }

        handleSelectionUpdate()

        editor.on("selectionUpdate", handleSelectionUpdate)

        return () => {
            editor.off("selectionUpdate", handleSelectionUpdate)
        }
    }, [editor, hideWhenUnavailable])

    return {
        isVisible,
    }
}

/**
 * Main hook that provides HTML content popover functionality for Tiptap editor
 */
export function useHtmlContentPopover(config?: UseHtmlContentPopoverConfig) {
    const {
        editor: providedEditor,
        hideWhenUnavailable = false,
        onUpdateContent,
    } = config || {}

    const { editor } = useTiptapEditor(providedEditor)

    const { isVisible } = useHtmlContentState({
        editor,
        hideWhenUnavailable,
    })

    const htmlContentHandler = useHtmlContentHandler({
        editor,
        onUpdateContent,
    })

    return {
        isVisible,
        label: "HTML Content",
        Icon: Code2Icon,
        ...htmlContentHandler,
    }
}

