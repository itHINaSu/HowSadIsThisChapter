// "How are you doing right now?" Tapping the selected mood again clears it.
import { MOODS } from "@/lib/moods";
import { store, useMood, type MoodId } from "@/lib/storage";
import { cn } from "@/lib/utils";

const MOOD_BG: Record<MoodId, string> = {
  fine: "bg-go text-go-foreground",
  fragile: "bg-caution text-caution-foreground",
  devastated: "bg-stop text-stop-foreground",
  enraged: "bg-foreground text-background",
};

export function MoodPicker() {
  const mood = useMood();
  return (
    <div className="moods mt-3 grid gap-2 min-[560px]:grid-cols-2">
      {MOODS.map((m) => {
        const on = mood === m.id;
        return (
          <button
            key={m.id}
            type="button"
            data-mood={m.id}
            aria-pressed={on}
            onClick={() => store.set("mood", on ? null : m.id)}
            className={cn(
              "btn mood inline-flex min-h-14 cursor-pointer items-center justify-start rounded-md border-2 border-foreground px-4 py-2 text-left text-[.9rem] leading-tight font-black whitespace-normal",
              MOOD_BG[m.id],
              // keeps its mood colour when selected, marked with an outline
              on && "shadow-hard outline-3 outline-offset-2 outline-foreground",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
