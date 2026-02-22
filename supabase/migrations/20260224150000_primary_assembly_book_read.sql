-- Ensure primaries can read material_templates and material_template_items for Assembly Book
-- Primaries can see the Assembly Book tab but assemblies may be empty if RLS blocks reads.
-- Add explicit policies so primaries can read assemblies.

-- material_templates
DROP POLICY IF EXISTS "Primaries can read material templates" ON public.material_templates;
CREATE POLICY "Primaries can read material templates"
ON public.material_templates FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
);

-- material_template_items
DROP POLICY IF EXISTS "Primaries can read material template items" ON public.material_template_items;
CREATE POLICY "Primaries can read material template items"
ON public.material_template_items FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
);

COMMENT ON POLICY "Primaries can read material templates" ON public.material_templates IS
  'Allows primaries to read material templates (assemblies) for Assembly Book display.';
COMMENT ON POLICY "Primaries can read material template items" ON public.material_template_items IS
  'Allows primaries to read material template items for Assembly Book assembly details.';
