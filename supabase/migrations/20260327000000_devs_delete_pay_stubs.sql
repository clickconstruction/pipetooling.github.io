-- Devs can delete pay stubs (e.g. to correct mistakes)
-- pay_stub_days cascade automatically via FK ON DELETE CASCADE

CREATE POLICY "Devs can delete pay stubs"
ON public.pay_stubs
FOR DELETE
USING (public.is_dev());
