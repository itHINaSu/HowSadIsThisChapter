// Discover: ready-made lists, each with "See all" into the library.
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BookCard, CardGrid } from "@/components/book-card";
import { PageHead, mutedLink, wrapClass } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { PRESETS, hasAvoided, isGentle, isSafeForMood, type PresetId } from "@/lib/books";
import { libraryQuery } from "@/lib/data";
import { moodById } from "@/lib/moods";
import { useAvoid, useMood } from "@/lib/storage";
import type { BookSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type Section = {
  title: string;
  sub?: string;
  books?: BookSummary[];
  /** "See all" goes to this library preset, or to the library sorted by most rated */
  preset?: PresetId;
  prompt?: ReactNode;
};

export function DiscoverPage() {
  const { data: library } = useSuspenseQuery(libraryQuery);
  const mood = useMood();
  const avoid = useAvoid();
  const byVotes = (a: BookSummary, b: BookSummary) => b.votes - a.votes;
  const take = (fn: (b: BookSummary) => boolean, sort = byVotes, n = 6) => library.books.filter(fn).sort(sort).slice(0, n);

  const sections: Section[] = [
    mood
      ? { preset: "safe", title: "Safe for your mood", sub: `Every rated chapter is a “go” when you're ${moodById(mood)!.short.toLowerCase()}.`, books: take((b) => isSafeForMood(b, mood)) }
      : { title: "Safe for your mood", prompt: <><Link to="/me" className={mutedLink}>Set your mood</Link> to get books that are safe for how you feel right now.</> },
    { preset: "gentle", title: "Gentle reads", sub: "No chapter averages above 2.5.", books: take(isGentle) },
    avoid.size
      ? { preset: "avoidfree", title: "No warnings you avoid", sub: "Rated books where readers haven't flagged any of your avoided warnings.", books: take((b) => b.ratedChapters > 0 && !hasAvoided(b, avoid)) }
      : { title: "No warnings you avoid", prompt: <><Link to="/me" className={mutedLink}>Pick warnings to avoid</Link> and we'll find books without them.</> },
    { preset: "devastating", title: "Bring tissues", sub: "The saddest single chapters in the library.", books: take((b) => PRESETS.devastating.test(b, { mood, avoid }), (a, b) => b.peak! - a.peak!) },
    { title: "Most rated", sub: "Where the ratings are most reliable.", books: take((b) => b.votes > 0) },
  ];

  return (
    <>
      <PageHead eyebrow="Find your next read" title="Discover" />
      <div className={cn("discover pb-10", wrapClass)}>
        {sections.map((s) => (
          <section key={s.title} className="disc-section mt-[26px]">
            <div className="mb-3.5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b-2 border-foreground pb-2.5">
              <div>
                <h2 className="m-0 font-display text-[1.4rem] leading-[1.1] font-normal">{s.title}</h2>
                {s.sub && <p className="mt-1 text-[.78rem] text-muted-foreground">{s.sub}</p>}
              </div>
              {!!s.books?.length && (
                <Link to="/" search={s.preset ? { preset: s.preset } : { sort: "rated" }} className={buttonVariants({ size: "sm" })}>
                  See all
                </Link>
              )}
            </div>
            {s.prompt ? (
              <p className={cn(panelClass, "prompt m-0 font-bold")}>{s.prompt}</p>
            ) : s.books!.length ? (
              <CardGrid>{s.books!.map((b) => <BookCard key={b.slug} book={b} index={library.bySlug.get(b.slug)?.index ?? 0} />)}</CardGrid>
            ) : (
              <p className="text-[.78rem] text-muted-foreground">Nothing here yet. Check back as more chapters get rated.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
