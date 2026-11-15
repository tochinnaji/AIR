#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${DATABASE_URL:?Set DATABASE_URL to the Hostless PostgreSQL connection string}"
: "${S3_ENDPOINT:?Set S3_ENDPOINT to the S3-compatible storage endpoint}"
: "${S3_BUCKET:?Set S3_BUCKET to the private backup bucket}"
: "${S3_ACCESS_KEY_ID:?Set S3_ACCESS_KEY_ID}"
: "${S3_SECRET_ACCESS_KEY:?Set S3_SECRET_ACCESS_KEY}"
: "${S3_REGION:?Set S3_REGION to the Backblaze B2 bucket region}"
: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to an age public recipient}"

BACKUP_PREFIX="${BACKUP_PREFIX:-forme/postgres}"
AWS_DEFAULT_REGION="$S3_REGION"
export AWS_DEFAULT_REGION AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"

stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
archive="$tmp/forme-$stamp.dump"
encrypted="$archive.age"

pg_dump --format=custom --no-owner --no-acl --file="$archive" "$DATABASE_URL"
test -s "$archive"
pg_restore --list "$archive" >/dev/null
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted" "$archive"
test -s "$encrypted"

aws s3 cp "$encrypted" "s3://$S3_BUCKET/$BACKUP_PREFIX/forme-$stamp.dump.age" \
  --endpoint-url "$S3_ENDPOINT" --only-show-errors
printf 'Encrypted database backup uploaded: %s\n' "forme-$stamp.dump.age"
