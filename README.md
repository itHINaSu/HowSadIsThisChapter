# How Sad? — mobile companion for How Sad Is This Chapter?

A phone-friendly, installable web app (PWA) for browsing chapter sadness
ratings and content warnings from [howsadisthischapter.com](https://howsadisthischapter.com).
It is an unofficial, read-only companion: all ratings come from that site,
and "Rate this book" buttons send you there.

## Run it

You only need [`docker-compose.yml`](docker-compose.yml). The images are
built by GitHub Actions and published to `ghcr.io/ithinasu/`.

```sh
mkdir howsad && cd howsad
curl -fsSLO https://raw.githubusercontent.com/itHINaSu/HowSadIsThisChapter/HEAD/docker-compose.yml
docker compose up -d
```

Then open `http://<your-server>:8080` on your phone.

**Updating the app:** every push to the repo publishes new images, so

```sh
docker compose pull && docker compose up -d
```

Your ratings data lives in the `data` volume and survives updates. To pin a
specific build instead of `latest`, set `TAG=sha-<commit>` in `.env`.

To build from a checkout instead of pulling:
`docker compose -f docker-compose.yml -f compose.build.yml up -d --build`.

The first data build takes about 10–15 minutes (it fetches every book page
politely, one at a time). Until it finishes, the app says the library is
still being built. After that it refreshes every 24 hours.

Settings (put them in a `.env` file next to `docker-compose.yml`):

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8080` | Port the app is served on |
| `UPDATE_INTERVAL_HOURS` | `24` | How often the ratings are refreshed |
| `DELAY_MS` | `600` | Pause between book page requests |
| `TAG` | `latest` | Image tag to run (`latest`, a branch name, or `sha-<commit>`) |

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
