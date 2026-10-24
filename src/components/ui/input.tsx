import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "input file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-medium file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
