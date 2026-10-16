// Server settings, read once at startup from config.json (the web container
// writes it from its environment; see docker/nginx.conf).
type Config = { publicUrl: string | null };

let config: Config = { publicUrl: null };

export async function loadConfig() {
  try {
    const res = await fetch("config.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { publicUrl?: string };
    const url = data.publicUrl?.trim().replace(/\/+$/, "");
    config = { publicUrl: url && /^https?:\/\//.test(url) ? url : null };
  } catch {}
}

/** The app's public address (e.g. https://howsad.example.com), if the server set one. */
export const publicUrl = () => config.publicUrl;
