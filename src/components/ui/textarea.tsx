import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-line bg-background px-3 py-2 text-sm text-ink",
        "placeholder:text-muted/70",
        "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
        className,
      )}
      {...props}
    />
  );
});
