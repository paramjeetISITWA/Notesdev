"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import toast from "react-hot-toast"

// --- Hooks ---
import { useIsMobile } from "@/hooks/use-mobile"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { Code2Icon } from "@/components/tiptap-icons/code2-icon"
import { CornerDownLeftIcon } from "@/components/tiptap-icons/corner-down-left-icon"

// --- Tiptap UI ---
import type { UseHtmlContentPopoverConfig } from "@/components/tiptap-ui/html-content-popover/use-html-content"
import { useHtmlContentPopover } from "@/components/tiptap-ui/html-content-popover/use-html-content"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import { Separator } from "@/components/tiptap-ui-primitive/separator"
import {
    Card,
    CardBody,
    CardItemGroup,
} from "@/components/tiptap-ui-primitive/card"
import { Input, InputGroup } from "@/components/tiptap-ui-primitive/input"

export interface HtmlContentMainProps {
    /**
     * The HTML content to display and edit.
     */
    htmlContent: string
    /**
     * Function to update the HTML content state.
     */
    setHtmlContent: React.Dispatch<React.SetStateAction<string>>
    /**
     * Function to apply the HTML content to the editor.
     */
    setHtmlContentToEditor: () => void
    /**
     * Function to copy the HTML content to clipboard.
     */
    copyHtmlContent: () => void
}

export interface HtmlContentPopoverProps
    extends Omit<ButtonProps, "type">,
    UseHtmlContentPopoverConfig {
    /**
     * Callback for when the popover opens or closes.
     */
    onOpenChange?: (isOpen: boolean) => void
}

/**
 * HTML content button component for triggering the HTML content popover
 */
export const HtmlContentButton = React.forwardRef<
    HTMLButtonElement,
    ButtonProps
>(({ className, children, ...props }, ref) => {
    return (
        <Button
            type="button"
            className={className}
            data-style="ghost"
            role="button"
            tabIndex={-1}
            aria-label="HTML Content"
            tooltip="HTML Content"
            ref={ref}
            {...props}
        >
            {children || <Code2Icon className="tiptap-button-icon" />}
        </Button>
    )
})

HtmlContentButton.displayName = "HtmlContentButton"

/**
 * Main content component for the HTML content popover
 */
const HtmlContentMain: React.FC<HtmlContentMainProps> = ({
    htmlContent,
    setHtmlContent,
    setHtmlContentToEditor,
    copyHtmlContent,
}) => {
    const isMobile = useIsMobile()

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            setHtmlContentToEditor()
        }
    }

    return (
        <Card
            style={{
                ...(isMobile ? { boxShadow: "none", border: 0 } : {}),
                minWidth: "400px",
                maxWidth: "600px",
            }}
        >
            <CardBody
                style={{
                    ...(isMobile ? { padding: 0 } : {}),
                }}
            >
                <CardItemGroup orientation="vertical" style={{ gap: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                        Enter HTML content to insert at cursor position (Ctrl+Enter to apply)
                    </div>
                    <textarea
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: "100%",
                            minHeight: "200px",
                            padding: "8px",
                            fontFamily: "monospace",
                            fontSize: "12px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            resize: "vertical",
                        }}
                        placeholder="Enter HTML content to insert..."
                    />

                    <CardItemGroup orientation="horizontal">
                        <ButtonGroup orientation="horizontal">
                            <Button
                                type="button"
                                onClick={setHtmlContentToEditor}
                                title="Apply HTML content"
                                disabled={!htmlContent}
                                data-style="ghost"
                            >
                                <CornerDownLeftIcon className="tiptap-button-icon" />
                                <span style={{ marginLeft: "4px" }}>Apply</span>
                            </Button>
                        </ButtonGroup>

                        <Separator />

                        <ButtonGroup orientation="horizontal">
                            <Button
                                type="button"
                                onClick={copyHtmlContent}
                                title="Copy HTML content"
                                disabled={!htmlContent}
                                data-style="ghost"
                            >
                                <span>Copy</span>
                            </Button>
                        </ButtonGroup>
                    </CardItemGroup>
                </CardItemGroup>
            </CardBody>
        </Card>
    )
}

/**
 * HTML content component for standalone use
 */
export const HtmlContentContent: React.FC<{
    editor?: Editor | null
}> = ({ editor }) => {
    const htmlContentPopover = useHtmlContentPopover({
        editor,
    })

    return <HtmlContentMain {...htmlContentPopover} />
}

/**
 * HTML content popover component for Tiptap editors.
 *
 * For custom popover implementations, use the `useHtmlContentPopover` hook instead.
 */
export const HtmlContentPopover = React.forwardRef<
    HTMLButtonElement,
    HtmlContentPopoverProps
>(
    (
        {
            editor: providedEditor,
            hideWhenUnavailable = false,
            onUpdateContent,
            onOpenChange,
            onClick,
            children,
            ...buttonProps
        },
        ref
    ) => {
        const { editor } = useTiptapEditor(providedEditor)
        const [isOpen, setIsOpen] = React.useState(false)

        const {
            isVisible,
            htmlContent,
            setHtmlContent,
            setHtmlContentToEditor,
            copyHtmlContent,
            label,
            Icon,
        } = useHtmlContentPopover({
            editor,
            hideWhenUnavailable,
            onUpdateContent,
        })

        const handleOnOpenChange = React.useCallback(
            (nextIsOpen: boolean) => {
                setIsOpen(nextIsOpen)
                onOpenChange?.(nextIsOpen)
                // Clear HTML content when opening the modal for new input
                if (nextIsOpen) {
                    setHtmlContent("")
                }
            },
            [onOpenChange, setHtmlContent]
        )

        // Handle Escape key to close modal
        React.useEffect(() => {
            if (!isOpen) return

            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    handleOnOpenChange(false)
                }
            }

            window.addEventListener("keydown", handleEscape)
            return () => {
                window.removeEventListener("keydown", handleEscape)
            }
        }, [isOpen, handleOnOpenChange])

        const handleSetHtmlContent = React.useCallback(() => {
            setHtmlContentToEditor()
            setIsOpen(false)
            toast.success("HTML content applied to editor", { duration: 2000 })
        }, [setHtmlContentToEditor])

        const handleClick = React.useCallback(
            (event: React.MouseEvent<HTMLButtonElement>) => {
                onClick?.(event)
                if (event.defaultPrevented) return
                const nextIsOpen = !isOpen
                setIsOpen(nextIsOpen)
                // Clear HTML content when opening the modal for new input
                if (nextIsOpen) {
                    setHtmlContent("")
                }
            },
            [onClick, isOpen, setHtmlContent]
        )

        if (!isVisible) {
            return null
        }

        return (
            <>
                <HtmlContentButton
                    onClick={handleClick}
                    {...buttonProps}
                    ref={ref}
                >
                    {children ?? <Icon className="tiptap-button-icon" />}
                </HtmlContentButton>

                {isOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                handleOnOpenChange(false)
                            }
                        }}
                    >
                        <div
                            className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 border-b flex justify-between items-center">
                                <h3 className="text-lg font-semibold">HTML Content</h3>
                                <button
                                    onClick={() => handleOnOpenChange(false)}
                                    className="text-gray-500 hover:text-gray-700 text-xl"
                                    aria-label="Close"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="p-4">
                                <HtmlContentMain
                                    htmlContent={htmlContent}
                                    setHtmlContent={setHtmlContent}
                                    setHtmlContentToEditor={handleSetHtmlContent}
                                    copyHtmlContent={copyHtmlContent}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </>
        )
    }
)

HtmlContentPopover.displayName = "HtmlContentPopover"

export default HtmlContentPopover

