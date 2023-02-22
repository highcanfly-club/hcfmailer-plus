# Mutistaged Node.js Build
FROM node:18-alpine as builder

# Install system dependencies
RUN set -ex; \
    apk add --update --no-cache \
    make gcc g++ git python3

# Copy package.json dependencies
COPY server/package.json /app/server/package.json
COPY server/package-lock.json /app/server/package-lock.json
COPY client/package.json /app/client/package.json
COPY client/package-lock.json /app/client/package-lock.json
COPY shared/package.json /app/shared/package.json
COPY shared/package-lock.json /app/shared/package-lock.json
COPY zone-mta/package.json /app/zone-mta/package.json
COPY zone-mta/package-lock.json /app/zone-mta/package-lock.json

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
   NODE_OPTIONS=--openssl-legacy-provider npm run build && \
   rm -rf node_modules

# Final Image
FROM node:18-alpine
LABEL maintainer="Ronan Le Meillat <ronan@parapente.cf>"
WORKDIR /app/

# Install system dependencies
RUN set -ex; \
    apk add --update --no-cache \
    pwgen netcat-openbsd bash imagemagick curl acme.sh &&\
    echo "*/10     *       *       *       *       sleep \$((\`od -vAn -N2 -tu2 < /dev/urandom\` %300)) ; /update-cloudflare-dns.sh" >> /etc/crontabs/root &&\
    echo "0        0       *       *       0       sleep \$((\`od -vAn -N2 -tu2 < /dev/urandom\` %14400)) ; acme.sh --renew-all --config-home /app/server/files/certs/config" >> /etc/crontabs/root 
COPY scripts/init-cloudflare.sh /app/
COPY scripts/init-letsencrypt.sh /app/
COPY scripts/update-cloudflare-dns.sh /
RUN chmod ugo+x /app/init-cloudflare.sh &&\
    chmod ugo+x /app/init-letsencrypt.sh &&\
    chmod ugo+x /update-cloudflare-dns.sh

COPY --from=builder /app/ /app/

EXPOSE 3000 3003 3004
ENTRYPOINT ["bash", "/app/docker-entrypoint.sh"]
