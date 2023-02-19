# Mutistaged Node.js Build
FROM node:16-alpine as builder

# Install system dependencies
RUN set -ex; \
    apk add --update --no-cache \
    make gcc g++ git python3

# Copy package.json dependencies
COPY server/package.json /app/server/package.json
COPY client/package.json /app/client/package.json
COPY shared/package.json /app/shared/package.json
COPY zone-mta/package.json /app/zone-mta/package.json

# Install dependencies in each directory
RUN cd /app/client && npm install
RUN cd /app/shared && npm install --production
RUN cd /app/server && npm install --production
RUN cd /app/zone-mta && npm install --production

# Later, copy the app files. That improves development speed as building the Docker image will not have
# to download and install all the NPM dependencies every time there's a change in the source code
COPY . /app

RUN set -ex; \
   cd /app/client && \
   npm run build && \
   rm -rf node_modules

# Final Image
FROM node:16-alpine

WORKDIR /app/

# Install system dependencies
RUN set -ex; \
    apk add --update --no-cache \
    pwgen netcat-openbsd bash imagemagick

COPY --from=builder /app/ /app/

EXPOSE 3000 3003 3004
ENTRYPOINT ["bash", "/app/docker-entrypoint.sh"]
