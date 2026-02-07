-- Allow masters and devs to see other masters
-- This is needed for the "Share with other Master" feature in Settings

CREATE POLICY "Masters and devs can see other masters"
ON public.users
FOR SELECT
USING (
  role = 'master_technician'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
);

COMMENT ON POLICY "Masters and devs can see other masters" ON public.users IS 'Allows masters and devs to view all master_technician users. Required for master sharing feature.';
