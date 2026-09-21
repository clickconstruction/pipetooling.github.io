# 20260921171921_takeoff_stage_split_defaults.sql (2026-09-21, v2.3675)

Materials by stage, PR 4 of 4 — what the book and the assembly remember. Additive, two nullable jsonb columns, no data moves:

- **`takeoff_book_entries.stage_split`** — the fixture's learned split `{rough_in, top_out, trim_set}` (relative weights). "Remember" on a finished fixture writes it; **Fill from rules & book** applies it before the name rules (`source = 'book'`).
- **`material_template_items.stage_split`** — a part's split inside an assembly. "Remember for this assembly" on a bundle part writes it to every direct item row of the template carrying the part; every bid that uses the assembly reads it as the part's default, between the bid's own line split and the fixture.

Apply order: push before or after the v2.3675 client — the client reads a missing column as "nothing remembered" (the loader swallows the column error), and the two Remember doors are the only writers. Types were hand-added to `src/types/database.ts`; regenerate with `npm run gen-types:linked` after the push (one chore PR for both migrations of the train).
