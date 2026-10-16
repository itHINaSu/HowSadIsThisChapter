// Colour helpers and the sadness timeline (one segment per chapter).
import { verdict, VERDICTS, type Verdict } from "@/lib/moods";
import { chapterName, fmt, level } from "@/lib/format";
import type { MoodId } from "@/lib/storage";
import type { Chapter } from "@/lib/types";
import { cn } from "@/lib/utils";

export const LEVEL_BG = { 1: "bg-s1", 2: "bg-s2", 3: "bg-s3", 4: "bg-s4", 5: "bg-s5" } as const;
export const VERDICT_BG: Record<Verdict, string> = {
  go: "bg-go text-go-foreground",
  caution: "bg-caution text-caution-foreground",
  stop: "bg-stop text-stop-foreground",
};

/** Background for a chapter average: the mood's verdict colour, or the sadness scale without a mood. */
export function sadnessBg(mood: MoodId | null, avg: number | null | undefined) {
  if (avg === null || avg === undefined) return "bg-muted";
  const v = verdict(mood, avg);
  return v ? VERDICT_BG[v] : LEVEL_BG[level(avg)];
}

/**
 * A strip with one segment per chapter, coloured by the reader's mood
 * (or by sadness level with no mood set). Grey = not enough ratings.
 * Pass `chapters` and `onJump` to make the segments tappable.
 */
export function Timeline({
  values,
  mood,
  chapters,
  onJump,
  className,
}: {
  values: (number | null)[];
  mood: MoodId | null;
  chapters?: Chapter[];
  onJump?: (index: number) => void;
  className?: string;
}) {
  if (!values.length) return null;
  const interactive = !!chapters && !!onJump;
  // Long books drop the dividers so every chapter keeps a sliver of colour.
  const dense = values.length > 60;
  return (
    <div
      className={cn(
        "timeline flex h-2.5 min-w-0 max-w-full gap-px overflow-hidden",
        interactive && "interactive mt-2.5 h-[30px] border-2 border-foreground bg-foreground",
        interactive && dense && "gap-0",
        className,
      )}
      aria-hidden={interactive ? undefined : true}
    >
      {values.map((avg, i) => {
        const bg = sadnessBg(mood, avg);
        if (!interactive) return <span key={i} className={cn("min-w-0 flex-1 basis-0", bg)} />;
        const v = verdict(mood, avg);
        const name = chapterName(chapters[i]);
        const label = avg === null ? `${name}: not enough ratings` : `${name}: ${fmt(avg)}${v ? `, ${VERDICTS[v]}` : ""}`;
        return (
          <button
            key={i}
            type="button"
            data-jump={i}
            aria-label={label}
            title={label}
            onClick={() => onJump(i)}
            className={cn(
              "min-w-0 flex-1 basis-0 cursor-pointer appearance-none rounded-none border-0 p-0",
              "hover:relative hover:z-10 hover:outline-2 hover:-outline-offset-2 hover:outline-primary",
              "focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
              bg,
            )}
          />
        );
      })}
    </div>
  );
}
