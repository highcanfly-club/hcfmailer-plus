#!/bin/bash
CERT_DIR=${CERT_DIR:='/app/server/files/certs'}
mkdir -p $CERT_DIR
if [ -z $CERT_SECRET ]; then
    if [ ! -f $CERT_DIR/$CLOUDFLARE_DNS_RECORDS.key ]; then
        sleep $(($(od -vAn -N2 -tu2 </dev/urandom) % 60))
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
else
    if [ -f /var/run/secrets/kubernetes.io/serviceaccount/namespace ]; then
        #only in k8s namespace
        NAMESPACE=`cat /var/run/secrets/kubernetes.io/serviceaccount/namespace`
        echo "use certificate from Kubernetes secret $NAMESPACE/$CERT_SECRET"
        autocert -cert-dir=$CERT_DIR -dns-name=$CLOUDFLARE_DNS_RECORDS -secret=$CERT_SECRET
    fi
fi
