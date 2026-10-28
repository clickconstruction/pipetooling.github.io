# 20261026230000_customer_ratings_review.sql (2026-10-26, v2.5934)

The one-tap rating of v2.5876 (`customer_ratings`, `mint_customer_rating`, `job-rating`, `/rate`) becomes the owner's review ask (punch list #185, [`to-dos/customer-reviews/`](../../to-dos/customer-reviews/README.md)). Additive, no table made:

- `customer_ratings` gains `opened_at` (the link's first open, stamped by `job-rating`'s GET), `google_pressed_at` (they pressed **Post it on Google** after answering; whether they posted is never known), and the office's call on an answer: `called_at`, `called_by` (no FK, as the table's other people), `call_note` (`''` by default, up to 1,000 characters). The table's three fences stand from v2.5876.
- `customer_rating_called(p_rating_id uuid, p_note text DEFAULT '') RETURNS jsonb`, SECURITY DEFINER, EXECUTE to `authenticated` and revoked from `PUBLIC` and `anon`: stamps the call. Answers `{ ok, rating_id }` or `{ error }` in words, as `mint_customer_rating` does: signed out, a training account, a twin, anyone off the office team (`gc_office_team()`), a rating not there.
- `app_settings google_review_link_v1`, `''` as it ships: the company's own Google review link (Google Business Profile → Read reviews → Get more reviews). The page names Google only while it holds an https address. Its own UPDATE policy, `is_master_or_dev()`, keyed to the row.

Apply order: ship with the client and the function (the page reads the new fields defensively, and the function writes them), `supabase db push` after the merge from a main checkout, then `supabase functions deploy job-rating`. Numbered after `20261026190000_dev_mcp_keys_in_vault.sql`, main's newest at the time, and the stamps other sessions held, so the push stays in order.

**Applied** to prod by 2026-10-28: `npm run check:migration-drift` read 994 local files and 994 remote versions, fully applied (read in the docs pass after #6245); `check:edge-drift` read every one of the 169 functions deployed and current the same day, `job-rating` among them; types regenerated in #6301.
