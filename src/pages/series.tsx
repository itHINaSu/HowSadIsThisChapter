// A series: its books in order.
import { getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BookCard, CardGrid } from "@/components/book-card";
import { BackToLibrary, Hero, badgeClass, emptyClass, heroTitleClass, wrapClass } from "@/components/layout";
import { libraryQuery } from "@/lib/data";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const route = getRouteApi("/series/$slug");

export function SeriesPage() {
  const { slug } = route.useParams();
  const { data: library } = useSuspenseQuery(libraryQuery);
  const series = library.series.find((s) => s.slug === slug);
  if (!series) return <div className={wrapClass}><p className={emptyClass}>We couldn't find that series.</p></div>;
  const books = series.books.map((s) => library.bySlug.get(s.slug)).filter((b) => !!b);
  return (
    <>
      <Hero>
        <BackToLibrary />
        <p className={badgeClass}>Series</p>
        <h1 className={heroTitleClass}>{series.title}</h1>
        <p className="mt-4 max-w-xl text-[1.1rem] font-bold">{plural(books.length, "book")} with chapter ratings.</p>
      </Hero>
      <section className={cn("section pt-9 pb-12", wrapClass)}>
        <CardGrid>{books.map((b) => <BookCard key={b.slug} book={b} index={b.index} />)}</CardGrid>
      </section>
    </>
  );
}
