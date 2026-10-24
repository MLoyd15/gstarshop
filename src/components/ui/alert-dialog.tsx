// Usage: <ConfirmDialog open={open} title="Delete record?" description="This cannot be undone." confirmLabel="Delete" onConfirm={remove} onCancel={() => setOpen(false)} />
import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel, busy = false }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && !busy) onCancel() }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="dialog-overlay" />
        <AlertDialogPrimitive.Content className="dialog-content" data-size="sm">
          <header className="dialog-header">
            <AlertDialogPrimitive.Title className="dialog-title">{title}</AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="dialog-description">{description}</AlertDialogPrimitive.Description>
          </header>
          <footer className="dialog-footer">
            <AlertDialogPrimitive.Cancel asChild>
              <button type="button" className="btn btn-secondary" disabled={busy} autoFocus onClick={onCancel}>Cancel</button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <button type="button" className="btn btn-danger" disabled={busy} aria-busy={busy || undefined} onClick={(event) => { event.preventDefault(); onConfirm() }}>{confirmLabel}</button>
            </AlertDialogPrimitive.Action>
          </footer>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialog>
  )
}

export { AlertDialog, ConfirmDialog }
