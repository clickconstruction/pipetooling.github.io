SET lock_timeout = '3s';

-- Where a task card came from (docs/migrations/20261113110000_checklist_items_source_tag.md).
--
-- The Bridge hands one line of What to do now to one person as a task card (punch list #334, PR 9). It found that
-- card again by a tag in the card's first link (?todo=<key>), so a person who took the link off the card lost the
-- check on the Bridge. The tag now has a home of its own on the card: checklist_items.source_tag.
--
-- A nullable text column with no default, so the table is not rewritten. No new table, so no fences. Idempotent:
-- a second run adds nothing and fills nothing that is already filled.

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS source_tag text;

COMMENT ON COLUMN public.checklist_items.source_tag IS
  'Where the card came from, when a page made it for one specific thing: the key of that thing. The Bridge writes its to-do keys here (payer.<id>, paydate.<job>, pct.<job>, price.<job>, bill.<job>, supply.<house>.<day>) and finds the card again by it. Null for a card a person wrote by hand.';

-- Only cards made for a thing carry a tag, so the index holds those alone.
CREATE INDEX IF NOT EXISTS checklist_items_source_tag_idx
  ON public.checklist_items (source_tag)
  WHERE source_tag IS NOT NULL;

-- Cards made before the column: the tag is in a link. The keys are letters, digits, dots and dashes, which a link
-- carries as they are, so nothing needs decoding.
UPDATE public.checklist_items AS i
SET source_tag = t.tag
FROM (
  SELECT c.id,
         (SELECT substring(l FROM '[?&]todo=([A-Za-z0-9._-]+)')
          FROM unnest(c.links) AS l
          WHERE l ~ '[?&]todo=[A-Za-z0-9._-]+'
          LIMIT 1) AS tag
  FROM public.checklist_items AS c
  WHERE c.source_tag IS NULL
    AND c.links IS NOT NULL
    AND array_to_string(c.links, ' ') LIKE '%todo=%'
) AS t
WHERE t.id = i.id
  AND t.tag IS NOT NULL
  AND i.source_tag IS NULL;
