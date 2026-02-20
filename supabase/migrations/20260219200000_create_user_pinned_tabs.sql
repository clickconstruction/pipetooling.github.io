-- Pins added for users (e.g. by devs via "Pin for" on Dashboard). Merged with localStorage pins on Dashboard.
CREATE TABLE public.user_pinned_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  label text NOT NULL,
  tab text
);

-- One pin per (user, path, tab). COALESCE so (path, null) and (path, null) are treated as same.
CREATE UNIQUE INDEX user_pinned_tabs_user_path_tab_key
  ON public.user_pinned_tabs (user_id, path, COALESCE(tab, ''));

COMMENT ON TABLE public.user_pinned_tabs IS 'Pins added for users (e.g. by devs). Shown on Dashboard merged with localStorage pins.';

ALTER TABLE public.user_pinned_tabs ENABLE ROW LEVEL SECURITY;

-- SELECT: users see only pins for themselves
CREATE POLICY "Users select own pinned tabs" ON public.user_pinned_tabs
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: own pins or dev inserting for any user
CREATE POLICY "Users insert own or dev inserts any" ON public.user_pinned_tabs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'dev'
  );

-- DELETE: users can delete only their own rows
CREATE POLICY "Users delete own pinned tabs" ON public.user_pinned_tabs
  FOR DELETE USING (auth.uid() = user_id);
