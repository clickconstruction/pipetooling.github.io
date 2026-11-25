# 20261124200000_address_place_answers.sql (2026-11-24, v2.8529)

The answers a person gives about two addresses that look alike (punch list #439, piece 2, `to-dos/site-nda-for-vendors/README.md`). The app pairs up addresses on file that may be one place written two ways, and a person answers each pair once.

## What it makes

- **`address_place_answers`**, one row a pair, under the two addresses' cleaned keys in their one order (`key_a < key_b`, a check). `same` is true for *Same place* and false for *Not the same*. No job is named: an answer is about two ways of writing a place.
- **A stamp trigger**, `address_place_answers_stamp`, sets `answered_by`, `by_name` and `answered_at` on every insert and update. The caller cannot set them.
- **Policies.** The office reads and writes (`is_office_staff`). The estimator reads beside them (`is_office_or_estimator`), since a bid has an address too.
- **The four fence calls** close the file, since a table is made.

Every statement is safe to run twice.

## Order

The client reads this table, so `check:calls-ahead` labels the PR *push right after the merge*. Until the push, the window says why it could not read and the count on the Pipeline's tools button stays off. Nothing else changes.

An answer changes no job's address.
