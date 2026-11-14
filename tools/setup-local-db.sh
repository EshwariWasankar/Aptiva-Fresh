#!/bin/bash
set -e

mkdir -p /etc/postgresql/17/main/conf.d
echo "listen_addresses = '*'" > /etc/postgresql/17/main/conf.d/listen.conf

cat << 'EOF' >> /etc/postgresql/17/main/pg_hba.conf
host all all 0.0.0.0/0 scram-sha-256
host all all ::0/0 scram-sha-256
EOF

sed -i 's/^bind .*/bind 0.0.0.0/' /etc/redis/redis.conf || true
sed -i 's/^protected-mode yes/protected-mode no/' /etc/redis/redis.conf || true

service postgresql restart
service redis-server restart

echo "Postgres and Redis configured and restarted successfully."
