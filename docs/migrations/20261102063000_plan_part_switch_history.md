# 20261102063000_plan_part_switch_history.sql (2026-11-02, v2.6344)

Plan sets by part, the row and History (punch list #239, PR 6). A job follows its part, so when a part switches the set it builds from, every job naming the part follows at once and nothing is moved. What was missing was the record: the site's History said nothing, and a crew opening the job the next morning had no line to read. This migration writes it.

## What it does

**`plan_part_switch_words(part, set, old)`**: the line, *Plans · the Bunker now builds from Bunker addendum 1, dated Oct 2, 2026 · replaces Bunker issued set*. The date is the set's `dated` (the date printed on the sheets); a set with none reads without it. No *replaces* when the old set is unknown or the same name.

**`plan_parts_history_on_switch`** (`AFTER UPDATE OF current_set_id ON plan_parts`): when a development part's current set changes to a set, one `development_history_entries` line **per job naming the part** (`job_id` each, so every job's own History reads it), `happened_at = now()`, `source = 'note'`, `via = 'app'`, the author `auth.uid()` (null for a robot or a definer), `link_url` the set's link. A part no job names yet gets one line for the site. `SECURITY DEFINER`, since the entries table lets only the office keep lines through the app and the switch may be an estimator's, the hand-off trigger's (PR 4) or a robot's. A part of a job outside any development has no site History and writes nothing; the job's Plans section still reads *set by … on …*.

## What stays

The job's Plans section, the Plans look and the mirror are untouched. A set added as current (`addSet` with *make current*) switches the part's `current_set_id` and so writes the line too; the first set on a part writes *now builds from* with no *replaces*.

## Checked before the push

Idempotent (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`). No new table, so no fence calls. `to_char` on a `date`, no `CURRENT_DATE`. The client reads nothing new from this migration: the Stages row's plans icon reads `plan_parts` and `plan_sets` as PR 2 made them.

## After the push

Nothing to regenerate: no column or function the client calls. The live check: switch a ZZ Test part's set on a ZZ Test development with two jobs on it, then read the development's History for two lines, one per job; delete every ZZ Test row after.
