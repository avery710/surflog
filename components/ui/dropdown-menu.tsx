"use client"

import * as React from "react"
import { cn } from "cn"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

// The parent Content keeps a ref to "close the open inline submenu", so
// Escape can close just that submenu (and return focus to its row) rather
// than the whole menu.
const CloseInlineSubContext = React.createContext<React.RefObject<(() => void) | null> | null>(null)
const InlineSubContext = React.createContext<{
  open: boolean
  toggle: () => void
} | null>(null)
const InlineTriggerRefContext = React.createContext<React.RefObject<HTMLDivElement | null> | null>(null)

function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = "end",
  collisionPadding = 8,
  onEscapeKeyDown,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  const closeInlineSub = React.useRef<(() => void) | null>(null)
  return (
    <DropdownMenuPortal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        collisionPadding={collisionPadding}
        onEscapeKeyDown={(e) => {
          if (closeInlineSub.current) {
            e.preventDefault()
            closeInlineSub.current()
            return
          }
          onEscapeKeyDown?.(e)
        }}
        className={cn(
          "z-50 min-w-[220px] origin-(--radix-dropdown-menu-content-transform-origin) max-h-(--radix-dropdown-menu-content-available-height) max-w-(--radix-dropdown-menu-content-available-width) overflow-y-auto overflow-x-hidden rounded-[var(--r-card)] bg-popover p-1.5 text-popover-foreground shadow-menu data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      >
        <CloseInlineSubContext.Provider value={closeInlineSub}>
          {children}
        </CloseInlineSubContext.Provider>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPortal>
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-[var(--r-tile)] px-2.5 py-2 text-[13.5px] font-medium outline-hidden select-none focus:bg-secondary data-disabled:pointer-events-none data-disabled:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:[&_svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

// A submenu always opens inline inside its parent panel (an accordion), at
// every width, so it can never cover the parent and desktop matches the
// phone. There is no side flyout: the parent is right-aligned under the
// avatar, where even a 160px flyout does not fit beside it on phones.
function DropdownMenuSub({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement | null>(null)
  const closeRef = React.useContext(CloseInlineSubContext)

  // Register/unregister the Escape closer while this sub is open.
  React.useEffect(() => {
    if (!open || !closeRef) return
    closeRef.current = () => {
      setOpen(false)
      triggerRef.current?.focus()
    }
    return () => {
      closeRef.current = null
    }
  }, [open, closeRef])

  return (
    <InlineTriggerRefContext.Provider value={triggerRef}>
      <InlineSubContext.Provider value={{ open, toggle: () => setOpen((o) => !o) }}>
        {children}
      </InlineSubContext.Provider>
    </InlineTriggerRefContext.Provider>
  )
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
  const inline = React.useContext(InlineSubContext)
  const triggerRef = React.useContext(InlineTriggerRefContext)
  if (!inline) throw new Error("DropdownMenuSubTrigger must be inside DropdownMenuSub")
  return (
    <DropdownMenuPrimitive.Item
      ref={triggerRef}
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      data-state={inline.open ? "open" : "closed"}
      aria-haspopup="menu"
      aria-expanded={inline.open}
      // Keep the menu open; the row only expands/collapses its options.
      onSelect={(e) => {
        e.preventDefault()
        inline.toggle()
      }}
      onKeyDown={(e) => {
        // ArrowRight expands like a flyout would; ArrowLeft collapses.
        if (e.key === "ArrowRight" && !inline.open) inline.toggle()
        if (e.key === "ArrowLeft" && inline.open) inline.toggle()
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-[var(--r-tile)] px-2.5 py-2 text-[13.5px] font-medium outline-hidden select-none focus:bg-secondary data-[state=open]:bg-secondary data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        className={cn(
          "ml-auto transition-transform duration-200 motion-reduce:transition-none",
          inline.open && "rotate-180"
        )}
      />
    </DropdownMenuPrimitive.Item>
  )
}

// Height easing for the submenu: a 0fr -> 1fr grid-rows transition
// (240ms ease-out, the same curve as AnimatedHeight), so the rows beneath
// ride along frame by frame. Options are mounted only while open or while
// the close transition runs, so closed options never enter the arrow-key
// order. Under reduced motion it mounts/unmounts instantly.
function InlineCollapse({
  open,
  className,
  children,
}: {
  open: boolean
  className?: string
  children: React.ReactNode
}) {
  const [mounted, setMounted] = React.useState(open)
  const [ready, setReady] = React.useState(false)
  // State adjusted during render (not in an effect) when `open` flips.
  if (open && !mounted) setMounted(true)
  if (!open && ready) setReady(false)
  const expanded = open && ready

  React.useEffect(() => {
    if (open) {
      // Start collapsed for one painted frame, then expand.
      let b = 0
      const a = requestAnimationFrame(() => {
        b = requestAnimationFrame(() => setReady(true))
      })
      return () => {
        cancelAnimationFrame(a)
        cancelAnimationFrame(b)
      }
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const id = window.setTimeout(() => setMounted(false), reduce ? 0 : 260)
    return () => window.clearTimeout(id)
  }, [open])

  if (!mounted) return null
  return (
    <div
      data-slot="dropdown-menu-sub-content"
      role="group"
      className={cn(
        "grid transition-[grid-template-rows] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "transition-opacity duration-200 motion-reduce:transition-none",
            expanded ? "opacity-100" : "opacity-0",
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function DropdownMenuSubContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const inline = React.useContext(InlineSubContext)
  if (!inline) throw new Error("DropdownMenuSubContent must be inside DropdownMenuSub")
  // Rendered inside the parent panel (no portal). Not indented: the options
  // share the parent rows' left edge.
  return (
    <InlineCollapse open={inline.open} className={className}>
      {children}
    </InlineCollapse>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        // pl-[34px] = px-2.5 + 16px icon + gap-2: the label starts where the
        // other rows' labels do, and the check sits in their icon column.
        "relative flex w-full cursor-pointer items-center gap-2 rounded-[var(--r-tile)] py-2 pr-2.5 pl-[34px] text-[13.5px] font-medium outline-hidden select-none focus:bg-secondary data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2.5 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-muted-foreground" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.01em] text-muted-foreground data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1.5 my-1.5 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
