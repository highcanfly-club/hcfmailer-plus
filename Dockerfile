# Mutistaged Node.js Build
FROM golang:1.21-alpine AS gobuilder
WORKDIR /app
COPY autocert/* ./
RUN go mod tidy
RUN go build -o autocert -ldflags="-s -w" main.go

FROM node:20-alpine AS builder

# Install system dependencies
RUN set -ex; \
    apk add --update --no-cache \
    make gcc g++ git python3 automake autoconf

RUN set -ex; \
    cd / &&\
    git clone https://github.com/eltorio/mpack.git &&\
    cd mpack &&\
    rm -f aclocal.m4 && aclocal && automake --add-missing && autoreconf &&\
    ./configure &&\
    make 

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
RUN cd /app/client && npm install --legacy-peer-deps 
RUN cd /app/shared && npm install  --legacy-peer-deps --production
RUN cd /app/server && npm install --production
RUN cd /app/zone-mta && npm install --production

# Later, copy the app files. That improves development speed as building the Docker image will not have
# to download and install all the NPM dependencies every time there's a change in the source code
COPY . /app

RUN set -ex; \
   cd /app/client && \
   npm run setdate &&\
   NODE_OPTIONS=--openssl-legacy-provider npm run build 
RUN set -ex; \
   cd /app/client && \
   rm -rf node_modules

# Final Image
FROM node:20-alpine
LABEL maintainer="Ronan Le Meillat <ronan@parapente.eu.org>"
WORKDIR /app/

# Install system dependencies
RUN set -ex; \
    apk add --update --no-cache \
    pwgen netcat-openbsd bash imagemagick curl acme.sh xz imagemagick file jpeg &&\
    echo "23       20      *       *       0       /autobackup" >> /etc/crontabs/root &&\
    echo "23       43      *       *       *       /autobackup-s3" >> /etc/crontabs/root &&\
    echo "*/10     *       *       *       *       sleep \$((\`od -vAn -N2 -tu2 < /dev/urandom\` %300)) ; /update-cloudflare-dns.sh" >> /etc/crontabs/root &&\
    echo "0        0       *       *       0       sleep \$((\`od -vAn -N2 -tu2 < /dev/urandom\` %14400)) ; acme.sh --renew-all --config-home /app/server/files/certs/config" >> /etc/crontabs/root 
COPY --chmod=755 scripts/init-cloudflare.sh /app/
COPY --chmod=755 scripts/init-letsencrypt.sh /app/
COPY --chmod=755 scripts/update-cloudflare-dns.sh /
COPY --chmod=755 scripts/autobackup /
RUN chmod ugo+x /app/init-cloudflare.sh &&\
    chmod ugo+x /app/init-letsencrypt.sh &&\
    chmod ugo+x /update-cloudflare-dns.sh &&\
    chmod ugo+x /autobackup

COPY --from=builder /app/docker-entrypoint.sh  /app/docker-entrypoint.sh 
COPY --from=builder /app/client /app/client
COPY --from=builder /app/locales /app/locales
COPY --from=builder /app/mvis /app/mvis
COPY --from=builder /app/proxy /app/proxy
COPY --from=builder /app/scripts /app/scripts
COPY --from=builder /app/server /app/server
COPY --from=builder /app/setup /app/setup
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/unlockMigration.sh /app/unlockMigration.sh
COPY --from=builder /app/zone-mta /app/zone-mta
COPY --from=builder /mpack/mpack /usr/bin/mpack
COPY --from=builder /mpack/munpack /usr/bin/munpack
COPY --from=gobuilder /app/autocert /usr/bin/autocert

RUN set -ex; \
    apk add --update --no-cache \
    mysql-client mariadb-connector-c-dev

RUN ARCH=$(uname -m)\
    && if [ "$ARCH" = "x86_64" ]; then\
        curl -L https://dl.min.io/client/mc/release/linux-amd64/mc > /usr/local/bin/mc && chmod +x /usr/local/bin/mc;\
    elif [ "$ARCH" = "aarch64" ]; then\
        curl -L https://dl.min.io/client/mc/release/linux-arm64/mc > /usr/local/bin/mc && chmod +x /usr/local/bin/mc;\
    else\
        curl -L https://dl.min.io/client/mc/release/linux-arm/mc > /usr/local/bin/mc && chmod +x /usr/local/bin/mc;\
    fi
COPY --chmod=755 scripts/init-from-s3.sh /app/init-from-s3.sh
COPY --chmod=755 scripts/autobackup-s3 /autobackup-s3
EXPOSE 3000 3003 3004
ENTRYPOINT ["bash", "/app/docker-entrypoint.sh"]
