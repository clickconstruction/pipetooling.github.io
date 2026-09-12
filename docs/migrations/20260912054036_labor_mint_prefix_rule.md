# 20260912054036_labor_mint_prefix_rule.sql (2026-09-12, v2.3369)

Second file of v2.3369. `mint_labor_rows_from_book` gains the Labor tab's third matching rule — a plan code's letter prefix (`LAV2` → lav, `WC 1&2` → wc, `FS-1` → fs; two or more letters, then a digit, optionally after a space or `-_/#.`) equal to an entry's name or alias — and collapses whitespace in the exact and alias comparisons, as `laborBookMatch.ts` does. Re-runs the back-fill; only source-less zero rows can change.

Why a second file: the first was already applied to prod when the live queue showed the codes it was missing; applied migration files are never edited.
