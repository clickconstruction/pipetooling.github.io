# 20261013060000_customer_page_words_screens.sql (2026-10-12, v2.5303)

Messages, cut 8b-i (the customer's page on a GC job): the sentences the page's screens add to `customer_page_words`, which [20261012130000_portal_customer_page](20261012130000_portal_customer_page.md) created and first seeded.

## What it does

- **A fresh seed block** from `src/lib/portal/pageWords.ts`, written by `scripts/customer-page-words-sql.ts`: 164 sentences, 20 of them new. They are:
  - the team's roles under Your people (office, project manager, on site);
  - the link to the week's photos;
  - accepting the work, and the press that goes to Papers;
  - a schedule move's dates and its reason in the customer's words (weather, the work before it ran long, materials and nine more).
- The upsert is the first seed's: a new key is added, and an existing sentence follows the code only where `edited_at IS NULL`, so an office edit stays. The 144 sentences already there are unchanged, so it rewrites them as they were.
- No DDL. The edit trigger lets a seed through untouched and unstamped, since no user is signed in.

## Checked before the push

**`customerPageWords.test.ts`** reads this block as the newest and holds it equal to the code.

**The SQL bed** (`portal-customer-page`): every migration, then this one and the first once more, changing nothing. The scenario now counts the newest seed's sentences (164) rather than a fixed 144. It streams both migrations in at its `-- @reseed` line, and the office's two edits still stand after them.
