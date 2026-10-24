// Usage: <Dialog open={open} onOpenChange={setOpen}><DialogContent size="md"><DialogHeader><DialogTitle>Edit record</DialogTitle></DialogHeader><DialogBody>...</DialogBody><DialogFooter>...</DialogFooter></DialogContent></Dialog>
import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

type Size = "sm" | "md" | "lg" | "xl"

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogContent({
  size = "md",
  busy = false,
  className,
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { size?: Size; busy?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-size={size}
        className={`dialog-content${className ? ` ${className}` : ""}`}
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); onEscapeKeyDown?.(event) }}
        onPointerDownOutside={(event) => { if (busy) event.preventDefault(); onPointerDownOutside?.(event) }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"header">) {
  return <header data-slot="dialog-header" className={`dialog-header${className ? ` ${className}` : ""}`} {...props} />
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={`dialog-title${className ? ` ${className}` : ""}`} {...props} />
}

function DialogDescription(props: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" {...props} />
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-body" className={`dialog-body${className ? ` ${className}` : ""}`} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return <footer data-slot="dialog-footer" className={`dialog-footer${className ? ` ${className}` : ""}`} {...props} />
}

function DialogClose({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" aria-label="Close" className={`btn btn-icon btn-ghost dialog-close${className ? ` ${className}` : ""}`} {...props}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 6-12 12M6 6l12 12" /></svg>
  </DialogPrimitive.Close>
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose }
