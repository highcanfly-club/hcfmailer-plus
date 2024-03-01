#!/bin/bash
MAILTRAIN_DATABASE=${MAILTRIAN_DATABASE:-'mailtrain'}
# test if variables S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT, S3_REGION, S3_PATH are set
if [ -z "${S3_BUCKET}" ] || [ -z "${S3_ACCESS_KEY}" ] || [ -z "${S3_SECRET_KEY}" ] || [ -z "${S3_ENDPOINT}" ] || [ -z "${S3_PATH}" ]; then
    echo "S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT, S3_REGION, S3_PATH are not set"
    exit 1
fi

# test is mysql variables are set
if [ -z "${MYSQL_HOST}" ] || [ -z "${MYSQL_ROOT_PASSWORD}" ]; then
    echo "MYSQL_HOST and MYSQL_ROOT_PASSWORD must be set"
    exit 1
fi

# Check if database need to be restored
if [ -z "$(mysql -h $MYSQL_HOST --password="$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES LIKE '${MAILTRAIN_DATABASE}'")" -a "$INIT_FROM_S3" = "1" ]; then
    echo "Database ${MAILTRAIN_DATABASE} does not exist restoring it from s3"
    # test if mc is installed
    if [ -z "$(which mc)" ]; then
        echo "mc is not installed"
        exit 1
    fi

    #  Test if mc alias s3backup exists
    if [ -z "$(mc alias list | grep s3backup)" ]; then
        echo "s3backup alias not found"
        echo "create s3backup alias"
        mc alias set s3backup ${S3_ENDPOINT} ${S3_ACCESS_KEY} ${S3_SECRET_KEY}
    fi

    # Find latest backup file in s3
    mc ls s3backup/${S3_BUCKET}/${S3_PATH} | sort -r | head -n 1 | awk '{print $6}' | xargs -I {} mc cp s3backup/${S3_BUCKET}/${S3_PATH}/{} /tmp/backup.tar.xz

    # Restore backup
    tar -xvf /tmp/backup.tar.xz -C /
    rm /tmp/backup.tar.xz

    # Restore the mailtrain database
    sed -n -e "/^-- Current Database: \`${MAILTRAIN_DATABASE}\`/,/^-- Current Database: \`/p" /app/server/files/backup.sql >/app/server/files/${MAILTRAIN_DATABASE}.sql
    mysql -h $MYSQL_HOST --password="$MYSQL_ROOT_PASSWORD" </app/server/files/mailtrain.sql
fi
