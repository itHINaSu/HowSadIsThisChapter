// Button in the site's style: 2px ink border, bold label, hard shadow when
// primary or pressed. Built like shadcn/ui's Button (cva variants), so it can
// be swapped for the site's own Button. `buttonVariants` styles links too.
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "btn inline-flex items-center justify-center gap-2 rounded-md border-2 border-foreground font-black no-underline cursor-pointer transition-[transform,box-shadow] duration-100 " +
    "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-hard-sm [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        primary: "btn-primary bg-primary text-primary-foreground shadow-hard-sm hover:-translate-y-0.5 hover:shadow-hard",
        danger: "bg-transparent border-stop text-stop",
      },
      size: {
        default: "min-h-11 px-4 py-2 text-[.9rem]",
        sm: "min-h-9 px-3 py-1 text-[.78rem]",
        lg: "min-h-12 px-4 py-2 text-[.9rem]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** Round icon-only button (share, dismiss). */
export function IconButton({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "icon-btn grid size-11 flex-none cursor-pointer place-items-center rounded-full border-2 border-foreground bg-background text-foreground",
        className,
      )}
      {...props}
    />
  );
}
