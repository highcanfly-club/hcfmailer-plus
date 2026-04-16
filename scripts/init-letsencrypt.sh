#!/bin/bash
#
# Copyright (c) 2022-2026 Ronan LE MEILLAT
# License: AGPL-3.0-or-later
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

# Don't run if INIT_LETSENCRYPT="0"
if [ "$INIT_LETSENCRYPT" = "0" ]; then
    echo "INIT_LETSENCRYPT is set to 0, skipping certificate initialization."
    exit 0
fi
CERT_DIR=${CERT_DIR:='/app/server/files/certs'}
mkdir -p $CERT_DIR
if [ -z $CERT_SECRET ] && [ ! -z $CLOUDFLARE_API_KEY ] && [ ! -z $CLOUDFLARE_DNS_RECORDS ]; then
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
