#!/bin/sh
cd /app/server
npx knex --client mysql2 --env production --connection mysql://$MYSQL_USER:$MYSQL_PASSWORD@mysql/$MYSQL_DATABASE migrate:unlock