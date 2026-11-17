# 20261117235000_help_feedback_page_notes.sql (2026-11-17, v2.7650)

Tell the dev: the ground. Punch list #380, PR 1 of six. `help_feedback` held the feedback written under a Help guide and nothing else. This migration lets the same table hold a note written from any page, with the page and its state, so the wrench reuses the table's row security, its push and its inbox.

## What it changes

No new table and no new function, so the file ends with no fence call. The fences already on `help_feedback` stand.

- **`kind`**, `text NOT NULL DEFAULT 'guide'`: `guide` for the box under a Help guide, or the start the sender picked in the wrench's box: `want`, `confusing`, `broken`.
- **`page_key`**: the page as the activity heartbeat names it, such as `jobs:stages`. For grouping.
- **`page_path`**: the in-app address the note was written on, path and query, so the dev can open that page. The client drops any key that is a pass before it is sent.
- **`context`**, `jsonb NOT NULL DEFAULT '{}'`: what the box listed before the press. The open window, the role, the screen, the modes, the version, the last error line shown and the calls the server refused. Never a picture of the screen.
- **`guide_slug`** is no longer required. A page note has no guide.

## Checks it restates

- **`help_feedback_body_len`**: at most 2000 characters.
- **`help_feedback_body_words`**: a `guide` or `want` note needs words. A `confusing` or `broken` note may have none.
- **`help_feedback_kind_check`**: the four kinds.
- **`help_feedback_where_check`**: a guide note names its guide, a page note names its page.
- **`help_feedback_page_size`**: `page_key` to 80 characters, `page_path` to 600, `context` to 12,000 bytes as text.

The old inline check on `body` (1 to 2000 characters) is dropped by its name, `help_feedback_body_check`.

## What it leaves alone

- **Row security**: any signed-in person inserts their own row, and reads their own. The owner or a dev reads all and closes. A digital twin may insert.
- **Training accounts** are still stopped by the read-only fence. A later PR of this card opens the insert for them.
- **`notify-help-feedback`** still words its push from `guide_slug`. No page note is written until the next PR, and the push is restated in PR 5.

## Safe to run on prod

The table holds no rows. A column with a constant default adds no rewrite, and each check validates against nothing. The file opens with `SET lock_timeout = '3s'`, drops each check before adding it and adds each column `IF NOT EXISTS`, so a second run changes nothing.

## Verify after the push

Read `help_feedback` through the dev seat with `select=id,kind,page_key,page_path,context`: the columns answer, with no rows.
