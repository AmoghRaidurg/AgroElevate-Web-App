import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90",
        outline:
          "border-2 border-border bg-card text-foreground shadow-sm hover:bg-secondary hover:border-primary/40 hover:text-foreground dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:border-white/25",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/60 shadow-sm hover:bg-secondary/80 dark:bg-white/8 dark:border-white/12 dark:hover:bg-white/12",
        ghost:
          "text-foreground hover:bg-secondary hover:text-foreground dark:text-foreground dark:hover:bg-white/10",
        link: "text-primary underline-offset-4 hover:underline",
        hero:
          "bg-[image:var(--gradient-primary)] text-primary-foreground font-bold shadow-hero hover:shadow-hero-lg hover:-translate-y-0.5 hover:brightness-110 border border-white/10",
        subtle:
          "bg-muted text-foreground border border-border hover:bg-muted/80 dark:bg-white/5 dark:border-white/10",
        accent:
          "bg-accent text-accent-foreground shadow-md hover:bg-accent/90 hover:shadow-lg",
        highlight:
          "bg-highlight text-highlight-foreground shadow-md hover:opacity-90",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-md px-3.5 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
