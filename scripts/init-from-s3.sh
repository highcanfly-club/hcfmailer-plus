#!/bin/bash
MYSQL_DATABASE=${MYSQL_DATABASE:-'mailtrain'}
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
mysql -h $MYSQL_HOST --password="$MYSQL_ROOT_PASSWORD" -e "USE $MYSQL_DATABASE; SELECT value FROM settings" 2>/dev/null
TEST_DB=$?
if [[ "$TEST_DB" != "0" && "$INIT_FROM_S3" == "1" ]]; then
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
    cat << EOF > /app/server/files/${MYSQL_DATABASE}.sql
-- MariaDB dump 10.19  Distrib 10.11.5-MariaDB, for Linux (aarch64)
--
-- Host: mysql    Database:
-- ------------------------------------------------------
-- Server version       8.3.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
EOF
    sed -n -e "/^-- Current Database: \`${MYSQL_DATABASE}\`/,/^-- Current Database: \`/p" /app/server/files/backup.sql >>/app/server/files/${MYSQL_DATABASE}.sql
    mysql -h $MYSQL_HOST --password="$MYSQL_ROOT_PASSWORD" < /app/server/files/${MYSQL_DATABASE}.sql
else
    echo "Database ${MYSQL_DATABASE} already exists"
fi
