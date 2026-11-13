# 20261113110000_checklist_items_source_tag.sql (2026-11-12, v2.7117)

Gives a task card a place to say where it came from: `checklist_items.source_tag`, a nullable text column.

## What it does

1. `ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS source_tag text`. Nullable with no default, so the table is not rewritten and the lock is brief. `lock_timeout` is 3 s: the push fails fast and is retried if the table is busy.
2. Comments the column.
3. `CREATE INDEX IF NOT EXISTS checklist_items_source_tag_idx ON public.checklist_items (source_tag) WHERE source_tag IS NOT NULL`. A partial index, since only cards made for a thing carry a tag.
4. Back-fills the tag from any link that carries `todo=<key>`, on cards whose tag is still null. On 2026-11-12 no such card existed, so it changed no row. It is there for cards made between PR 9 going live and this push.

No new table, so no fences. Idempotent: a second run adds nothing and fills nothing already filled.

## Why

The Bridge hands one line of *What to do now* to one person as a task card (punch list #334, PR 9), and shows a blue check on that line while the card is open. It found the card again by a tag in the card's first link, `?todo=<key>`. A person who took that link off the card lost the check, and the same line could be handed out twice.

The key is one of `payer.<customer id>`, `paydate.<job id>`, `pct.<job id>`, `price.<job id>`, `bill.<job id>` or `supply.<house>.<day>`. Nothing but the Bridge writes the column today. Another page that makes a card for one thing can use it the same way, with its own prefix.

## Who writes it, who reads it

- The Add task window writes it after it makes the card, when its preset carries `sourceTag` (`ChecklistAddModal.tsx`). The write is apart from the insert and its failure is ignored, so a card is still made where the column is not there yet.
- The Bridge reads cards by it (`callTodoIo.ts`), and still reads by link for a card made before the column. A read by tag that fails leaves the cards to their links.

So the client is safe on either side of the push. Until the push, a new card is found by its link, as before.

## Push it

`supabase db push` from `main` after the PR merges. Then `npm run gen-types:linked` in a `chore(types)` PR: until then the client reaches the column through a cast.

## Rollback

`DROP INDEX IF EXISTS public.checklist_items_source_tag_idx; ALTER TABLE public.checklist_items DROP COLUMN IF EXISTS source_tag;` The cards are then found by their links again.
