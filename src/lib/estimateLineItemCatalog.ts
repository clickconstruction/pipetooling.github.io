/** Catalog line shape shared by DB (`estimate_catalog_items`) and draft line items. */
export type EstimateCatalogLineItem = {
  id: string
  description: string
  amount_cents: number
}
