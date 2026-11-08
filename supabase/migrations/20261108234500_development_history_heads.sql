SET lock_timeout = '3s';

-- The History look's entries read, slimmed (punch list #280 PR 1, v2.6735). The page read every column
-- of development_history_entries for a site, and on the real site that was 298 KB on every open, two
-- thirds of it the kept mail bodies the page folds behind *more ›* at 260 characters. This view hands
-- the list what it draws: every column but the body, the body's first 400 characters as body_head and
-- its whole length as body_chars, so the page knows a line has more without reading it. The whole body
-- stays on the table and comes down by id when a line's *more ›* is pressed, or once for the site when
-- a search is typed (a search reads every word). MCP's get_history reads the table whole as before.
-- security_invoker: the table's own policies decide what a reader sees, as for the table itself.
CREATE OR REPLACE VIEW public.development_history_heads
WITH (security_invoker = true) AS
  SELECT e.id, e.development_id, e.job_id, e.bid_id, e.customer_id, e.happened_at, e.source,
         left(e.body, 400) AS body_head,
         char_length(e.body) AS body_chars,
         e.author_user_id, e.via, e.agent_label, e.link_url, e.file_path, e.created_at
    FROM public.development_history_entries e;

COMMENT ON VIEW public.development_history_heads IS
  'development_history_entries for the Development page''s list: every column but the body, with body_head (its first 400 characters) and body_chars (its whole length). The whole body is read from the table by id on *more ›*, or once for a site when a search is typed. security_invoker.';

GRANT SELECT ON public.development_history_heads TO authenticated;
