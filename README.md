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

## What it does

Four tabs (along the bottom on phones and tablets; in the header, or a menu in narrow windows, on computers):

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
tappable sadness timeline, reading status, share links for books and chapters,
and flags for warnings you avoid even while other spoilers stay hidden.

Everything personal is stored only on the device; there are no accounts.

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
# Copy this into your own folder and edit the values in place.
# Create the data folder first (mkdir -p data), owned by the user below.
services:
  web:
    image: ghcr.io/ithinasu/howsadisthischapter-web:latest
    ports:
      - "8080:80"            # change 8080 to the port you want
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
├── updater  (node)   every 24h: build JSON into the shared volume
└── web      (nginx)  serves site/ and the JSON at /api/
```

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
npm test               # parser tests against a saved book page
npm run build-data     # build data into site/api (needs internet)
npm run serve          # serve site/ on http://localhost:8080
```

To match the site's exact colours, change the tokens at the top of
`site/styles.css`.
