SET lock_timeout = '3s';

-- Punch list #270's photos table (20261106030000_machines.sql) got SELECT, INSERT and DELETE policies and no UPDATE
-- policy, so the storage_path the phone writes after each upload (addCheckPhoto in src/lib/machines/checksIo.ts) was
-- refused silently, zero rows and no error, and the photo-save sweep, which files the rows that have a storage_path
-- and no filed_at, never filed a machine photo into Drive. Found on the 2026-11-06 live walk of punch list #271
-- (v2.6578). The taker may update their own row until the sweep has filed it, as report_photos_update_own lets a
-- report's taker, and may not mark it filed; the sweep writes as the service role and is not bound by this.
DROP POLICY IF EXISTS "machine_check_photos update" ON public.machine_check_photos;
CREATE POLICY "machine_check_photos update" ON public.machine_check_photos FOR UPDATE TO authenticated
  USING (by_user_id = auth.uid() AND filed_at IS NULL)
  WITH CHECK (by_user_id = auth.uid() AND filed_at IS NULL);
