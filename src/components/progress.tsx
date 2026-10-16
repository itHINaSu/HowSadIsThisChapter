// "Where you're at" helpers: the next few chapters' verdicts and the
// saddest part still ahead. Used on the book page and the Reading tab.
import { verdict, VERDICTS } from "@/lib/moods";
import { chapterName, fmt } from "@/lib/format";
import type { MoodId } from "@/lib/storage";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sadnessBg } from "./sadness";

export function NextChapters({ book, here, mood, n = 3 }: { book: Book; here: number; mood: MoodId | null; n?: number }) {
  return (
    <ol className="next m-0 mt-1.5 grid list-none gap-1.5 p-0">
      {book.chapters.slice(here, here + n).map((c) => {
        const v = verdict(mood, c.average);
        return (
          <li
            key={c.id}
            className={cn(
              "flex justify-between gap-2.5 border-2 border-foreground px-2.5 py-2 text-[.85rem] font-extrabold",
              sadnessBg(mood, c.average),
              c.average === null ? "text-foreground" : !v && "text-ink",
            )}
          >
            <span className="min-w-0 truncate">{chapterName(c)}</span>
            <span className="flex-none text-[.75rem] uppercase">
              {c.average === null ? "?" : fmt(c.average)}
              {v && ` · ${VERDICTS[v]}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function AheadSummary({ book, here, mood, worst }: { book: Book; here: number; mood: MoodId | null; worst: number }) {
  const box = "ahead mt-3 border-2 border-foreground px-3 py-2.5 text-[.85rem] font-bold";
  const rest = book.chapters.slice(here).filter((c) => c.average !== null);
  if (!rest.length) return <p className={cn(box, "bg-muted text-foreground")}>No chapters from here on have enough ratings yet.</p>;
  const top = rest.reduce((a, b) => (b.average! > a.average! ? b : a));
  const v = verdict(mood, top.average);
  if (v === "stop" || (!mood && top.average! >= worst)) {
    return (
      <p className={cn(box, "hot bg-s5 text-ink")}>
        Brace yourself: the saddest part still ahead is <strong>{chapterName(top)}</strong> ({fmt(top.average!)}).
      </p>
    );
  }
  return (
    <p className={cn(box, "ok bg-s1 text-ink")}>
      The saddest part still ahead is <strong>{chapterName(top)}</strong> at {fmt(top.average!)}.{v && ` ${VERDICTS[v]}.`}
    </p>
  );
}
