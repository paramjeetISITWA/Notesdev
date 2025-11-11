"use client"

import * as React from "react"

// --- Lib ---
import { parseShortcutKeys } from "@/lib/tiptap-utils"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Tiptap UI ---
import type { UseImageUploadConfig } from "@/components/tiptap-ui/image-upload-button"
import {
  IMAGE_UPLOAD_SHORTCUT_KEY,
  useImageUpload,
} from "@/components/tiptap-ui/image-upload-button"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Badge } from "@/components/tiptap-ui-primitive/badge"
import { Input, InputGroup } from "@/components/tiptap-ui-primitive/input"
import { ButtonGroup } from "@/components/tiptap-ui-primitive/button"

export interface ImageUploadButtonProps
  extends Omit<ButtonProps, "type">,
  UseImageUploadConfig {
  /**
   * Optional text to display alongside the icon.
   */
  text?: string
  /**
   * Optional show shortcut keys in the button.
   * @default false
   */
  showShortcut?: boolean
}

export function ImageShortcutBadge({
  shortcutKeys = IMAGE_UPLOAD_SHORTCUT_KEY,
}: {
  shortcutKeys?: string
}) {
  return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>
}

/**
 * Button component for uploading/inserting images in a Tiptap editor.
 *
 * For custom button implementations, use the `useImage` hook instead.
 */
export const ImageUploadButton = React.forwardRef<
  HTMLButtonElement,
  ImageUploadButtonProps
>(
  (
    {
      editor: providedEditor,
      text,
      hideWhenUnavailable = false,
      onInserted,
      showShortcut = false,
      onClick,
      children,
      ...buttonProps
    },
    ref
  ) => {
    const { editor } = useTiptapEditor(providedEditor)
    const [isOpen, setIsOpen] = React.useState(false)
    const [url, setUrl] = React.useState("")
    const {
      isVisible,
      canInsert,
      label,
      isActive,
      shortcutKeys,
      Icon,
    } = useImageUpload({
      editor,
      hideWhenUnavailable,
      onInserted,
    })

    React.useEffect(() => {
      if (!editor) return
      // Prefill URL if an image is selected
      if (isActive) {
        const attrs = editor.getAttributes("image") as { src?: string }
        setUrl(attrs.src || "")
      }
    }, [editor, isActive])

    const handleButtonClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        setIsOpen((v) => !v)
      },
      [onClick]
    )

    const insertFromUrl = React.useCallback(() => {
      if (!editor) return
      const trimmed = url.trim()
      if (!trimmed) return
      const success = editor.chain().focus().setImage({ src: trimmed }).run()
      if (success) {
        setIsOpen(false)
        onInserted?.()
      }
    }, [editor, onInserted, url])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        insertFromUrl()
      }
    }

    if (!isVisible) {
      return null
    }

    return (
      <>
        <Button
          type="button"
          data-style="ghost"
          data-active-state={isActive ? "on" : "off"}
          role="button"
          tabIndex={-1}
          disabled={!canInsert}
          data-disabled={!canInsert}
          aria-label={label}
          aria-pressed={isActive}
          tooltip={label}
          onClick={handleButtonClick}
          {...buttonProps}
          ref={ref}
        >
          {children ?? (
            <>
              <Icon className="tiptap-button-icon" />
              {text && <span className="tiptap-button-text">{text}</span>}
              {showShortcut && <ImageShortcutBadge shortcutKeys={shortcutKeys} />}
            </>
          )}
        </Button>

        {isOpen && (
          <div
            className="fixed inset-0 bg-black/30  flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsOpen(false)
              }
            }}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[300px] h-[150px] flex flex-col shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 flex flex-col justify-center gap-4">
                <InputGroup>
                  <Input
                    type="url"
                    placeholder="Paste image link..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    className=" h-8 border border-gray-200 rounded-md"
                  />
                </InputGroup>
                <ButtonGroup orientation="horizontal">
                  <Button
                    type="button"
                    data-style="ghost"
                    onClick={() => setIsOpen(false)}
                    
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    data-style="ghost"
                    onClick={insertFromUrl}
                  >
                    Insert
                  </Button>
                </ButtonGroup>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
)

ImageUploadButton.displayName = "ImageUploadButton"
