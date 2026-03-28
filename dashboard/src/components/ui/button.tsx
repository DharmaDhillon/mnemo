import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90":
              variant === "default",
            "border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]":
              variant === "outline",
            "bg-transparent hover:bg-[var(--muted)]": variant === "ghost",
            "bg-[var(--destructive)] text-white hover:opacity-90":
              variant === "destructive",
          },
          {
            "h-10 px-4 text-sm": size === "default",
            "h-8 px-3 text-xs": size === "sm",
            "h-12 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
