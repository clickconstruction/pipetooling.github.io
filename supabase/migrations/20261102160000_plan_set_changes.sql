SET lock_timeout = '3s';

-- What changed between sets of plans (v2.6356). A set row carried a name, a kind, a source, two dates, a link, a memo
-- and the set it replaces, and nothing for what moved between one set and the next, so the memo ended up holding who
-- sent it and where the file is. The owner, 2026-11-02: "I don't think we do a good job explaining in the notes what
-- changed between plans and this seems like the most important thing to record." One column holds it, the form asks
-- for it when a set replaces another, the Plans look draws it between neighbouring sets, and the History line a part
-- switch writes carries it. See docs/migrations/20261102160000_plan_set_changes.md.

ALTER TABLE public.plan_sets ADD COLUMN IF NOT EXISTS changes text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.plan_sets.changes IS 'What changed from the set before it (v2.6356): which sheets or areas moved and what it means for our work, in the office''s words. Empty on a first set, or until someone writes it. The memo keeps who sent it, when and where the file is.';

-- The History line a part switch writes (20261102063000, PR 6) now ends with the change words, so a crew reading the
-- job's History the next morning reads what moved, not only which set.
CREATE OR REPLACE FUNCTION public.plan_part_switch_words(p_part text, p_set public.plan_sets, p_old text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Plans · ' || p_part || ' now builds from ' || p_set.name
    || CASE WHEN p_set.dated IS NOT NULL THEN ', dated ' || to_char(p_set.dated, 'Mon FMDD, YYYY') ELSE '' END
    || CASE WHEN p_old IS NOT NULL AND p_old <> p_set.name THEN ' · replaces ' || p_old ELSE '' END
    || CASE WHEN COALESCE(p_set.changes, '') <> '' THEN ' · what changed: ' || p_set.changes ELSE '' END
$$;
COMMENT ON FUNCTION public.plan_part_switch_words(text, public.plan_sets, text) IS 'Plan sets by part (#239, PR 6): the History line a part switch writes; since v2.6356 it ends with what changed when the set says.';
