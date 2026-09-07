# 20260907110000 — twin_shadow_runs.status admits 'void'

v2.3037. `void_shadow` (twin-mcp v1.3.10) sets `status = 'void'` to take a shadow out of the scoring loop, but the v2.2539 CHECK only allowed open/locked/scored — the verb's first real use (b480, a plumbing shadow opened on an Electrical-division bid) failed on the constraint. Drop-if-exists + re-add with 'void'; `score_shadows` selects `locked` only, so void runs are inert to scoring by construction. Additive, idempotent, no data change.
