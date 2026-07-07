import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-line bg-background px-3 text-sm text-ink",
        "placeholder:text-muted/70",
        "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
        "disabled:cursor-not-allowed disabled:bg-surface",
        className,
      )}
      {...props}
    />
  );
});
