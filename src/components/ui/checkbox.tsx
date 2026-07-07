import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Styled native checkbox. Pink accent — checkboxes are one of the few places
 * where the accent color is allowed by the design policy.
 */
export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded border-line accent-[#d98da7]",
        className,
      )}
      {...props}
    />
  );
});
