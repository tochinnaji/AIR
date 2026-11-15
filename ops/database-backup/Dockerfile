FROM postgres:17-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends awscli age ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backup.sh /usr/local/bin/forme-backup
RUN chmod 0755 /usr/local/bin/forme-backup

ENTRYPOINT ["/usr/local/bin/forme-backup"]
