SET lock_timeout = '3s';

-- Messages, cut 7f's follow-up (v2.5483): how often a person opened their portal since a line we sent carried a link to
-- it. The message window's Files says it beside a link to their portal: "they opened their portal twice since, last
-- Mon Oct 12 at 2:10 PM". A portal's views are the whole portal's, so it counts their opens of the portal, never of the
-- one file.
--
-- public_page_views is dev-only to read, customer_portal_views counts a customer's opens for all time, and nothing read
-- a trade partner's gc_trade_portal opens back for the office. So one read, for one portal since one time:
--
-- portal_opens_since(p_surface, p_entity_id, p_since): the outside opens of one portal from p_since on, how many and the
-- last. p_surface is gc_trade_portal (p_entity_id a gc_companies id, as gc-trade-portal counts its views) or portal (a
-- customers id: the page's loads; a paper opened on it is its own portal_paper row, never counted). Outside opens only:
-- a teammate's look or the office's preview is stamped and never counted. The office team only (gc_office_team()):
-- anyone else, and any other surface, reads none. The (surface, entity_id, occurred_at) index serves it.
--
-- No table, so no house calls. See docs/migrations/20261014120000_portal_opens_since.md.

CREATE OR REPLACE FUNCTION public.portal_opens_since(p_surface text, p_entity_id uuid, p_since timestamptz)
RETURNS TABLE (
  opens integer,
  last_opened_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int, max(v.occurred_at)
  FROM public.public_page_views v
  WHERE (SELECT public.gc_office_team())
    AND p_surface IN ('gc_trade_portal', 'portal')
    AND v.surface = p_surface
    AND v.entity_id = p_entity_id
    AND v.occurred_at >= p_since
    AND coalesce(v.viewer, 'outside') = 'outside';
$$;
COMMENT ON FUNCTION public.portal_opens_since(text, uuid, timestamptz) IS
  'Messages (cut 7f follow-up, v2.5483): the outside opens of one portal since a time, how many and the last, for the message window''s link to their portal ("they opened their portal twice since"). p_surface gc_trade_portal (a gc_companies id) or portal (a customers id, the page only). gc_office_team() only; anyone else, and any other surface, reads 0.';

REVOKE ALL ON FUNCTION public.portal_opens_since(text, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_opens_since(text, uuid, timestamptz) TO authenticated, service_role;
