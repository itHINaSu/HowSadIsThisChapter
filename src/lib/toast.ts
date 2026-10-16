// A tiny app-wide toast: call toast("Link copied") from anywhere.
import { useSyncExternalStore } from "react";

type State = { message: string; visible: boolean };
let state: State = { message: "", visible: false };
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

export function toast(message: string) {
  set({ message, visible: true });
  clearTimeout(timer);
  timer = setTimeout(() => set({ ...state, visible: false }), 2200);
}

export function useToast(): State {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state);
}
