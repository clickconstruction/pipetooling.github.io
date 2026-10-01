# 20261001170000_bid_mark_requests.sql (2026-10-01, v2.4297)

A bid marked FOR a teammate, with an optional note. Builds on `bid_marks` (20261001001500, a person's own marks), which it leaves untouched.

- **`bid_mark_requests`**: `id`, `bid_id` → `bids` (cascade), `for_user_id` / `from_user_id` → `users` (cascade), `note` (≤ 280), `created_at`, `seen_at`, `closed_at`, `outcome` (`done` | `not_for_me` | `taken_back`; set exactly when closed). Never `for = from`. One open row per (bid, receiver, sender) — a re-send replaces the note and the time and clears `seen_at`. Indexes on the receiver's open rows, the sender's rows by time, and the bid.
- **RLS**: SELECT for the sender or the receiver only. No INSERT / UPDATE / DELETE policy: the functions below are the only writers. `anon` has nothing.
- **Functions** (all SECURITY DEFINER, granted to `authenticated`):
  - `user_opens_bids(uid)` — active account whose role opens Bids (the roles of `can_open_bid_reply_book()`).
  - `mark_bid_for(bid, for_user, note)` → id. Refuses a caller or a target outside Bids, marking yourself, and an unknown bid.
  - `bid_mark_requests_seen(bid)` → rows. The receiver's open, unseen rows on the bid.
  - `bid_mark_requests_close(bid, 'done' | 'not_for_me')` → rows. Every open row for the receiver on the bid, whoever sent it.
  - `bid_mark_request_take_back(id)` → rows. The sender, open rows only.
  - `user_has_push_device(uid)` → boolean. Only yes / no, only to a Bids user.
- **House rules**: `apply_read_only_write_blocks()` + `apply_read_only_stmt_blocks()`; the statement block fires inside the definer functions too, so a read-only account cannot mark.

**Proof** (2026-10-01, on production inside `BEGIN … ROLLBACK`, as real accounts through `SET LOCAL ROLE authenticated` + `request.jwt.claims`): mark → one row; a re-send keeps one open row with the new note; marking yourself, marking a helpers account and a direct INSERT are refused; the sender cannot close as the receiver; an outsider reads 0 rows, the receiver 1; seen → 1 then 0; done → `done`, `seen_at` set; take back on a closed row → 0; a new mark after done, then take back → `done, taken_back`; `user_has_push_device` answers.

Client: `src/lib/bids/bidMarksStore.ts` (load, optimistic seen / close / take back), `bidMarkRequests.ts` (kernel), `BidMarkControls.tsx`. Push: `supabase/functions/notify-bid-mark`. The types were hand-added to `src/types/database.ts`; regenerate after the push.

Apply order: push this migration, then deploy `notify-bid-mark`. The client reads "no requests" until the table exists.
