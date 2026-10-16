// Book page: per-chapter sadness, mood verdicts, reading progress and
// content warnings (hidden until asked, except ones the reader avoids).
import { Link, getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Cover } from "@/components/cover";
import { EyeOffIcon, ShareIcon } from "@/components/icons";
import { BackToLibrary, Hero, badgeClass } from "@/components/layout";
import { MoodPicker } from "@/components/mood-picker";
import { AheadSummary, NextChapters } from "@/components/progress";
import { LEVEL_BG, Timeline, VERDICT_BG } from "@/components/sadness";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel, PanelText, legendClass } from "@/components/ui/panel";
import { bookQuery, libraryQuery } from "@/lib/data";
import { SITE, chapterName, dnfText, fmt, level, plural } from "@/lib/format";
import { moodById, verdict, VERDICTS } from "@/lib/moods";
import { shareBook } from "@/lib/share";
import { store, updateShelf, useAvoid, useMood, useShelf, useShowWarnings, type MoodId, type ShelfStatus } from "@/lib/storage";
import type { Chapter, WarningType } from "@/lib/types";
import { cn } from "@/lib/utils";

const route = getRouteApi("/book/$slug/{-$chapter}");

const noteClass = "note mb-[22px] border-2 border-foreground p-3 text-[.9rem] font-black";
const STATUSES: [ShelfStatus, string][] = [["reading", "Reading"], ["finished", "Finished"], ["bailed", "Bailed"]];

const scrollToChapter = (i: number, block: ScrollLogicalPosition = "start") =>
  document.getElementById(`ch-${i}`)?.scrollIntoView({ behavior: "smooth", block });

export function BookPage() {
  const { slug, chapter: jumpTo } = route.useParams();
  const { data: library } = useSuspenseQuery(libraryQuery);
  const { data: book } = useSuspenseQuery(bookQuery(slug));
  const mood = useMood();
  const avoid = useAvoid();
  const showWarnings = useShowWarnings();
  const entry = useShelf()[book.slug] ?? {};
  const here = entry.chapter ?? null;

  const t = library.meta.thresholds ?? {};
  const minVotes = t.sadnessMinVotes ?? 5;
  const worst = t.worstAhead ?? 4.5;
  const limited = Math.max(0, ...book.chapters.map((c) => c.votes)) < (t.sadnessLimitedDataVotes ?? 50);
  const index = library.bySlug.get(book.slug)?.index ?? 0;
  const avoidedChapters = book.chapters.filter((c) => c.warnings.some((w) => avoid.has(w.id)));
  const dnf = dnfText(book.dnf);

  // Deep link #/book/<slug>/<n>: jump to chapter n and flash it.
  useEffect(() => {
    const n = Number(jumpTo);
    if (!n) return;
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(`ch-${n - 1}`);
      if (!el) return;
      el.scrollIntoView({ block: "start" });
      el.classList.remove("animate-flash");
      void el.offsetWidth;
      el.classList.add("animate-flash");
    });
    return () => cancelAnimationFrame(id);
  }, [slug, jumpTo]);

  const rateUrl = `${SITE}/book/${encodeURIComponent(book.slug)}?mode=rate`;

  return (
    <>
      <Hero mark={false} className="pt-6 pb-9">
        <div className="mx-auto grid max-w-5xl grid-cols-[112px_minmax(0,1fr)] items-start gap-5 min-[640px]:grid-cols-[180px_minmax(0,1fr)]">
          <Cover src={book.cover} title={book.title} index={index} className="bg-foreground object-cover shadow-hard-bg" />
          <div>
            <BackToLibrary />
            <p className={badgeClass}>Spoiler-light check</p>
            <h1 className="m-0 font-display text-[clamp(1.9rem,8vw,3.6rem)] leading-[1.05] font-normal [overflow-wrap:anywhere]">{book.title}</h1>
            <p className="mt-2.5 text-[1.05rem] font-bold">by {book.author}</p>
            {book.series && (
              <p className="mt-2 text-[.72rem] font-black tracking-[.03em] uppercase">
                Part of the{" "}
                <Link to="/series/$slug" params={{ slug: book.series.slug }} className="underline decoration-2 underline-offset-4">
                  {book.series.title} series
                </Link>
              </p>
            )}
            <div className="mt-3.5 flex flex-wrap gap-2">
              <a className={buttonVariants({ size: "sm" })} href={rateUrl} target="_blank" rel="noopener">Rate this book</a>
              <a className={buttonVariants({ size: "sm" })} href={`${SITE}/book/${encodeURIComponent(book.slug)}`} target="_blank" rel="noopener">
                Open on site
              </a>
              <Button size="sm" id="share-book" onClick={() => shareBook(`${book.title} — How sad is it?`, book.slug)}>
                <ShareIcon />
                Share
              </Button>
            </div>
          </div>
        </div>
      </Hero>

      <div className="book-body mx-auto max-w-5xl px-4 pt-7 pb-12">
        {limited && <p className={cn(noteClass, "bg-highlight text-highlight-foreground")} role="note">Warning: this book has limited ratings, so these averages may change.</p>}
        {dnf && <p className={cn(noteClass, "dnf bg-card text-foreground")} role="note">{dnf}</p>}
        {avoidedChapters.length > 0 && (
          <p className={cn(noteClass, "avoid-note bg-stop text-stop-foreground")} role="note">
            {avoidedChapters.length} chapter{avoidedChapters.length === 1 ? " has" : "s have"} warnings you avoid:{" "}
            {avoidedChapters.slice(0, 6).map(chapterName).join(", ")}
            {avoidedChapters.length > 6 ? "…" : ""}.
          </p>
        )}

        {book.chapters.length > 0 && (
          <Panel title="Sadness through the book">
            <Timeline values={book.chapters.map((c) => c.average)} mood={mood} chapters={book.chapters} onJump={(i) => scrollToChapter(i)} />
            <PanelText className="timeline-key text-[.8rem]">
              {mood
                ? `Coloured for “${moodById(mood)!.short}”: green go, yellow caution, red don't.`
                : "Greener is gentler, redder is sadder."}{" "}
              Grey: not enough ratings. Tap a chapter to jump to it.
            </PanelText>
          </Panel>
        )}

        <Panel legend="First things first">
          <h2 className="m-0 font-display text-[1.4rem] leading-tight font-normal">How are you doing right now?</h2>
          <PanelText>Choose how you're feeling and we'll tell you if you can handle each chapter.</PanelText>
          <MoodPicker />
        </Panel>

        <Panel legend="Where are you at?">
          <div role="group" aria-label="Reading status" className="segmented mt-1 flex flex-wrap gap-2">
            {STATUSES.map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                data-status={k}
                aria-pressed={entry.status === k}
                className="min-w-[90px] flex-1"
                onClick={() => updateShelf(book.slug, { status: entry.status === k ? undefined : k })}
              >
                {label}
              </Button>
            ))}
          </div>
          <select
            id="here"
            aria-label="Chapter you're on"
            value={here ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              updateShelf(book.slug, { chapter: v === "" ? null : Number(v), status: v === "" ? entry.status : entry.status ?? "reading" });
              if (v !== "") requestAnimationFrame(() => scrollToChapter(Number(v), "center"));
            }}
            className="mt-2.5 min-h-12 w-full rounded-md border-2 border-foreground bg-background px-2.5 py-2 font-bold"
          >
            <option value="">Haven't started / just browsing</option>
            {book.chapters.map((c, i) => <option key={c.id} value={i}>{chapterName(c)}</option>)}
          </select>
          {here !== null && book.chapters[here] && (
            <>
              <AheadSummary book={book} here={here} mood={mood} worst={worst} />
              <p className="mt-3.5 text-[.72rem] font-black uppercase">Next up</p>
              <NextChapters book={book} here={here} mood={mood} />
            </>
          )}
        </Panel>

        <Panel legend="Spoiler comfort">
          <div className="two mt-2.5 grid gap-2 min-[560px]:grid-cols-2">
            <Button size="lg" data-cw="0" aria-pressed={!showWarnings} onClick={() => store.set("show-warnings", false)}>Hide content warnings</Button>
            <Button size="lg" data-cw="1" aria-pressed={showWarnings} onClick={() => store.set("show-warnings", true)}>Show content warnings</Button>
          </div>
        </Panel>

        <div className="chapters grid gap-[22px]">
          {book.chapters.length ? (
            book.chapters.map((c, i) => (
              <ChapterCard
                key={c.id}
                chapter={c}
                index={i}
                here={here}
                ctx={{ showWarnings, mood, avoid, minVotes, warningTypes: library.meta.warningTypes }}
              />
            ))
          ) : (
            <p className="empty py-14 text-center font-bold text-muted-foreground">No chapters listed for this book yet.</p>
          )}
        </div>
        <div className="mt-[30px] text-center">
          <a className={buttonVariants({ variant: "primary" })} href={rateUrl} target="_blank" rel="noopener">Read it already? Add your ratings</a>
        </div>
      </div>
    </>
  );
}

type ChapterCtx = { showWarnings: boolean; mood: MoodId | null; avoid: Set<string>; minVotes: number; warningTypes: WarningType[] };

const tagClass = "border-2 border-foreground px-2 py-[3px] text-[.78rem] font-black";
const hiddenClass =
  "cw-hidden mt-2 flex min-h-12 items-center gap-2 border border-dashed border-foreground px-3 py-1.5 text-[.85rem] font-bold text-muted-foreground";

function ChapterCard({ chapter: c, index: i, here, ctx }: { chapter: Chapter; index: number; here: number | null; ctx: ChapterCtx }) {
  const { showWarnings, mood, avoid, minVotes, warningTypes } = ctx;
  const avg = c.average;
  const s = avg !== null ? level(avg) : 0;
  const name = chapterName(c);
  const warningName = (id: string) => warningTypes.find((w) => w.id === id)?.name ?? "Content warning";
  const avoided = c.warnings.filter((w) => avoid.has(w.id));
  const v = verdict(mood, avg);

  const tag = (id: string) => (
    <span key={id} className={cn(tagClass, avoid.has(id) ? "is-avoided bg-stop text-stop-foreground" : "bg-highlight text-highlight-foreground")}>
      {warningName(id)}
    </span>
  );

  return (
    <article
      id={`ch-${i}`}
      className={cn(
        "chapter scroll-mt-4 border-2 border-foreground bg-card p-4 shadow-hard-md desk:scroll-mt-[84px]",
        here !== null && i === here && "here outline-4 outline-offset-3 outline-highlight",
        here !== null && i < here && "past opacity-50",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3.5 border-b border-foreground/30 pb-3">
        <div>
          <h3 className="m-0 font-display text-[1.2rem] leading-tight font-normal [overflow-wrap:anywhere]">{name}</h3>
          <p className="count mt-1 text-[.85rem] font-bold text-muted-foreground">
            {avg !== null ? plural(c.votes, "rating") : `${c.votes} of ${minVotes} ratings needed for an average`}
          </p>
        </div>
        <div className="text-right" aria-label={avg !== null ? `Average sadness ${fmt(avg)} out of 5` : "Average sadness rating not available"}>
          <span className="font-display text-[1.9rem] leading-none text-primary">{avg !== null ? fmt(avg) : "?"}</span>
          <span className="block text-[.6rem] font-black text-muted-foreground uppercase">Average</span>
        </div>
      </div>

      <div className="meter mt-3 grid grid-cols-5 gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((k) => (
          <span key={k} className={cn("h-2.5 border-[1.5px] border-foreground", avg !== null && k < s ? LEVEL_BG[level(avg)] : "bg-muted")} />
        ))}
      </div>

      {mood === null ? (
        <p className="verdict-hint mt-3.5 text-[.85rem] font-bold text-muted-foreground">Pick your mood above and we'll tell you if you can handle this one.</p>
      ) : v ? (
        <p className={cn("verdict mt-3.5 inline-block border-2 border-foreground px-3 py-2 text-[.85rem] font-black uppercase", `v-${v}`, VERDICT_BG[v])} role="status">
          {VERDICTS[v]}
        </p>
      ) : (
        <p className="verdict-hint mt-3.5 text-[.85rem] font-bold text-muted-foreground">Not enough ratings for a verdict yet.</p>
      )}

      <div className="cw mt-3.5 border-t border-foreground/30 pt-3">
        <p className={cn(legendClass, "m-0 px-0")}>
          Content warnings
          {avoided.length > 0 && <span className="avoid-tag ml-1.5 bg-stop px-1.5 py-px text-stop-foreground">{avoided.length} you avoid</span>}
        </p>
        {showWarnings ? (
          c.warnings.length ? (
            <div className="cw-list mt-2 flex flex-wrap gap-1.5">{c.warnings.map((w) => tag(w.id))}</div>
          ) : (
            <p className="mt-2 text-[.85rem] font-bold text-muted-foreground">No warnings flagged by enough readers yet.</p>
          )
        ) : avoided.length ? (
          // The reader asked to be told about these, so they show even with spoilers hidden.
          <>
            <div className="cw-list mt-2 flex flex-wrap gap-1.5">{avoided.map((w) => tag(w.id))}</div>
            <div className={hiddenClass}><EyeOffIcon />Other warnings are hidden until you ask.</div>
          </>
        ) : (
          <div className={hiddenClass}><EyeOffIcon />Spoilers are hidden until you ask.</div>
        )}
      </div>
    </article>
  );
}
