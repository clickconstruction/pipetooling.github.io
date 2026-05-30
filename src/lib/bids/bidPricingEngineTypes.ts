import type { Database } from '../../types/database'
import type { TakeoffStage } from './bidTakeoffHelpers'

export type MaterialTemplate = Database['public']['Tables']['material_templates']['Row']
export type MaterialTemplateWithAssemblyType = MaterialTemplate & { assembly_types?: { name: string } | null }
export type CostEstimate = Database['public']['Tables']['cost_estimates']['Row']
export type CostEstimateLaborRow = Database['public']['Tables']['cost_estimate_labor_rows']['Row']
export type FixtureLaborDefault = Database['public']['Tables']['fixture_labor_defaults']['Row']
export type PriceBookVersion = Database['public']['Tables']['price_book_versions']['Row']
export type PriceBookEntry = Database['public']['Tables']['price_book_entries']['Row']
export type BidPricingAssignment = Database['public']['Tables']['bid_pricing_assignments']['Row']
export type BidCountRowCustomPrice = Database['public']['Tables']['bid_count_row_custom_prices']['Row']
export type BidCountRowSubmissionHide = Database['public']['Tables']['bid_count_row_submission_hides']['Row']
export type LaborBookVersion = Database['public']['Tables']['labor_book_versions']['Row']
export type LaborBookEntry = Database['public']['Tables']['labor_book_entries']['Row']
export type TakeoffBookVersion = Database['public']['Tables']['takeoff_book_versions']['Row']
export type TakeoffBookEntry = Database['public']['Tables']['takeoff_book_entries']['Row']
export type TakeoffBookEntryItem = Database['public']['Tables']['takeoff_book_entry_items']['Row']
export type TakeoffBookEntryWithItems = TakeoffBookEntry & { items: TakeoffBookEntryItem[] }

export type TakeoffMapping = { id: string; countRowId: string; templateId: string; stage: TakeoffStage; quantity: number; isSaved: boolean }

export type TakeoffRoughPartLineRow = {
  id: string
  countRowId: string
  partId: string
  quantity: number
  unitPrice: number
  /** When set, unit_price came from this catalog row; null after manual price edit. */
  sourceMaterialPartPriceId: string | null
  /** When set, line was created from expanding this assembly (Add assembly). Cleared when user picks another part. */
  sourceTemplateId: string | null
  sequenceOrder: number
  isSaved: boolean
}

export type DraftPO = { id: string; name: string }
export type CostEstimatePO = { id: string; name: string; stage: string | null }

export type LaborBookEntryWithFixture = LaborBookEntry & {
  fixture_types?: { name: string } | null
}

export type PriceBookEntryWithFixture = PriceBookEntry & {
  fixture_types?: { name: string } | null
}
