# 20260821170000_statement_offset_selection.sql (2026-08-21, v2.1955)

Statement charge picker: `generate_partner_statement` gains `p_offset_ids uuid[] DEFAULT NULL`. NULL = attach every eligible pending offset (previous behavior); an array attaches only those ids — still filtered to the partner's pending offsets with `occurred_date <=` the week end, and the deduction cap (statement can't deduct below zero) is unchanged. The old 3-arg signature is DROPPED so PostgREST named-arg resolution stays unambiguous; 3-arg callers resolve through the default. Selection logged in the `statement_generated` partnership event. Body verbatim from the live 20260820180000 definition otherwise.

Functions only — idempotent, no tables (read-only sweeps not needed). Deploy order: safe either way — the client omits `p_offset_ids` when all charges are selected, so only partial selections require this migration to be applied.
