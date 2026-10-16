# Two images from one file; docker-compose.yml picks the target.

# Build the web app once, on the build machine's own platform (the output is
# plain files, the same for every architecture).
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build && rm -rf dist/api

# The mobile web app, served by nginx. Data comes from the shared volume.
FROM nginx:1.27-alpine AS web
# A template: nginx fills in ${PUBLIC_URL} from the environment at startup.
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ /usr/share/nginx/html/
# The address people use to reach the app (e.g. https://howsad.example.com),
# used for shared links. Empty: shared links go to the original site.
ENV PUBLIC_URL=""
# Stamp the build's version so open apps can tell when to reload.
ARG VERSION=dev
RUN cd /usr/share/nginx/html \
 && sed -i "s/__APP_VERSION__/${VERSION}/g" index.html sw.js \
 && printf '{"version":"%s"}\n' "${VERSION}" > version.json

# Rebuilds the data from howsadisthischapter.com on a schedule. Uses only
# Node's built-in modules, so there's nothing to install.
FROM node:22-alpine AS updater
WORKDIR /app
COPY package.json ./
COPY scripts/ ./scripts/
ENV OUT_DIR=/data NODE_ENV=production
# Runs unprivileged; docker-compose.yml sets the user
# so the files in ./data belong to whoever owns that folder.
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "scripts/updater.mjs"]
