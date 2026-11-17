#!/usr/bin/env bash
# Teste la migration + les règles RLS sur un Postgres local jetable (aucun compte Supabase nécessaire).
# Usage : bash supabase/tests/run_sql_tests.sh   (nécessite les binaires PostgreSQL ≥ 15)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN=()
if [ "$(id -u)" = "0" ]; then chown postgres "$TMP"; RUN=(runuser -u postgres --); fi

cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" start >/dev/null
export PGOPTIONS="-c client_min_messages=warning"
PSQL=("$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$HERE/stub_supabase.sql" >/dev/null
for pass in 1 2; do  # 2e passage : les migrations doivent être ré-exécutables
  for m in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$m" >/dev/null; done
done
for t in rls_test rappels_test; do
  "${PSQL[@]}" -t -f "$HERE/$t.sql" | grep -E 'ok  |ÉCHEC|Tous les tests'
done
