"use client"

import * as React from "react"
import { cn } from "cn"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react"

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

// Below `sm` a submenu opens inline inside its parent panel (accordion)
// instead of as a flyout: the parent is right-aligned under the avatar and
// at 320-375px there is not enough free width beside it for even a 160px
// flyout, so Radix would flip it left and cover the parent. From `sm` up
// the normal side-by-side flyout is kept.
const NARROW_QUERY = "(max-width: 639px)"
function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW_QUERY)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
function useNarrow() {
  return React.useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false
  )
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
        onEscapeKeyDown={(e) => {
          if (closeInlineSub.current) {
            e.preventDefault()
            closeInlineSub.current()
            return
          }
          onEscapeKeyDown?.(e)
        }}
        className={cn(
          "z-50 min-w-[220px] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-[var(--r-card)] bg-popover p-1.5 text-popover-foreground shadow-menu data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
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

function DropdownMenuSub({
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  const narrow = useNarrow()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement | null>(null)
  const closeRef = React.useContext(CloseInlineSubContext)

  // Register/unregister the Escape closer while this inline sub is open.
  React.useEffect(() => {
    if (!narrow || !open || !closeRef) return
    closeRef.current = () => {
      setOpen(false)
      triggerRef.current?.focus()
    }
    return () => {
      closeRef.current = null
    }
  }, [narrow, open, closeRef])

  if (narrow) {
    return (
      <InlineTriggerRefContext.Provider value={triggerRef}>
        <InlineSubContext.Provider value={{ open, toggle: () => setOpen((o) => !o) }}>
          {children}
        </InlineSubContext.Provider>
      </InlineTriggerRefContext.Provider>
    )
  }
  return (
    <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props}>
      {children}
    </DropdownMenuPrimitive.Sub>
  )
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }) {
  const inline = React.useContext(InlineSubContext)
  const triggerRef = React.useContext(InlineTriggerRefContext)
  if (inline) {
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
        {...(props as React.ComponentProps<typeof DropdownMenuPrimitive.Item>)}
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
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-[var(--r-tile)] px-2.5 py-2 text-[13.5px] font-medium outline-hidden select-none focus:bg-secondary data-[state=open]:bg-secondary data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  const inline = React.useContext(InlineSubContext)
  if (inline) {
    // Rendered inside the parent panel (no portal), so it can never cover
    // it; mounted only while open so closed options stay out of the
    // arrow-key order. Indented to read as belonging to the row above.
    return inline.open ? (
      <div
        data-slot="dropdown-menu-sub-content"
        role="group"
        className={cn(
          "pl-2 duration-200 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none",
          className
        )}
      >
        {props.children}
      </div>
    ) : null
  }
  return (
    <DropdownMenuPortal>
      <DropdownMenuPrimitive.SubContent
        data-slot="dropdown-menu-sub-content"
        sideOffset={4}
        className={cn(
          "z-50 min-w-[160px] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-[var(--r-card)] bg-popover p-1.5 text-popover-foreground shadow-menu data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
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
        "relative flex w-full cursor-pointer items-center gap-2 rounded-[var(--r-tile)] py-2 pr-2.5 pl-8 text-[13.5px] font-medium outline-hidden select-none focus:bg-secondary data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2.5 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5 text-primary" />
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
