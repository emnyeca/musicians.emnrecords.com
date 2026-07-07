import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 rounded-md border border-line bg-background px-3 text-sm text-ink",
        "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
        className,
      )}
      {...props}
    />
  );
});
