# 20260929033559 — `bid_submittal_takeoff_choices.split` (v2.4114)

**What**: one additive column, `split boolean NOT NULL DEFAULT false`, on the table v2.4107 added for the estimator's ticks in *Choose from the takeoff*.

**Why**: Counts name a fixture the way the plans group it (*WC 1&2 × 10*); a submittal or a procurement log often wants WC-1 and WC-2 as two lines. The picker's Split switch (offered only on a row whose name spells out more than one tag) writes one submittal row per tag; the switch is remembered beside the tick so the next revision and *Add from the takeoff* split the same way.

**Safety**: `SET lock_timeout = '3s'`; `ADD COLUMN IF NOT EXISTS` with a constant default (no rewrite on Postgres 11+). No new table, so the read-only and twin appliers are not re-run; the existing policies cover the column.

**Client**: `takeoffCandidatesIo.ts` reads `split` with `ticked`; `saveTakeoffChoices` writes both. Deploy the client first or second — an old client ignores the column; a new client against an old schema would fail only on the first Build / Add after the deploy, with a toast.
