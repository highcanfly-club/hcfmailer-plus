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


set -o pipefail

# Load mail credentials from builtin zonemta config when needed.
load_mail_credentials() {
    if [ -n "${MAILUSER:-}" ] && [ -n "${MAILPASSWD:-}" ]; then
        return 0
    fi

    if [ -r "/app/zone-mta/config/builtin-zonemta.json" ]; then
        MAILUSER=$(sed -n 's/^.*"user"[[:space:]]*:[[:space:]]*"\([^"]*\)".*$/\1/p' /app/zone-mta/config/builtin-zonemta.json | head -n1)
        MAILPASSWD=$(sed -n 's/^.*"pass"[[:space:]]*:[[:space:]]*"\([^"]*\)".*$/\1/p' /app/zone-mta/config/builtin-zonemta.json | head -n1)
    fi

    MAILSERVER=${MAILSERVER:-'127.0.0.1:2525'}
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "ERROR: required command '$1' is not installed"
        return 1
    fi
}

require_env() {
    local name="$1"
    if [ -z "${!name:-}" ]; then
        echo "ERROR: $name must be set"
        return 1
    fi
}

assert_file() {
    local file="$1"
    if [ ! -f "$file" ] || [ ! -s "$file" ]; then
        echo "ERROR: file '$file' is missing or empty"
        return 1
    fi
}

format_number_fr() {
    local number="$1"
    local sign=""
    if [ "${number:0:1}" = "-" ]; then
        sign="-"
        number="${number:1}"
    fi
    local formatted=""
    while [ "${#number}" -gt 3 ]; do
        formatted=" ${number: -3}${formatted}"
        number="${number:0:${#number}-3}"
    done
    formatted="${number}${formatted}"
    printf '%s%s' "$sign" "$formatted"
}

send_mail() {
    local from="$1"
    local to="$2"
    local subject="$3"
    local body="$4"
    local attachment="$5"
    local filename
    filename="$(basename "$attachment")"
    local boundary="====$(date +%s)-$$===="

    {
        printf 'From: "%s" <%s>\n' "SAUVEGARDE @HCFMailer+" "$from"
        printf 'To: "%s" <%s>\n' "$to" "$to"
        printf 'Subject: %s\n' "$subject"
        printf 'MIME-Version: 1.0\n'
        if [ -n "$attachment" ]; then
            printf 'Content-Type: multipart/mixed; boundary="%s"\n\n' "$boundary"
            printf '%s\n' "--$boundary"
            printf 'Content-Type: text/plain; charset="utf-8"\n\n'
            printf '%s\n\n' "$body"
            printf '%s\n' "--$boundary"
            printf 'Content-Type: application/octet-stream; name="%s"\n' "$filename"
            printf 'Content-Transfer-Encoding: base64\n'
            printf 'Content-Disposition: attachment; filename="%s"\n\n' "$filename"
            /usr/bin/openssl base64 < "$attachment"
            printf '%s\n' "\n--${boundary}--"
        else
            printf 'Content-Type: text/plain; charset="utf-8"\n\n'
            printf '%s\n' "$body"
        fi
    } | /usr/sbin/sendmail -f "$from" -au"$MAILUSER" -ap"$MAILPASSWD" -amPLAIN -S "$MAILSERVER" -t --
}

send_backup_email() {
    local now="$1"
    local count="$2"
    local total="$3"
    local file="$4"
    local backup_from="$5"
    local backup_to="$6"
    local mailuser="$7"
    local mailpasswd="$8"
    local mailserver="$9"
    local split_files="${10}"
    local archive_kb="${11}"
    local sql_size_bytes="${12}"

    MAILUSER="$mailuser"
    MAILPASSWD="$mailpasswd"
    MAILSERVER="$mailserver"

    local subject="Sauvegarde HCFMailer+ du ${now} (${count}/${total})"
    local body="Voici la sauvegarde du ${now}
Partie ${count} sur ${total}

Fichier actuel : $(basename "$file")
Fichiers du split :
${split_files}

Taille totale du fichier avant split : ${archive_kb} Ko
Taille de /app/server/files/backup.sql : ${sql_size_bytes} octets

HCFMailer+ team"

    send_mail "$backup_from" "$backup_to" "$subject" "$body" "$file"
}

send_admin_error() {
    local subject="$1"
    local message="$2"

    load_mail_credentials
    if [ -z "${BACKUP_FROM:-}" ] || [ -z "${BACKUP_TO:-}" ]; then
        echo "ERROR: BACKUP_FROM and BACKUP_TO must be set to send admin email"
        return 1
    fi
    if [ -z "$MAILUSER" ] || [ -z "$MAILPASSWD" ]; then
        echo "ERROR: MAILUSER and MAILPASSWD missing, cannot send admin email"
        return 1
    fi

    send_mail "$BACKUP_FROM" "$BACKUP_TO" "$subject" "$message"
}

load_expected_tables() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd)"
    local schema_file="$script_dir/../server/setup/sql/mailtrain.sql"
    if [ ! -r "$schema_file" ]; then
        schema_file="/app/server/setup/sql/mailtrain.sql"
    fi

    if [ ! -r "$schema_file" ]; then
        echo "ERROR: expected schema file not found at $schema_file"
        return 1
    fi

    EXPECTED_TABLES=()
    while IFS= read -r line; do
        EXPECTED_TABLES+=("$line")
    done < <(grep -oE '^CREATE TABLE `[^`]+`' "$schema_file" | sed 's/^CREATE TABLE `\([^`]*\)`$/\1/' | sort -u)
    if [ ${#EXPECTED_TABLES[@]} -eq 0 ]; then
        echo "ERROR: no expected tables loaded from schema file"
        return 1
    fi
}

validate_dump_tables() {
    local sqlfile="$1"
    local missing=()

    if [ ${#EXPECTED_TABLES[@]} -eq 0 ]; then
        load_expected_tables || return 1
    fi

    for table in "${EXPECTED_TABLES[@]}"; do
        local pattern='^CREATE TABLE( IF NOT EXISTS)? (`[^`]+`\.)?`'"$table"'`'
        if ! grep -qE "$pattern" "$sqlfile"; then
            missing+=("$table")
        fi
    done

    if [ ${#missing[@]} -ne 0 ]; then
        echo "ERROR: dump missing expected tables: ${missing[*]}"
        return 1
    fi
}

check_mariadb_dump() {
    local sqlfile="$1"
    local rc="$2"

    if [ "$rc" -ne 0 ]; then
        echo "ERROR: mariadb-dump failed with exit code $rc"
        return 1
    fi
    assert_file "$sqlfile" || return 1
    if ! grep -q '^-- Current Database:' "$sqlfile"; then
        echo "ERROR: mariadb-dump output does not look like a valid dump"
        return 1
    fi
    validate_dump_tables "$sqlfile" || return 1
}

verify_s3_upload() {
    local remote="$1"

    if mc stat "$remote" >/dev/null 2>&1; then
        return 0
    fi
    if mc ls "$remote" >/dev/null 2>&1; then
        return 0
    fi
    echo "ERROR: uploaded object '$remote' not found in S3 after upload"
    return 1
}

ensure_mc_alias() {
    local alias_name="$1"
    local endpoint="$2"
    local access_key="$3"
    local secret_key="$4"

    if mc alias list | grep -q -E "^${alias_name}[[:space:]]"; then
        return 0
    fi
    mc alias set "$alias_name" "$endpoint" "$access_key" "$secret_key"
}
