-- Add links column to checklist_items for URL placeholders [1], [2], etc. in title
ALTER TABLE public.checklist_items
ADD COLUMN links text[] DEFAULT '{}';

COMMENT ON COLUMN public.checklist_items.links IS 'URLs for placeholders [1], [2], ... in title. links[0] = [1], links[1] = [2], etc.';
