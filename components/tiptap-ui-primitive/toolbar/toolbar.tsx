"use client"

import * as React from "react"
import { Separator } from "@/components/tiptap-ui-primitive/separator"
import "@/components/tiptap-ui-primitive/toolbar/toolbar.scss"
import { cn } from "@/lib/tiptap-utils"
import { useMenuNavigation } from "@/hooks/use-menu-navigation"
import { useComposedRef } from "@/hooks/use-composed-ref"

type BaseProps = React.HTMLAttributes<HTMLDivElement>

interface ToolbarProps extends BaseProps {
  variant?: "floating" | "fixed"
}

const useToolbarNavigation = (
  toolbarRef: React.RefObject<HTMLDivElement | null>
) => {
  const [items, setItems] = React.useState<HTMLElement[]>([])

  const collectItems = React.useCallback(() => {
    if (!toolbarRef.current) return []
    return Array.from(
      toolbarRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [role="button"]:not([disabled]), [tabindex="0"]:not([disabled])'
      )
    )
  }, [toolbarRef])

  React.useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const updateItems = () => setItems(collectItems())

    updateItems()
    const observer = new MutationObserver(updateItems)
    observer.observe(toolbar, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [collectItems, toolbarRef])

  const { selectedIndex } = useMenuNavigation<HTMLElement>({
    containerRef: toolbarRef,
    items,
    orientation: "horizontal",
    onSelect: (el) => el.click(),
    autoSelectFirstItem: false,
  })

  React.useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (toolbar.contains(target))
        target.setAttribute("data-focus-visible", "true")
    }

    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (toolbar.contains(target)) target.removeAttribute("data-focus-visible")
    }

    toolbar.addEventListener("focus", handleFocus, true)
    toolbar.addEventListener("blur", handleBlur, true)

    return () => {
      toolbar.removeEventListener("focus", handleFocus, true)
      toolbar.removeEventListener("blur", handleBlur, true)
    }
  }, [toolbarRef])

  React.useEffect(() => {
    if (selectedIndex !== undefined && items[selectedIndex]) {
      items[selectedIndex].focus()
    }
  }, [selectedIndex, items])
}

export const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ children, className, variant = "fixed", ...props }, ref) => {
    const toolbarRef = React.useRef<HTMLDivElement>(null)
    const composedRef = useComposedRef(toolbarRef, ref)
    useToolbarNavigation(toolbarRef)

    const [showLeftIndicator, setShowLeftIndicator] = React.useState(false)
    const [showRightIndicator, setShowRightIndicator] = React.useState(false)

    const checkScrollIndicators = React.useCallback(() => {
      const toolbar = toolbarRef.current
      if (!toolbar) return

      const { scrollLeft, scrollWidth, clientWidth } = toolbar
      const canScroll = scrollWidth > clientWidth
      setShowLeftIndicator(canScroll && scrollLeft > 1)
      setShowRightIndicator(canScroll && scrollLeft < scrollWidth - clientWidth - 1)
    }, [])

    React.useEffect(() => {
      const toolbar = toolbarRef.current
      if (!toolbar) return

      // Initial check with a small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        checkScrollIndicators()
      }, 100)

      const handleScroll = () => {
        checkScrollIndicators()
      }

      const resizeObserver = new ResizeObserver(() => {
        // Small delay to ensure layout is complete
        setTimeout(() => {
          checkScrollIndicators()
        }, 10)
      })

      toolbar.addEventListener('scroll', handleScroll, { passive: true })
      resizeObserver.observe(toolbar)

      // Check on window resize
      window.addEventListener('resize', checkScrollIndicators)

      return () => {
        clearTimeout(timeoutId)
        toolbar.removeEventListener('scroll', handleScroll)
        resizeObserver.disconnect()
        window.removeEventListener('resize', checkScrollIndicators)
      }
    }, [checkScrollIndicators])

    return (
      <div
        ref={composedRef}
        role="toolbar"
        aria-label="toolbar"
        data-variant={variant}
        className={cn("tiptap-toolbar", className)}
        {...props}
      >
        {showLeftIndicator && (
          <div className="tiptap-toolbar-scroll-indicator tiptap-toolbar-scroll-indicator-left" />
        )}
        {children}
        {showRightIndicator && (
          <div className="tiptap-toolbar-scroll-indicator tiptap-toolbar-scroll-indicator-right" />
        )}
      </div>
    )
  }
)
Toolbar.displayName = "Toolbar"

export const ToolbarGroup = React.forwardRef<HTMLDivElement, BaseProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn("tiptap-toolbar-group", className)}
      {...props}
    >
      {children}
    </div>
  )
)
ToolbarGroup.displayName = "ToolbarGroup"

export const ToolbarSeparator = React.forwardRef<HTMLDivElement, BaseProps>(
  ({ ...props }, ref) => (
    <Separator ref={ref} orientation="vertical" decorative {...props} />
  )
)
ToolbarSeparator.displayName = "ToolbarSeparator"
