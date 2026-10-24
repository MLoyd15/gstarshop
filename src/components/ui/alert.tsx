// Usage: <Alert variant="error" title="Could not save" dismissible onDismiss={() => setError("")}>Please try again.</Alert>
import * as React from "react"
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"

const NOTICE_TIMEOUT_MS = 3000
const icons = { error: CircleAlert, success: CircleCheck, warning: TriangleAlert, info: Info } as const
type Variant = keyof typeof icons

type AlertProps = React.ComponentProps<"div"> & {
  variant: Variant
  title?: React.ReactNode
  action?: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
}

function Alert({ variant, title, action, dismissible = false, onDismiss, className, children, ...props }: AlertProps) {
  const Icon = icons[variant]
  return (
    <div className={`alert alert-${variant}${className ? ` ${className}` : ""}`} role={variant === "error" ? "alert" : "status"} {...props}>
      <Icon className="alert-icon" aria-hidden="true" />
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        {children && <div className="alert-description">{children}</div>}
      </div>
      {action && <div className="alert-action">{action}</div>}
      {dismissible && <button className="btn btn-icon btn-sm btn-ghost alert-dismiss" type="button" aria-label="Dismiss" onClick={onDismiss}><span aria-hidden="true">×</span></button>}
    </div>
  )
}

export { Alert, NOTICE_TIMEOUT_MS }
