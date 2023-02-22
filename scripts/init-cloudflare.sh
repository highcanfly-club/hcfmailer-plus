#!/bin/bash
cat > /update-cloudflare-dns.conf << EOF
what_ip="external"
dns_record="$CLOUDFLARE_DNS_RECORDS"
zoneid="$CLOUDFLARE_ZONE_ID"
cloudflare_zone_api_token="$CLOUDFLARE_API_KEY"
proxied="false"
ttl=120
notify_me_telegram="no"
telegram_chat_id="ChangeMe"
telegram_bot_API_Token="ChangeMe"
EOF
chmod 744 /update-cloudflare-dns.sh
crond

