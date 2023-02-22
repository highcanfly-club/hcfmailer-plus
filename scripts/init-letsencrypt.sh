#!/bin/bash
CERT_DIR=/app/server/files/certs
if [ ! -f $CERT_DIR/$CLOUDFLARE_DNS_RECORDS.key ]; then
    sleep $((`od -vAn -N2 -tu2 < /dev/urandom` %60))
    mkdir -p $CERT_DIR/config
    export CF_Token="$CLOUDFLARE_API_KEY"
    acme.sh --issue -d $CLOUDFLARE_DNS_RECORDS --dns dns_cf --ocsp-must-staple --config-home $CERT_DIR/config \
                                --keylength 4096 --server letsencrypt \
                                --cert-file $CERT_DIR/$CLOUDFLARE_DNS_RECORDS.pem --key-file $CERT_DIR/$CLOUDFLARE_DNS_RECORDS.key \
                                --fullchain-file $CERT_DIR/$CLOUDFLARE_DNS_RECORDS-full.pem
else
    echo "CERT: $CLOUDFLARE_DNS_RECORDS.pem exists…"
    acme.sh --renew-all --config-home $CERT_DIR/config
fi