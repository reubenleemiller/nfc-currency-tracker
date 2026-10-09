#!/bin/sh
set -eu
./node_modules/.bin/prisma migrate deploy --schema prisma/schema.postgresql.prisma
exec node server.js
