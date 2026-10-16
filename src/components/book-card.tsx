// Compact horizontal book card: cover, title, sadness strip and flags.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { hasAvoided } from "@/lib/books";
import { fmt, level, plural, seriesLabel } from "@/lib/format";
import { useAvoid, useMood } from "@/lib/storage";
import type { BookSummary, Series } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Cover } from "./cover";
import { LEVEL_BG, Timeline } from "./sadness";

const cardClass =
  "card grid h-full grid-cols-[72px_minmax(0,1fr)] gap-3.5 border-2 border-foreground bg-card p-3 no-underline shadow-hard-md " +
  "transition-transform duration-100 hover:-translate-y-[3px] active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm";
const flagClass = "flag border-2 border-foreground px-1.5 py-px";

function CardBody({ title, author, series, children }: { title: string; author: string; series?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <h3 className="m-0 font-display text-[1.1rem] leading-[1.15] font-normal [overflow-wrap:anywhere]">{title}</h3>
      <p className="mt-1.5 text-[.85rem] font-bold text-muted-foreground [overflow-wrap:anywhere]">{author}</p>
      {series && <p className="mt-[3px] text-[.7rem] font-black text-primary uppercase">{series}</p>}
      {children}
    </div>
  );
}

const footClass =
  "mt-auto flex flex-wrap items-center gap-2 border-t border-foreground/30 pt-2 text-[.7rem] font-black uppercase";

export function BookCard({ book, index }: { book: BookSummary; index: number }) {
  const mood = useMood();
  const avoid = useAvoid();
  return (
    <li>
      <Link to="/book/$slug/{-$chapter}" params={{ slug: book.slug }} className={cardClass}>
        <Cover src={book.cover} title={book.title} index={index} />
        <CardBody title={book.title} author={book.author} series={book.series && seriesLabel(book.series)}>
          <Timeline values={book.levels} mood={mood} className="mt-2" />
          <div className={cn(footClass, "mt-auto")}>
            <span>{book.chapters} chapters checked</span>
            {book.peak !== null && (
              <span className={cn("peak border-2 border-foreground px-1.5 py-px text-highlight-foreground", LEVEL_BG[level(book.peak)])} title="Saddest chapter average">
                Peak {fmt(book.peak)}
              </span>
            )}
            {hasAvoided(book, avoid) && <span className={cn(flagClass, "flag-avoid bg-stop text-stop-foreground")}>Has warnings you avoid</span>}
            {book.isSpicy && <span className={flagClass}>Spicy</span>}
          </div>
        </CardBody>
      </Link>
    </li>
  );
}

export function SeriesCard({ series, first, index }: { series: Series; first: BookSummary; index: number }) {
  return (
    <li>
      <Link to="/series/$slug" params={{ slug: series.slug }} className={cardClass}>
        <Cover src={first.cover} title={first.title} index={index} />
        <CardBody title={series.title} author={first.author} series={`Series · ${plural(series.books.length, "book")}`}>
          <div className={footClass}>
            <span>See the whole series</span>
          </div>
        </CardBody>
      </Link>
    </li>
  );
}

/** Responsive grid of cards: one column on phones, up to three on desktop. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <ul className="cards m-0 grid list-none gap-4 p-0 min-[720px]:grid-cols-2 min-[1080px]:grid-cols-3">{children}</ul>;
}
