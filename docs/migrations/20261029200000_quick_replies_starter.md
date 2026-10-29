# 20261029200000_quick_replies_starter.sql (2026-10-29, v2.6064)

Quick replies by keyboard, PR 4 (punch list #126, `to-dos/quick-replies-by-keyboard/README.md` → *The starter set*): the eleven customer lines the owner approved on 2026-10-29, seeded once as team lines with their shortcuts for the reply box's `/` list (v2.5637, v2.5638). The client reads nothing new, so it deploys in either order; the lines appear in every reply box, the editor and the `/` list as soon as the push lands.

## What it does

1. **`quick_replies_seed_starter()`** (`SECURITY INVOKER`, the database's own: EXECUTE revoked from `PUBLIC`, `anon` and `authenticated`), the shape of `quick_replies_seed()` (`20261012190000_quick_replies.sql`). It walks the eleven lines in the card's order and inserts each as a team line for customers (`scope = 'team'`, `for_kind = 'customer'`, `added_by` null, `text_es` null, off the phone) with its `shortcut` on the row from birth, then its `added` version by nobody and no `shortcut` version: the quick-replies bed re-applies `20261013210000_quick_replies_phone_es.sql`, whose rebuild of `quick_reply_versions_kind_known` knows no `shortcut` kind and would refuse the rows. Returns how many it added.
2. **The migration runs it once** (`SELECT public.quick_replies_seed_starter();`). No table is created, so the three fence appliers are not re-run.

## What it seeds

Eight lines on no step, so no automatic send changes: `/gotit`, `/access`, `/photo`, `/late`, `/back`, `/bill`, `/thanks`, `/paid`. Three on a step of the residential flow, each the step's own message, which the job's strip leads with under **For this stage**, Tell the customer reads on a move and the morning run reads for its reminder (`stepLine`): `/found` on `found` (What we found), `/estimate` on `approved` (the reminder a day after the estimate), `/remind` on `paid` (the reminder on the pay-by day). The words are the card's, with the blanks the app fills (`{first}`, `{me}`, `{address}`, `{window}`, `{back day}`, `{back time}`, `{job}`, `{bill}`, `{tech}`, `{link}`, `{amount}`) and the two the person types (`{thing}` on `/photo`, `{found}` on `/found`). `src/lib/quickReplies/starterSql.test.ts` holds the eleven: the order, the shortcuts, the steps, the blanks, the words of the first.

## What it skips

A line is left out, and the office's kept, when:

- its words are on any line, live or removed, or were ever added (`quick_reply_versions.added`), compared lowercased and trimmed, so a line the team removed or reworded stays as they left it;
- a live team line holds its shortcut (a person's own line may share a word with a team line, as the index allows);
- for the three on a step, a live team line for customers is already on that step: the office's line keeps the step.

So a second push adds nothing, and a third run of the function returns 0.

**Read on prod before the push (2026-10-29, as the signed-in dev through the app's own client):** fifteen lines, all the app's own (the prototype's thirteen from `quick_replies_seed()` and the two phone lines, On my way and I'm here), none removed, no shortcut on any line, no Spanish, no customer team line on `found`, `approved` or `paid`. So nothing is skipped: the push adds all eleven.

## Why the shape

- **A function, not a `DO` block**, so the bed can take lines away, put the office's own in the way and run the seed again; and so a dev can run it by hand later if a line is ever deleted outright (the editor only removes, which keeps the words and so keeps the line out).
- **Words compared, not ids**: the card's rule is *a starter line that repeats a saved one is left out*. The compare forgives case and edges, since the editor trims and a retyped capital is the same line to the office.
- **The shortcut skip leaves the whole line out** rather than adding it without a word: a starter line is its shortcut, and the office gave that word to a line of its own on purpose.

## Verify

Read-only on prod after the push:

```sql
SELECT shortcut, step_key, scope, for_kind, added_by IS NULL AS app FROM public.quick_replies WHERE shortcut IS NOT NULL AND removed_at IS NULL ORDER BY shortcut;
SELECT kind, count(*) FROM public.quick_reply_versions v JOIN public.quick_replies q ON q.id = v.quick_reply_id WHERE q.shortcut IS NOT NULL GROUP BY kind;
SELECT public.quick_replies_seed_starter();
```

Expect eleven rows, all `team | customer | true`, three with a step (`found`, `approved`, `paid`); `added | 11` and no other kind; and `0` from the third run. In the app, as the office: open a customer's thread on Messages, type `/la` and read `/late` first in the list; a Ready to Bill job's strip still leads with the app's Done words; the Paid step's **For this stage** reads `/remind`. The SQL bed `npm run test:pg:quick-replies-starter` (CI, `scripts/sql-beds.txt`) walks every step above with the office's own lines in the way.

## Rollback

```sql
DELETE FROM public.quick_replies WHERE added_by IS NULL AND shortcut IN ('gotit', 'access', 'photo', 'late', 'back', 'bill', 'thanks', 'paid', 'found', 'estimate', 'remind');
DROP FUNCTION IF EXISTS public.quick_replies_seed_starter();
```

The delete cascades to the lines' versions and presses. A line the office has since reworded or pressed is theirs by then; remove it from the editor instead.

## Status

Written on branch `claude/bold-franklin-70f99d` (v2.6064). Not pushed: `supabase db push` only after it is on `main`, on the owner's go.
