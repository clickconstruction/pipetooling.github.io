-- Composite index for the common Materials query: filter by service_type_id, order by name
-- Reduces disk IO by avoiding full table scans when loading parts for a service type

CREATE INDEX IF NOT EXISTS idx_material_parts_service_type_name
  ON public.material_parts(service_type_id, name);
