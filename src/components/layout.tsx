// Page building blocks: the pink hero and the plain page heading.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BackIcon } from "./icons";

export function Hero({ children, className, mark = true }: { children: ReactNode; className?: string; mark?: boolean }) {
  return (
    <section className={cn("hero relative overflow-hidden border-b-2 border-foreground bg-primary px-4 pt-10 pb-11 text-primary-foreground", className)}>
      {mark && (
        <div aria-hidden="true" className="pointer-events-none absolute -top-3.5 -right-4 rotate-12 font-display text-[140px] leading-none text-background opacity-30">
          ?
        </div>
      )}
      <div className="relative mx-auto max-w-4xl">{children}</div>
    </section>
  );
}

export const badgeClass =
  "badge mb-3.5 inline-block border-2 border-foreground bg-highlight px-2.5 py-1 text-[.72rem] font-black text-highlight-foreground uppercase";
export const heroTitleClass = "m-0 font-display text-[clamp(2.4rem,11vw,5.5rem)] leading-[.98] font-normal [overflow-wrap:anywhere]";

export function BackToLibrary() {
  return (
    <Link to="/" className="back inline-flex min-h-11 items-center gap-1.5 text-[.9rem] font-black no-underline">
      <BackIcon />
      Library
    </Link>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="page-head mx-auto max-w-6xl px-4 pt-7 pb-2">
      <p className="eyebrow m-0 text-[.72rem] font-black text-primary uppercase">{eyebrow}</p>
      <h1 className="mt-1 mb-1.5 font-display text-[2.4rem] leading-none font-normal">{title}</h1>
      {children}
    </section>
  );
}

export const wrapClass = "mx-auto max-w-6xl px-4";
export const emptyClass = "empty px-4 py-14 text-center font-bold text-muted-foreground";
export const mutedLink = "font-black text-inherit";
