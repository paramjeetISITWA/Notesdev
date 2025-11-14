"use client"

import * as React from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Heading } from "@tiptap/extension-heading"
import { BulletList } from "@tiptap/extension-bullet-list"
import { OrderedList } from "@tiptap/extension-ordered-list"
import { ListItem } from "@tiptap/extension-list-item"
import { Blockquote } from "@tiptap/extension-blockquote"
import { Node } from "@tiptap/core"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import {
  HtmlContentPopover,
  HtmlContentContent,
  HtmlContentButton,
} from "@/components/tiptap-ui/html-content-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsMobile } from "@/hooks/use-mobile"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"
import { useEditorContext } from "@/hooks/use-editor-context"


// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"
import { loadFromArweave } from "@/lib/arweave-utils"

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"

import content from "@/components/tiptap-templates/simple/data/content.json"

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}) => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal={isMobile} />
        <ListDropdownMenu
          types={["bulletList", "orderedList", "taskList"]}
          portal={isMobile}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {/* {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )} */}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      {/* <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup> */}

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HtmlContentPopover />
      </ToolbarGroup>

      <Spacer />

      {isMobile && <ToolbarSeparator />}

      {/* <ToolbarGroup>
        <ThemeToggle />
      </ToolbarGroup> */}
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button data-style="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

export function SimpleEditor() {
  const isMobile = useIsMobile()
  const { height } = useWindowSize()
  const { setEditor } = useEditorContext()
  const [mobileView, setMobileView] = React.useState<
    "main" | "highlighter" | "link"
  >("main")
  const toolbarRef = React.useRef<HTMLDivElement>(null)
  const [initialContent, setInitialContent] = React.useState<any>(content)
  const [isLoadingContent, setIsLoadingContent] = React.useState(false)

  // Load content from Arweave if TX ID is provided in env, otherwise use JSON
  React.useEffect(() => {
    const loadContent = async () => {
      const txId = process.env.NEXT_PUBLIC_ARWEAVE_TX_ID

      if (txId && txId.trim()) {
        setIsLoadingContent(true)
        try {
          console.log('Loading content from Arweave with TX ID:', txId)
          const result = await loadFromArweave(txId.trim())

          if (result.success && result.content) {
            try {
              // Try to parse as JSON
              const parsedContent = JSON.parse(result.content)

              // Check if content is wrapped with metadata (from arweave-utils)
              // Format: { content: "...", password: 0, passwordProtected: false, ... }
              if (parsedContent && typeof parsedContent === 'object') {
                // If it has a 'content' field and looks like wrapped metadata
                if (parsedContent.content && (parsedContent.password !== undefined || parsedContent.passwordProtected !== undefined)) {
                  // Extract the actual content
                  const actualContent = parsedContent.content
                  // Try to parse the inner content as JSON (Tiptap format)
                  try {
                    const innerContent = JSON.parse(actualContent)
                    setInitialContent(innerContent)
                    console.log('Content loaded successfully from Arweave (extracted from wrapper)')
                  } catch {
                    // If inner content is not JSON, use it as-is (might be plain text)
                    setInitialContent(actualContent)
                    console.log('Content loaded from Arweave (plain text from wrapper)')
                  }
                } else if (parsedContent.type === 'doc') {
                  // Direct Tiptap content format
                  setInitialContent(parsedContent)
                  console.log('Content loaded successfully from Arweave (direct Tiptap format)')
                } else {
                  // Unknown format, try to use as-is
                  setInitialContent(parsedContent)
                  console.log('Content loaded from Arweave (unknown format, using as-is)')
                }
              } else {
                // Not an object, use as-is
                setInitialContent(parsedContent)
                console.log('Content loaded from Arweave (non-object)')
              }
            } catch (parseError) {
              // If not JSON, might be plain text or different format
              console.warn('Content from Arweave is not valid JSON, using fallback:', parseError)
              setInitialContent(content)
            }
          } else {
            console.warn('Failed to load from Arweave, using fallback:', result.error)
            setInitialContent(content)
          }
        } catch (error) {
          console.error('Error loading from Arweave, using fallback:', error)
          setInitialContent(content)
        } finally {
          setIsLoadingContent(false)
        }
      } else {
        console.log('No ARWEAVE_TX_ID found in env, using default JSON content')
        // No loading needed, content is already set to default
      }
    }

    loadContent()
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content: initialContent,
    editable: true,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
        paragraph: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
      }),
      // Custom Div extension to support div elements with all styles (no sanitization)
      Node.create({
        name: 'div',
        group: 'block',
        content: 'block+',
        parseHTML() {
          return [
            {
              tag: 'div',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = {}

                // Preserve ALL attributes including style (raw, no sanitization)
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                // Preserve any other attributes
                Array.from(element.attributes).forEach(attr => {
                  if (attr.name !== 'style' && attr.name !== 'class') {
                    attrs[attr.name] = attr.value
                  }
                })

                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            style: {
              default: null,
              // Parse style attribute as raw string - no sanitization
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              // Render style exactly as stored - no sanitization
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
          }
        },
        renderHTML({ HTMLAttributes }) {
          // Preserve all attributes including style exactly as-is
          const attrs: Record<string, string> = {}
          if (HTMLAttributes.style) {
            attrs.style = HTMLAttributes.style as string
          }
          if (HTMLAttributes.class) {
            attrs.class = HTMLAttributes.class as string
          }
          // Copy any other attributes
          Object.keys(HTMLAttributes).forEach(key => {
            if (key !== 'style' && key !== 'class' && key !== 'data-type') {
              attrs[key] = HTMLAttributes[key] as string
            }
          })
          return ['div', attrs, 0]
        },
      }),
      // Custom Span extension to support span elements with all styles (no sanitization)
      Node.create({
        name: 'span',
        group: 'inline',
        inline: true,
        content: 'inline*',
        parseHTML() {
          return [
            {
              tag: 'span',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = {}

                // Preserve ALL attributes including style (raw, no sanitization)
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                // Preserve any other attributes
                Array.from(element.attributes).forEach(attr => {
                  if (attr.name !== 'style' && attr.name !== 'class') {
                    attrs[attr.name] = attr.value
                  }
                })

                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            style: {
              default: null,
              // Parse style attribute as raw string - no sanitization
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              // Render style exactly as stored - no sanitization
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
          }
        },
        renderHTML({ HTMLAttributes }) {
          // Preserve all attributes including style exactly as-is
          const attrs: Record<string, string> = {}
          if (HTMLAttributes.style) {
            attrs.style = HTMLAttributes.style as string
          }
          if (HTMLAttributes.class) {
            attrs.class = HTMLAttributes.class as string
          }
          // Copy any other attributes
          Object.keys(HTMLAttributes).forEach(key => {
            if (key !== 'style' && key !== 'class' && key !== 'data-type') {
              attrs[key] = HTMLAttributes[key] as string
            }
          })
          return ['span', attrs, 0]
        },
      }),
      // Configure Paragraph to allow ALL inline styles (no sanitization)
      Paragraph.extend({
        parseHTML() {
          return [
            {
              tag: 'p',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = {}

                // Preserve style attribute as raw string - no sanitization
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }

                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            style: {
              default: null,
              // Parse style attribute as raw string - preserves ALL CSS properties
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              // Render style exactly as stored - no sanitization
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
          }
        },
      }),
      // Configure Heading to allow ALL inline styles (no sanitization)
      Heading.extend({
        parseHTML() {
          return [
            {
              tag: 'h1',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = { level: 1 }
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
            {
              tag: 'h2',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = { level: 2 }
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
            {
              tag: 'h3',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = { level: 3 }
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
            {
              tag: 'h4',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = { level: 4 }
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
            {
              tag: 'h5',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = { level: 5 }
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
            {
              tag: 'h6',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = { level: 6 }
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              // Parse style attribute as raw string - preserves ALL CSS properties
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              // Render style exactly as stored - no sanitization
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
          }
        },
      }),
      // Configure BulletList to allow ALL inline styles (no sanitization)
      BulletList.extend({
        parseHTML() {
          return [
            {
              tag: 'ul',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = {}
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
          }
        },
      }),
      // Configure OrderedList to allow ALL inline styles (no sanitization)
      OrderedList.extend({
        parseHTML() {
          return [
            {
              tag: 'ol',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = {}
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
          }
        },
      }),
      // Configure ListItem to allow ALL inline styles (no sanitization)
      ListItem.extend({
        parseHTML() {
          return [
            {
              tag: 'li',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = {}
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
          }
        },
      }),
      // Configure Blockquote to allow ALL inline styles (no sanitization)
      Blockquote.extend({
        parseHTML() {
          return [
            {
              tag: 'blockquote',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = {}
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
          }
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image.extend({
        parseHTML() {
          return [
            {
              tag: 'img',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = {}
                if (element.hasAttribute('src')) {
                  attrs.src = element.getAttribute('src')
                }
                if (element.hasAttribute('alt')) {
                  attrs.alt = element.getAttribute('alt')
                }
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
          }
        },
      }),
      // Custom Button extension to support button elements with ALL styles (no sanitization)
      Node.create({
        name: 'button',
        group: 'inline',
        inline: true,
        content: 'inline*',
        parseHTML() {
          return [
            {
              tag: 'button',
              getAttrs: (node) => {
                if (typeof node === 'string') return false
                const element = node as HTMLElement
                const attrs: Record<string, any> = {}

                // Preserve ALL attributes including style (raw, no sanitization)
                if (element.hasAttribute('style')) {
                  attrs.style = element.getAttribute('style')
                }
                if (element.hasAttribute('class')) {
                  attrs.class = element.getAttribute('class')
                }
                if (element.hasAttribute('onclick')) {
                  attrs.onclick = element.getAttribute('onclick')
                }
                if (element.hasAttribute('onmouseover')) {
                  attrs.onmouseover = element.getAttribute('onmouseover')
                }
                if (element.hasAttribute('onmouseout')) {
                  attrs.onmouseout = element.getAttribute('onmouseout')
                }
                // Preserve any other attributes
                Array.from(element.attributes).forEach(attr => {
                  if (!['style', 'class', 'onclick', 'onmouseover', 'onmouseout'].includes(attr.name)) {
                    attrs[attr.name] = attr.value
                  }
                })

                return attrs
              },
            },
          ]
        },
        addAttributes() {
          return {
            style: {
              default: null,
              // Parse style attribute as raw string - preserves ALL CSS properties
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('style')
                }
                return null
              },
              // Render style exactly as stored - no sanitization
              renderHTML: (attributes) => {
                if (!attributes.style) {
                  return {}
                }
                return {
                  style: attributes.style,
                }
              },
            },
            class: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('class')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.class) {
                  return {}
                }
                return {
                  class: attributes.class,
                }
              },
            },
            onclick: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('onclick')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.onclick) {
                  return {}
                }
                return {
                  onclick: attributes.onclick,
                }
              },
            },
            onmouseover: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('onmouseover')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.onmouseover) {
                  return {}
                }
                return {
                  onmouseover: attributes.onmouseover,
                }
              },
            },
            onmouseout: {
              default: null,
              parseHTML: (element) => {
                if (element instanceof HTMLElement) {
                  return element.getAttribute('onmouseout')
                }
                return null
              },
              renderHTML: (attributes) => {
                if (!attributes.onmouseout) {
                  return {}
                }
                return {
                  onmouseout: attributes.onmouseout,
                }
              },
            },
          }
        },
        renderHTML({ HTMLAttributes }) {
          // Preserve all attributes including style exactly as-is
          const attrs: Record<string, string> = {}
          Object.keys(HTMLAttributes).forEach(key => {
            if (key !== 'data-type') {
              attrs[key] = HTMLAttributes[key] as string
            }
          })
          return ['button', attrs, 0]
        },
      }),
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],

  })

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  React.useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main")
    }
  }, [isMobile, mobileView])

  // Update editor content when initialContent changes
  React.useEffect(() => {
    if (editor && !isLoadingContent && initialContent) {
      editor.commands.setContent(initialContent)
    }
  }, [editor, initialContent, isLoadingContent])

  React.useEffect(() => {
    if (editor) {
      setEditor(editor)
    }
    return () => {
      setEditor(null)
    }
  }, [editor, setEditor])

  if (isLoadingContent || !editor) {
    return (
      <div className="simple-editor-wrapper">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          padding: '2rem'
        }}>
          <p>Loading content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          ref={toolbarRef}
          style={{
            ...(isMobile
              ? {
                bottom: `calc(100% - ${height - rect.y}px)`,
              }
              : {}),
          }}
        >
          {mobileView === "main" ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView("highlighter")}
              onLinkClick={() => setMobileView("link")}
              isMobile={isMobile}
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === "highlighter" ? "highlighter" : "link"}
              onBack={() => setMobileView("main")}
            />
          )}
        </Toolbar>

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />
      </EditorContext.Provider>
    </div>
  )
}
