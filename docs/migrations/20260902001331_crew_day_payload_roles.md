# 20260902001331_crew_day_payload_roles

**v2.2617** — the Crew Day payload's `users` array gains each person's `role`.

- `get_crew_day_payload(date)` and `get_crew_day_payload_for_user(uuid, date)` rebuilt VERBATIM from 20260901215024 / 20260901220804 with one change each: `jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role)`. Grants unchanged; additive key, older clients ignore it. Function-only, idempotent.
- Why: the round-two Crew Day section folds office-role people away by default for superintendent viewers ("field crews first"); the client needs roles to bucket. Still no pay data.
