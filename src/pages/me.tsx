// Me: mood, warnings to avoid, spoilers, text size, theme, install, data
// export/import, and the About page. Everything stays on this device.
import { getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { InstallSection } from "@/components/install";
import { PageHead, wrapClass } from "@/components/layout";
import { MoodPicker } from "@/components/mood-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel, PanelText } from "@/components/ui/panel";
import { ToggleRow } from "@/components/ui/toggle-row";
import { libraryQuery } from "@/lib/data";
import { SITE } from "@/lib/format";
import { DATA_KEYS, store, useAvoid, useShowWarnings, useStored } from "@/lib/storage";
import { applyTextSize, applyTheme, currentTheme, type TextSize, type ThemeChoice } from "@/lib/theme";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const route = getRouteApi("/me");

const SIZES: [TextSize, string][] = [["normal", "Normal"], ["large", "Large"], ["xl", "Extra large"]];
const THEMES: [ThemeChoice, string][] = [["light", "Light"], ["dark", "Dark"], ["system", "Match phone"]];

function exportData() {
  const data: { app: string; version: number; exportedAt: string; items: Record<string, string> } = {
    app: "how-sad-unofficial",
    version: 1,
    exportedAt: new Date().toISOString(),
    items: {},
  };
  for (const k of DATA_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) data.items[k] = v;
    } catch {}
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "how-sad-data.json" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importData(file: File) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== "how-sad-unofficial" || typeof data.items !== "object") throw new Error("Not a How Sad? export");
    for (const k of DATA_KEYS) {
      if (typeof data.items[k] === "string") localStorage.setItem(k, data.items[k]);
      store.touch(k);
    }
    applyTheme(currentTheme());
    applyTextSize(store.get<TextSize>("text-size", "normal"));
    toast("Imported");
  } catch (err) {
    toast(`Couldn't import: ${(err as Error).message}`);
  }
}

function clearData() {
  if (!confirm("Clear your shelf, mood and settings on this device?")) return;
  for (const k of DATA_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {}
    store.touch(k);
  }
  applyTheme("system");
  applyTextSize("normal");
  toast("Cleared");
}

export function MePage() {
  const { data: library } = useSuspenseQuery(libraryQuery);
  const { install } = route.useSearch();
  const avoid = useAvoid();
  const showWarnings = useShowWarnings();
  const size = useStored<TextSize>("text-size", "normal");
  useStored<string | null>("sadness-theme", null); // re-render when the theme changes
  const theme = currentTheme();

  // #/me?install (from the library banner) opens at the install steps.
  useEffect(() => {
    if (install) requestAnimationFrame(() => document.getElementById("install")?.scrollIntoView({ block: "start" }));
  }, [install]);

  return (
    <>
      <PageHead eyebrow="Settings" title="Me">
        <p className="text-[.78rem] text-muted-foreground">Everything here stays on this device. No account needed.</p>
      </PageHead>
      <div className={cn("settings pt-2 pb-10", wrapClass)}>
        <InstallSection />

        <Panel legend="Your mood">
          <PanelText>Used for the go / caution / don't verdicts everywhere in the app.</PanelText>
          <MoodPicker />
        </Panel>

        <Panel legend="Warnings you want to avoid">
          <PanelText>Books and chapters with these get flagged, even when other spoilers are hidden. Only warnings enough readers agree on are counted.</PanelText>
          <div className="mt-1">
            {library.meta.warningTypes.map((w) => (
              <ToggleRow
                key={w.id}
                label={w.name}
                data-avoid={w.id}
                checked={avoid.has(w.id)}
                onChange={(e) => {
                  const next = new Set(avoid);
                  if (e.target.checked) next.add(w.id);
                  else next.delete(w.id);
                  store.set("avoid", [...next]);
                }}
              />
            ))}
          </div>
        </Panel>

        <Panel legend="Spoilers">
          <ToggleRow label="Show content warnings by default" id="show-warnings" checked={showWarnings} onChange={(e) => store.set("show-warnings", e.target.checked)} />
        </Panel>

        <Panel legend="Text size">
          <div role="group" aria-label="Text size" className="segmented mt-1 flex flex-wrap gap-2">
            {SIZES.map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                data-size={k}
                aria-pressed={size === k}
                className="min-w-[90px] flex-1"
                onClick={() => {
                  store.set("text-size", k === "normal" ? null : k);
                  applyTextSize(k);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel legend="Theme">
          <div role="group" aria-label="Theme" className="segmented mt-1 flex flex-wrap gap-2">
            {THEMES.map(([k, label]) => (
              <Button key={k} size="sm" data-theme={k} aria-pressed={theme === k} className="min-w-[90px] flex-1" onClick={() => applyTheme(k)}>
                {label}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel legend="Your data">
          <PanelText>Move your shelf and settings to another phone or browser.</PanelText>
          <div className="two mt-2.5 grid gap-2 min-[560px]:grid-cols-2">
            <Button size="lg" id="export" onClick={exportData}>Export</Button>
            <Button size="lg" id="import" onClick={() => document.getElementById("import-file")?.click()}>Import</Button>
          </div>
          <input
            type="file"
            id="import-file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="danger" id="reset" className="mt-3.5 w-full" onClick={clearData}>
            Clear everything on this device
          </Button>
        </Panel>

        <Panel title="About this app" className="about [&_p]:mt-1.5 [&_p]:font-semibold [&_p]:text-foreground">
          <p>
            An independent, fan-made front end for <a href={SITE} target="_blank" rel="noopener">How Sad Is This Chapter?</a>. It is{" "}
            <strong>not</strong> made, run, affiliated with or endorsed by that site or its creator.
          </p>
          <p>
            All credit for the site, its idea and its design belongs to its creator, and every rating comes from readers on the original
            site. To rate a book or add one, use the main site.
          </p>
          <p>Spotted a problem with a rating or book? Report it on the original site. Problems with this app have nothing to do with them.</p>
          <a className={cn(buttonVariants({ variant: "primary" }), "mt-2.5")} href="https://ko-fi.com/catieosaurus" target="_blank" rel="noopener">
            Tip the original creator
          </a>
        </Panel>
      </div>
    </>
  );
}
