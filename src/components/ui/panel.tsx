// Bordered card with a hard shadow, the site's main container, plus the
// small uppercase heading used on top of it.
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const panelClass = "panel mb-[22px] min-w-0 border-2 border-foreground bg-card p-3.5 shadow-hard";
export const legendClass = "px-1.5 text-[.72rem] font-black uppercase";

/** A panel; with `legend` it's a fieldset (for groups of controls). */
export function Panel({
  legend,
  title,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { legend?: ReactNode; title?: ReactNode }) {
  if (legend) {
    return (
      <fieldset className={cn(panelClass, className)} {...props}>
        <legend className={legendClass}>{legend}</legend>
        {children}
      </fieldset>
    );
  }
  return (
    <section className={cn(panelClass, className)} {...props}>
      {title && <h2 className={cn(legendClass, "m-0 px-0 font-sans")}>{title}</h2>}
      {children}
    </section>
  );
}

/** Muted explanatory text inside a panel. */
export function PanelText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 mb-2.5 text-[.9rem] font-bold text-muted-foreground", className)} {...props} />;
}
