# 20261019040000_quick_replies_shortcut.sql (2026-10-19, v2.5638)

Quick replies by keyboard, C (punch list #126, `to-dos/quick-replies-by-keyboard/README.md`): a one-word shortcut per quick reply, so `/bill` then Enter in the reply box's `/` list (v2.5637) lands on one line. The client reads the column fail-soft, so it may deploy before the push; push after the PR merges.

## What it does

1. **`quick_replies.shortcut`** (text, null for none): lowercase letters, digits and dashes, 24 at most, starting with a letter or a digit (`quick_replies_shortcut_word`). Two partial unique indexes on live lines: one team line a word (`quick_replies_shortcut_team_one`), and one of a person's own lines a word among theirs (`quick_replies_shortcut_mine_one`, on `added_by, shortcut`). A removed line keeps its word in the row and frees it.
2. **`quick_reply_versions`**: the kinds gain `shortcut`, the word before and after in `from_text` and `to_text` (either null for none), held by `quick_reply_versions_kind_known` and `quick_reply_versions_kept`, both dropped and made again with the new kind.
3. **`set_quick_reply_shortcut(p_id uuid, p_shortcut text)`**: sets or clears (null or blank) the word; spaces, a leading `/` and the case are forgiven. Refuses a word that is not one, a word another live team line holds, and for a line of one's own a word one's own other line holds; a line that is not there (someone else's own line reads as not there), and a removed line. One `shortcut` version; returns 1, or 0 when nothing changed. Through `quick_reply_caller`: signed out, a training account, a twin and anyone off the office team are refused in words. SECURITY DEFINER; EXECUTE to `authenticated`, revoked from `PUBLIC` and `anon`.
4. **`restore_quick_reply(uuid)`**: unchanged, except a line whose word another live line took while it was away comes back without it, with a `shortcut` version before the `restored` one, rather than failing on the unique index.

## Why the shape

- Its own function, as the big button's (`set_quick_reply_press`): `edit_quick_reply`'s signature stays, and the editor saves the word after the words.
- A team line beside someone's own line may share a word: refusing it would tell the office that a private line holds the word. The `/` list shows both, the person's most used first.
- Two indexes, not one: two people's own lines may share a word, so the own-lines index is per person.

## Verify

Read-only on prod after the push: `select count(*) from quick_replies where shortcut is not null` reads 0 until the office gives a line a word; `select pg_get_constraintdef(oid) from pg_constraint where conname = 'quick_reply_versions_kind_known'` names `shortcut`. The SQL bed `npm run test:pg:quick-replies-shortcut` (CI) walks every step above.
