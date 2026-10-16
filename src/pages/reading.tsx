// Reading: the reader's shelf. Books in progress show the chapter they're on,
// the next three chapters' verdicts and the saddest part still ahead.
import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { BookCard, CardGrid } from "@/components/book-card";
import { Cover } from "@/components/cover";
import { PageHead, emptyClass, mutedLink, wrapClass } from "@/components/layout";
import { AheadSummary, NextChapters } from "@/components/progress";
import { Timeline } from "@/components/sadness";
import { buttonVariants } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { bookQuery, libraryQuery } from "@/lib/data";
import { chapterName } from "@/lib/format";
import { moodById } from "@/lib/moods";
import { useMood, useShelf, type MoodId, type ShelfEntry } from "@/lib/storage";
import type { BookSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const shelfTitle = "shelf-title mt-8 mb-3 font-display text-[1.4rem] font-normal";

export function ReadingPage() {
  const { data: library } = useSuspenseQuery(libraryQuery);
  const shelf = useShelf();
  const mood = useMood();
  const worst = library.meta.thresholds?.worstAhead ?? 4.5;
  const entries = Object.entries(shelf)
    .filter(([slug]) => library.bySlug.has(slug))
    .sort((a, b) => (b[1].updated ?? 0) - (a[1].updated ?? 0));
  const reading = entries.filter(([, e]) => e.status === "reading" || (!e.status && e.chapter !== null && e.chapter !== undefined));
  const finished = entries.filter(([, e]) => e.status === "finished");
  const bailed = entries.filter(([, e]) => e.status === "bailed");
  const book = (slug: string) => library.bySlug.get(slug)!;

  return (
    <>
      <PageHead eyebrow="Your shelf" title="Reading">
        <p className="text-[.78rem] text-muted-foreground">
          {mood ? (
            <>Verdicts for “{moodById(mood)!.short}”. <Link to="/me" className={mutedLink}>Change mood</Link></>
          ) : (
            <><Link to="/me" className={mutedLink}>Set your mood</Link> to see go / caution / don't verdicts here.</>
          )}
        </p>
      </PageHead>
      <section className={cn("shelf pb-10", wrapClass)}>
        {reading.length ? (
          <div className="mt-3 grid gap-[18px]">
            {reading.map(([slug, e]) => <ReadingCard key={slug} summary={book(slug)} entry={e} mood={mood} worst={worst} />)}
          </div>
        ) : (
          <div className={cn(panelClass, "mt-3")}>
            <h2 className="m-0 font-display text-[1.4rem] leading-tight font-normal">Nothing on your shelf yet</h2>
            <p className="mt-1.5 text-[.9rem] font-bold text-muted-foreground">
              Open a book and pick the chapter you're on, or tap “Reading”. It'll show up here with what's coming next.
            </p>
            <Link to="/" className={cn(buttonVariants({ variant: "primary" }), "mt-3.5")}>Browse the library</Link>
          </div>
        )}
        {finished.length > 0 && (
          <>
            <h2 className={shelfTitle}>Finished</h2>
            <CardGrid>{finished.map(([slug]) => <BookCard key={slug} book={book(slug)} index={book(slug).index} />)}</CardGrid>
          </>
        )}
        {bailed.length > 0 && (
          <>
            <h2 className={shelfTitle}>Bailed</h2>
            <CardGrid>{bailed.map(([slug]) => <BookCard key={slug} book={book(slug)} index={book(slug).index} />)}</CardGrid>
          </>
        )}
      </section>
    </>
  );
}

function ReadingCard({ summary, entry, mood, worst }: { summary: BookSummary & { index: number }; entry: ShelfEntry; mood: MoodId | null; worst: number }) {
  const { data: book, isError } = useQuery(bookQuery(summary.slug));
  if (isError) return <CardGrid><BookCard book={summary} index={summary.index} /></CardGrid>;
  if (!book) return <p className={emptyClass}>Loading your books…</p>;
  const here = entry.chapter ?? null;
  return (
    <article className="reading-card border-2 border-foreground bg-card p-3.5 shadow-hard-md">
      <Link to="/book/$slug/{-$chapter}" params={{ slug: book.slug }} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 no-underline">
        <Cover src={summary.cover} title={book.title} index={summary.index} />
        <div>
          <h3 className="m-0 font-display text-[1.1rem] leading-[1.15] font-normal">{book.title}</h3>
          <p className="mt-1.5 text-[.85rem] font-bold text-muted-foreground">{book.author}</p>
          <Timeline values={book.chapters.map((c) => c.average)} mood={mood} className="mt-2.5" />
        </div>
      </Link>
      {here !== null && book.chapters[here] ? (
        <>
          <p className="progress mt-3 text-[.9rem] font-extrabold">
            On {chapterName(book.chapters[here])} · {here + 1} of {book.chapters.length}
          </p>
          <NextChapters book={book} here={here} mood={mood} />
          <AheadSummary book={book} here={here} mood={mood} worst={worst} />
        </>
      ) : (
        <p className="progress mt-3 text-[.9rem] font-extrabold">Pick the chapter you're on to see what's next.</p>
      )}
    </article>
  );
}
