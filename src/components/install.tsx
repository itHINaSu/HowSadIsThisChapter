// "Get the app": install steps for the reader's device (with the buttons to
// tap drawn inline), a one-tap Install button where the browser offers one,
// and a dismissible banner for phones. Hidden inside the installed app.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { platform, useInstall, type Platform } from "@/lib/install";
import { store, useStored } from "@/lib/storage";
import { Button, IconButton, buttonVariants } from "./ui/button";
import { Panel, PanelText } from "./ui/panel";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="glyph mx-0.5 inline-block size-[1.5em] rounded-md border-2 border-foreground bg-background p-0.5 align-[-.45em] [&_circle]:fill-current [&_circle]:stroke-none"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
const G = {
  share: <Glyph><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" /></Glyph>,
  more: <Glyph><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></Glyph>,
  addHome: <Glyph><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></Glyph>,
  menu: <Glyph><circle cx="12" cy="5" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="12" cy="19" r="1.3" /></Glyph>,
  install: <Glyph><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M12 7v6M9 10.5l3 3 3-3" /><path d="M8 20h8" /></Glyph>,
};

const STEPS: Record<Platform, [string, ReactNode[]]> = {
  ios: ["iPhone and iPad", [
    <>Tap the <strong>Share</strong> button {G.share}. In Safari it may be inside the {G.more} menu.</>,
    <>Scroll down and tap <strong>Add to Home Screen</strong> {G.addHome}.</>,
    <>If you see <strong>Open as Web App</strong>, leave it on, then tap <strong>Add</strong>.</>,
  ]],
  android: ["Android", [
    <>Tap the browser's menu button {G.menu}.</>,
    <>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</>,
    <>Tap <strong>Install</strong> to confirm.</>,
  ]],
  desktop: ["Chrome, Edge or Brave on a computer", [
    <>Click the install icon {G.install} at the right end of the address bar.</>,
    <>Or open the browser menu and look for <strong>Install</strong> (in Chrome it's under <strong>Cast, save and share</strong>; in Edge, under <strong>Apps</strong>).</>,
  ]],
  mac: ["Safari on a Mac", [<>Choose <strong>File → Add to Dock</strong> (macOS Sonoma or later).</>]],
  firefox: ["Firefox on a computer", [
    <>Most versions of Firefox on computers can't install web apps. Open this page in Chrome, Edge, Brave or Safari to install it.</>,
  ]],
};

function StepList({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="steps mt-2 mb-1 list-decimal pl-[1.4em] font-bold marker:font-black marker:text-primary">
      {steps.map((s, i) => <li key={i} className="mb-2 leading-relaxed">{s}</li>)}
    </ol>
  );
}

export function InstallSection() {
  const { installed, canPrompt, install } = useInstall();
  if (installed) return null;
  const here = platform();
  const others = (["ios", "android", "desktop", "mac"] as Platform[]).filter((k) => k !== here);
  return (
    <Panel id="install" title="Get the app" className="install scroll-mt-24">
      <PanelText>Install How Sad? on your home screen or desktop so it opens like an app, full screen and without the browser bars. It updates itself.</PanelText>
      {canPrompt ? <Button variant="primary" className="mt-2" onClick={install}>Install the app</Button> : <StepList steps={STEPS[here][1]} />}
      {!window.isSecureContext && (
        <p className="mt-1.5 text-[.78rem] font-bold text-muted-foreground">
          This server doesn't use HTTPS, so some browsers will only add a shortcut, and the app won't work offline.
        </p>
      )}
      <details className="other-devices mt-2.5 border-t-2 border-foreground pt-2">
        <summary className="flex min-h-8 cursor-pointer items-center text-[.85rem] font-black uppercase">Other devices</summary>
        {others.map((k) => (
          <div key={k}>
            <p className="mt-2.5 font-bold">{STEPS[k][0]}</p>
            <StepList steps={STEPS[k][1]} />
          </div>
        ))}
      </details>
    </Panel>
  );
}

/** Small banner on the library for phones and tablets that haven't installed the app. */
export function InstallBanner() {
  const { installed, canPrompt, install } = useInstall();
  const dismissed = useStored("install-dismissed", false);
  if (installed || dismissed || !matchMedia("(pointer: coarse)").matches) return null;
  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="install-banner mt-[18px] grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 border-2 border-foreground bg-highlight py-2.5 pr-2.5 pl-3.5 text-highlight-foreground shadow-hard-sm">
        <p className="m-0 text-[.85rem] font-bold">
          <strong>Get the app.</strong> Add How Sad? to your home screen for quick access.
        </p>
        {canPrompt ? (
          <Button variant="primary" size="sm" onClick={install}>Install</Button>
        ) : (
          <Link to="/me" search={{ install: true }} className={buttonVariants({ size: "sm" })}>How to</Link>
        )}
        <IconButton data-install-dismiss aria-label="Dismiss" className="size-9" onClick={() => store.set("install-dismissed", true)}>
          ✕
        </IconButton>
      </div>
    </div>
  );
}
