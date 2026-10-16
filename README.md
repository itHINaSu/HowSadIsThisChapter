# How Sad? — unofficial mobile reader for How Sad Is This Chapter?

A phone-friendly, installable web app (PWA) for browsing chapter sadness
ratings and content warnings from [howsadisthischapter.com](https://howsadisthischapter.com).

> **Disclaimer:** this is an independent, fan-made front end. It is not
> made, run, affiliated with or endorsed by How Sad Is This Chapter? or its
> creator. All credit for the original site, its concept, design and
> ratings belongs to its creator and the readers who rate there. This app
> only reads public data and reformats it for phones; "Rate this book"
> buttons send you to the original site. If the site's owner would like
> this changed or taken down, open an issue and it will be.

**For the site's creator:** this app uses the same tools as
howsadisthischapter.com (React, TypeScript, TanStack Router and Query,
Tailwind with shadcn/ui colours). [INTEGRATION.md](INTEGRATION.md) explains
how to bring any of its features into the real site, with prompts for Lovable.

## What it does

Four tabs (along the bottom on phones; in the header on tablets and computers, or a menu in a narrow desktop window):

- **Library**: search and sort every book, with filters (hide spicy books, only
  rated books, hide books with warnings you avoid, group series) and a sadness
  strip on each card. Books not in the library link to the site's "add a book" page.
- **Reading**: your shelf. Books you're reading, with your chapter, the next three
  chapters' verdicts and the saddest part still ahead; plus finished and bailed lists.
- **Discover**: safe for your mood, gentle reads, no warnings you avoid,
  saddest chapters, most rated.
- **Me**: mood, warnings to avoid, spoiler default, text size, theme,
  export/import of your data, and the About page.

Book pages have the site's mood verdicts (same thresholds and wording), a
tappable sadness timeline, reading status, a share button, and flags for warnings you avoid even while other spoilers stay hidden.

Everything personal is stored only on the device; there are no accounts.

The Me tab explains how to install the app on the device you're using, and
phones get a small dismissible banner on the Library page; both disappear
once the app is installed.

**Updates reach installed apps on their own.** Each image build stamps its
commit into the app. When someone returns to the app and the server has a
newer build, it reloads itself (or at the next page change, if the update
lands while they're using it). Nobody needs to close, refresh or reinstall it.

## Run it

The images are built by GitHub Actions and published to `ghcr.io/ithinasu/`.
The compose file below is meant to be copied into your own folder and kept
there, so your ports and ids are never overwritten by an update.

**1. Make a folder, with a `data` folder inside it** (owned by you):

```sh
mkdir -p howsad/data && cd howsad
```

**2. Save this as `docker-compose.yml`** and edit the values in place:

```yaml
services:
  web:
    image: ghcr.io/ithinasu/howsadisthischapter-web:latest
    ports:
      - "8080:80"            # change 8080 to the port you want
    environment:
      # The address people use to reach the app, used for shared links.
      # Leave empty and shared links go to the book on howsadisthischapter.com.
      PUBLIC_URL: ""                # e.g. "https://howsad.example.com"
    volumes:
      - ./data:/data:ro
    restart: unless-stopped

  updater:
    image: ghcr.io/ithinasu/howsadisthischapter-updater:latest
    user: "1000:1000"        # owner of ./data: run `id -u` and `id -g`
    environment:
      UPDATE_INTERVAL_HOURS: "24"   # how often to refresh the ratings
      DELAY_MS: "600"               # pause between book page requests
    volumes:
      - ./data:/data
    restart: unless-stopped
```

| Setting | Default | What it does |
|---|---|---|
| `ports` | `8080:80` | Change the first number to serve on another port |
| `PUBLIC_URL` | empty | Your app's public address (e.g. `https://howsad.example.com`). Share buttons link there. Empty: they link to the book on the original site, so your server's address is never shared |
| `user` | `1000:1000` | User and group the updater writes `./data` as. Use the owner of the `data` folder (`id -u`, `id -g`) |
| `UPDATE_INTERVAL_HOURS` | `24` | How often the ratings are refreshed |
| `DELAY_MS` | `600` | Pause between book page requests |
| image tag | `latest` | Swap `:latest` for `:sha-<commit>` on both images to pin a build |

**3. Start it:**

```sh
docker compose up -d
```

Then open `http://<your-server>:8080` on your phone.

The first data build takes about 10–15 minutes (it fetches every book page
politely, one at a time). Until it finishes, the app says the library is
still being built. After that it refreshes every 24 hours. The data is
written to `./data/api/` and is only a cache of the site's public ratings;
it can be deleted at any time and the updater will rebuild it. Nothing
personal is stored on the server.

**Updating the app:** every push to the repo publishes new images, so

```sh
docker compose pull && docker compose up -d
```

This only fetches new images; your `docker-compose.yml` is left alone.

If the updater logs a permission error, the `data` folder isn't owned by
the compose file's `user`; fix it with `sudo chown -R <uid>:<gid> data`.

To build from a checkout of this repo instead of pulling (it has the same
`docker-compose.yml`):
`docker compose -f docker-compose.yml -f compose.build.yml up -d --build`.

Watch an update with `docker compose logs -f updater`.

### Installing it on your phone ("Add to Home Screen")

The page works on any address, but browsers only allow installing it as an
app and using it offline over **HTTPS** (or `localhost`). If you open it at
a plain `http://192.168.x.x:8080` address, it still works as a website,
just without install/offline. Easy ways to get HTTPS:

- **Tailscale:** `tailscale serve --bg 8080` gives you an `https://…ts.net` address.
- **Cloudflare Tunnel** pointed at `http://localhost:8080`.
- **A reverse proxy** you already run (Caddy, Traefik, nginx) with a certificate.

## How it works

```
docker compose
├── updater  (node)   every 24h: build JSON into ./data
└── web      (nginx)  serves the app and the JSON at /api/
```

The app is React + TypeScript, built with Vite, using TanStack Router and
TanStack Query, styled with Tailwind CSS. See [INTEGRATION.md](INTEGRATION.md)
for a map of the code.

`scripts/build-data.mjs` gets the list of approved books from the site's
public Supabase tables, then reads each `/book/<slug>` page's embedded
data for per-chapter averages (those are only computed on the site's
server). It writes:

- `api/books.json` — every book with a summary (chapters, peak sadness)
- `api/books/<slug>.json` — chapters, averages, vote counts, warnings
- `api/series.json`, `api/meta.json`

The app follows the site's own display rules: no average is shown until a
chapter has 5 ratings, and content warnings stay hidden until you ask.
Each run builds into a temp folder and swaps it in when done; if a book
fails to load, its copy from the last run is kept, and if more than 20% of
books fail, the old data stays in place untouched.

## Development

```sh
npm ci                 # install
npm run build-data     # fetch real data into public/api (needs internet, ~15 min)
npm run dev            # app on http://localhost:8080 with live reload
npm run typecheck      # TypeScript
npm test               # unit tests (logic) and parser tests (saved book page)
npm run test:e2e       # Playwright tests on a sample library
npm run build          # production build into dist/
```

Colours are the tokens at the top of `src/index.css`.
