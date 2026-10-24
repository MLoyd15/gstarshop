import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "btn group/button shrink-0 select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "btn-primary",
        outline: "btn-secondary",
        secondary: "btn-secondary",
        ghost: "btn-ghost",
        destructive: "btn-danger",
        link: "btn-ghost underline underline-offset-4",
      },
      size: {
        default: "",
        xs: "btn-sm",
        sm: "btn-sm",
        lg: "btn-lg",
        icon: "btn-icon",
        "icon-xs": "btn-icon btn-sm",
        "icon-sm": "btn-icon btn-sm",
        "icon-lg": "btn-icon btn-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
