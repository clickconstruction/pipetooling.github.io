#!/usr/bin/env bash
# Runs supabase/tests/gc_owner_billing against a throwaway copy of the WHOLE schema (GC mode, Owner
# Billing's O4a-1: our bill to the customer; O5b: our reminder to pay it; O6b-2: our bill for the interest; O7a: the
# customer's acceptance of the work; O7b: the Monday money email; O7c: the customer's answers in their portal; O5e: the
# controller's reads of pay speeds and promises; O3b: the office's answer to a trade's ask for a change; O8a: the
# customer's card payment with its 3% fee; O8c: its switch, an app_settings row; O9: the money team's reads of the
# trades' money; O10a: the office's notices, their record and what is due).
#
#   npm run test:pg:gc-owner-billing
#
# The same bed as scripts/pgtest-gc-schedule.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). O4a-1's, O5b's, O6b-2's, O7a's, O7b's, O7c's, O5e's, O3b's, O8a's, O8c's, O9's and O10a's migrations each
# run a second time where they stand in that order, which must change nothing (one service type, one trigger, one function
# each, and O6b-2's restated send and certificate last). A later migration that restates one of their functions keeps the
# last word: the Team leads drop (v2.5088) restates O7b's two email schedules without the table it drops. 20_scenario
# sends pay applications, records certificates and reminds the customer to pay through RLS as a dev, the
# controller, an estimator and a dev in training mode, inside one transaction that rolls back: the billing
# job the first send opens, the bill each certificate makes, the links that stay once written, a reminder
# with its chase touch, and every refusal in its words. 30_interest bills the interest: the revenue at the contract
# plus the interest billed, kept by the restated send and certificate. 40_closeout records the customer's acceptance
# and sends the final on it. 50_money_monday reads the Monday email's payload against the window's rule, and its
# requests and schedule listings. 60_portal_answers answers change orders as their portal and as the office.
# 70_controller_reads proves the controller reads pay speeds and promises as a dev does. 80_change_requests answers a
# trade's asks as the office: one made a change order, one turned down, a deleted draft freeing its ask, and who may.
# 90_card_bills turns bills to card as the service role, the fee riding on the billing job's revenue so it never reads
# paid while a bill is open, and takes one back to a check bill as the money team. 91_card_switch flips Pay by card's
# switch as the owner and a dev, and no one else. 92_money_reads reads the seven tables of the trades' money as the
# controller, a leader, a trainee and a twin, row for row what a dev reads, and writes none of them. 93_office_notices
# reads what is due day by day in a fixed October, to whom, each once, and only since the switch's day. Each
# raises on its first failed assertion and ends with its own "PASSED". PGTEST_KEEP=1 leaves the container up. Needs
# docker; .github/workflows/sql-beds.yml runs it on a PR that touches Owner Billing's SQL. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55454}"
NAME="pgtest-gc-owner-billing"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
SEND="$(ls supabase/migrations/*_gc_owner_pay_app_send.sql)"
REMIND="$(ls supabase/migrations/*_gc_remind_customer_to_pay.sql)"
INTEREST="$(ls supabase/migrations/*_gc_send_owner_interest_bill.sql)"
ACCEPT="$(ls supabase/migrations/*_gc_record_acceptance.sql)"
MONDAY="$(ls supabase/migrations/*_gc_money_monday_email.sql)"
PORTAL="$(ls supabase/migrations/*_gc_change_order_portal_answer.sql)"
CONTROLLER="$(ls supabase/migrations/*_gc_controller_pay_speeds_and_promises.sql)"
CHANGEREQ="$(ls supabase/migrations/*_gc_change_request_answers.sql)"
CARD="$(ls supabase/migrations/*_gc_owner_card_bills.sql)"
SWITCH="$(ls supabase/migrations/*_gc_card_bill_switch.sql)"
READS="$(ls supabase/migrations/*_gc_money_reads_trades.sql)"
NOTICES="$(ls supabase/migrations/*_gc_office_notices.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
. scripts/pgtest-pull.sh
pgtest_pull_supabase "$IMAGE"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
# psql's errors go to this run's own file: a fixed /tmp name may belong to another user on a shared Mac.
ERR="$(mktemp "${TMPDIR:-/tmp}/$NAME.XXXXXX")"
trap '[ -n "${PGTEST_KEEP:-}" ] || docker rm -f "$NAME" >/dev/null 2>&1; rm -f "$ERR"' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
# A second run of each of the twelve must change nothing: the service type's insert skips the row it made, the
# columns and the index are there, and every function and the trigger are replaced as they were. It runs right
# after the first, so a later migration's restatement is never undone, nor its dropped tables named again.
TWICE=" $SEND $REMIND $INTEREST $ACCEPT $MONDAY $PORTAL $CONTROLLER $CHANGEREQ $CARD $SWITCH $READS $NOTICES "
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  case "$TWICE" in *" $f "*)
    psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; } ;;
  esac
done
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/30_interest.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_interest PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/40_closeout.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_closeout PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/50_money_monday.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_money_monday PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/60_portal_answers.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_portal_answers PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/70_controller_reads.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_controller_reads PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/80_change_requests.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_change_requests PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/90_card_bills.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_card_bills PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/91_card_switch.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_card_switch PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/92_money_reads.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_money_reads PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/93_office_notices.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing_office_notices PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-owner-billing bed ok"
