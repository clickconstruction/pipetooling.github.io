/** Catalog line shape shared by DB (`estimate_catalog_items`) and draft line items. */
export type EstimateCatalogLineItem = {
  id: string
  line_item: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
}
