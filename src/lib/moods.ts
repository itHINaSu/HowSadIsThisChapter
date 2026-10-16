// "How are you feeling?" moods and the go / caution / stop verdicts.
// Same thresholds and wording as howsadisthischapter.com.
import type { MoodId } from "./storage";

export type Mood = { id: MoodId; label: string; short: string; goBelow: number; cautionBelow: number };

export const MOODS: Mood[] = [
  { id: "fine", label: "I'm doing fine!", short: "Doing fine", goBelow: 4, cautionBelow: 4.5 },
  { id: "fragile", label: "I'm a little fragile", short: "A little fragile", goBelow: 2.5, cautionBelow: 4 },
  { id: "devastated", label: "I am emotionally devastated", short: "Devastated", goBelow: 1.5, cautionBelow: 2.5 },
  { id: "enraged", label: "I'm enraged at the state of the world and am reading to cope", short: "Enraged, coping", goBelow: Infinity, cautionBelow: Infinity },
];

export type Verdict = "go" | "caution" | "stop";

export const VERDICTS: Record<Verdict, string> = {
  go: "Go for it",
  caution: "Proceed with caution",
  stop: "Don't do it babe",
};

export const moodById = (id: MoodId | null) => MOODS.find((m) => m.id === id) ?? null;

/** The verdict for a chapter average in a given mood (null without a mood or average). */
export function verdict(moodId: MoodId | null, avg: number | null | undefined): Verdict | null {
  const mood = moodById(moodId);
  if (!mood || avg === null || avg === undefined) return null;
  return avg < mood.goBelow ? "go" : avg < mood.cautionBelow ? "caution" : "stop";
}
