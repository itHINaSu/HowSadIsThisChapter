# Two images from one file; docker-compose.yml picks the target.

# The mobile web app, served by nginx. Data comes from the shared volume.
FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
RUN rm -rf /usr/share/nginx/html/api

# Rebuilds the data from howsadisthischapter.com on a schedule.
FROM node:22-alpine AS updater
WORKDIR /app
COPY package.json ./
COPY scripts/ ./scripts/
ENV OUT_DIR=/data NODE_ENV=production
# Runs unprivileged; docker-compose.yml overrides the user with PUID:PGID
# so the files in ./data belong to whoever owns that folder.
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "scripts/updater.mjs"]
