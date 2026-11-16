SET lock_timeout = '3s';

-- v2.7454 (punch list #345): a painted map's photos can be taken out of the bucket after the map is gone.
--
-- The bucket's two reading and removing policies asked for the map's row, so once a map was thrown away nobody
-- signed in could list or remove the files under its id, and they stayed with nothing pointing at them. This adds
-- one branch to each policy, for a file whose first folder is no map: its uploader and the office may list and
-- remove it. The half that holds while the map stands is word for word what it was, and the insert policy is not
-- touched, so nobody can add a file under a map that is gone.
--
--   1. painted_map_stands(text): is there a map with this id? Yes or no, past the caller's own row security, so a
--      map the caller cannot read never reads as a map that is gone.
--   2. painted_map_photos_files_select and painted_map_photos_files_delete, remade with the new branch.
--
-- Creates no table. Additive and idempotent: the function is replaced and each policy dropped and made again.

-- 1. The question. SECURITY DEFINER on purpose: under the caller's row security a hidden map and a missing map look
--    the same, and the new branch must open for the second only. It answers with a boolean and nothing about the
--    map. The id is compared as text, as the policies compare it, so a folder that is no id matches no map and no
--    cast can fail.
CREATE OR REPLACE FUNCTION public.painted_map_stands(p_map_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id::text = p_map_id)
$$;
REVOKE ALL ON FUNCTION public.painted_map_stands(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painted_map_stands(text) TO authenticated;
COMMENT ON FUNCTION public.painted_map_stands(text) IS 'Paint a map (#345): true when a painted map with this id exists, read past the caller''s row security. Yes or no, nothing about the map. The photo bucket asks it to tell a map that is gone from a map the caller cannot read.';

-- 2. The bucket. While the map stands: whoever reads the map reads its photos, and removing one is its uploader's
--    and the office's, as before. Once the map is gone: its uploader and the office may list and remove the file,
--    and nobody else reads it. A maker who is not office therefore takes their own uploads with the map, and a
--    teammate's photo stays until the office removes it.
DROP POLICY IF EXISTS painted_map_photos_files_select ON storage.objects;
CREATE POLICY painted_map_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'painted-map-photos'
    AND (
      EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id::text = split_part(objects.name, '/', 1))
      OR (
        (owner = auth.uid() OR public.is_office_staff())
        AND NOT public.painted_map_stands(split_part(objects.name, '/', 1))
      )
    )
  );
DROP POLICY IF EXISTS painted_map_photos_files_delete ON storage.objects;
CREATE POLICY painted_map_photos_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'painted-map-photos'
    AND (owner = auth.uid() OR public.is_office_staff())
    AND (
      EXISTS (SELECT 1 FROM public.painted_maps m WHERE m.id::text = split_part(objects.name, '/', 1))
      OR NOT public.painted_map_stands(split_part(objects.name, '/', 1))
    )
  );
