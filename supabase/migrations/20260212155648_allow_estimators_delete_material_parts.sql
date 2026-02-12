-- Allow estimators to delete material parts
-- The previous policy used estimator_can_access_service_type which blocked estimators
-- with service type restrictions from deleting parts. This migration ensures estimators
-- can delete any material part (same as assistants).

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete material parts" ON public.material_parts;

CREATE POLICY "Devs, masters, assistants, and estimators can delete material parts"
ON public.material_parts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

COMMENT ON POLICY "Devs, masters, assistants, and estimators can delete material parts" ON public.material_parts IS
  'Allows devs, masters, assistants, and estimators to delete material parts. No service type restriction on delete.';
