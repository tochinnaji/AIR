# Encrypted PostgreSQL backup job

This job makes a PostgreSQL custom-format dump, checks that PostgreSQL can read
the archive, encrypts it with `age`, and uploads it to a private Backblaze B2
bucket through its S3-compatible API. Public access must stay disabled.

## Required environment variables

- `DATABASE_URL`: Hostless PostgreSQL connection string; keep its TLS parameters.
- `S3_ENDPOINT`: the endpoint shown in the B2 bucket details, in the form
  `https://s3.<region>.backblazeb2.com`.
- `S3_BUCKET`: private bucket name.
- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`: the Backblaze application key
  ID and application key, scoped to this bucket and the `forme/postgres/` prefix.
- `S3_REGION`: the region in the endpoint, such as `us-west-004`.
- `BACKUP_AGE_RECIPIENT`: age public recipient. Keep the matching private key
  offline in a separate secure location; the job does not need that private key.
- Optional `BACKUP_PREFIX` (defaults to `forme/postgres`).

Set these as secret environment variables on the scheduled job. Do not commit
them to this repository or place them in a Docker build argument.

## Schedule and recovery

Create a private Backblaze B2 bucket named `forme-db-backups` (or set
`S3_BUCKET` to the name you choose). Copy the bucket's endpoint and region from
its details. Create a bucket-restricted application key with **Write Only**
access and the `forme/postgres/` name prefix. Do not use the master application
key. Copy the key ID and application key into the Hostless Cron Job secret
settings; the application key is shown only when created, so save it securely.
Never put credentials in `.env.local`, code, or chat. See `b2-lifecycle-rules.json`
for the Backblaze lifecycle rule. In the bucket's Lifecycle Settings, use a
custom rule for `forme/postgres/`: hide backups after 30 days, then delete them
one day later. Backblaze applies lifecycle rules daily, so actual deletion can
take longer than 31 days. B2's first 10 GB of storage is free; monitor total
usage because daily full database dumps can accumulate, and usage over the free
allowance may be billed. Before scheduling the job, configure B2 Caps & Alerts
in the Backblaze console to limit daily storage, download, and transaction
charges and send alerts to an address you monitor.

Configure the Hostless Cron Job to build this directory and run once daily.
Store the age private key offline, separately from both the app and B2. The
public recipient is safe to set as a job variable; the private key is never
needed by the scheduled backup.
Keep a second copy of the age private key offline. An encrypted backup cannot
be recovered without that private key.

To restore, download a `.dump.age` object, decrypt it using the offline private
key, create an empty target database, then run:

```sh
age --decrypt --identity age-identity.txt --output forme.dump forme.dump.age
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" forme.dump
```

Restore only to a separate, empty recovery database. Perform a restore drill
before relying on this process. Do not restore over the current production
database as a first test.

## Activation status

The B2-compatible job is prepared but not scheduled yet. Activation needs a
Backblaze B2 account and private bucket, B2 credentials, an offline age key, the
production database URL, and a deployed Hostless Cron Job. The project is not
deployed, and the bucket/secrets are not configured by this repository change.
Hostless advises keeping your own backups; this job provides an off-site copy
independent of the app filesystem once activated.
