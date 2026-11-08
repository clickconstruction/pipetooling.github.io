# 20261108020000_messages_body_html_path.sql (2026-11-08, v2.6675)

**What it does**: one nullable column on the line, `messages.body_html_path` (punch list #259, PR 1). The bids@ reader (`gmail-sync`) now keeps each inbound email's HTML part, as it came, at `<line id>/body.html` in the private `message-attachments` bucket after the line is written, and writes the path here. The message window reads the column to know an HTML body exists without a bucket list, and draws **Rich text · Plain** (PR 2, v2.6676) only on a line that has one. Older lines stay null and plain: no back-fill.

- `messages.body_html_path text` — null on a line with no HTML part, one read before this version, a text, a call, a note.

**Tables**: none created, so no fence is owed. **RLS**: unchanged; the table's policies cover the column, and the bucket's office SELECT policy (`20261013080000_messages_email_in.sql`) covers the new path as it covers the files. The service role writes both.

**Why a path and not a column of HTML**: a thread's read brings every line's row, and the part most lines never open runs 20 to 200 KB a line against the few KB the words take.

**Apply**: `supabase db push` from a clean checkout of `main` after this merges, **before** `supabase functions deploy gmail-sync`: the reader deployed first uploads each mail's HTML and warns that the marker would not write (PostgREST refuses the unknown column), so those lines stay plain for good; pushed first, nothing changes until the deploy. PR 2's client reads the column, so it merges after the push (`npm run check:calls-ahead` labels it otherwise).

**Check**: `select count(*) from messages where body_html_path is not null` grows from the first mail the deployed reader takes; `select body_html_path from messages where channel = 'email' order by at desc limit 1` reads `<that line's id>/body.html`.

**Applied** to prod on 2026-11-08, read the same day: `npm run check:migration-drift` from the coordinating session's worktree read 1164 local files and 1164 remote versions, fully applied, this file among them; pushed right after #7280 merged, with gmail-sync redeployed in the same minute so the reader wrote the path from its first run. Types regenerated from prod through #7301 (`chore(types)` after the night's six migrations).
