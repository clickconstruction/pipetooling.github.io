# 20260924120000_lien_word_leader_present.sql (2026-09-24, v2.3813)

Widens `job_lien_desk_items.word_channel`'s CHECK from `'' · phone · in_person · text` to add `standing_over` and `typing` — the two declarations the office makes when the leader is beside them (*he is standing over me* / *he is typing it in*), recorded on the same `approval_mode = 'word'` row as the remembered word. Drops and re-adds the constraint (idempotent); the guard trigger is unchanged. No backfill.

Order: **push this before, or with, the v2.3813 client** — the new client sends the two values and the old CHECK refuses them with 23514; the old client never sends them, so the migration is safe ahead of the deploy.
