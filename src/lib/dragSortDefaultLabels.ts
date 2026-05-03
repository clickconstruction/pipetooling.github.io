import { supabase } from './supabase'
import { DatabaseError, withRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'

type DragSortLabelInsert = Database['public']['Tables']['mercury_drag_sort_labels']['Insert']

export type DragSortDefaultLabelDef = {
  defaultKey: string
  name: string
  scheduleCLine: string
  description: string
}

/**
 * Built-in accounting labels (Drag Sort tab; Schedule C–oriented). Inserted once per org per default_key; not editable in UI/DB trigger.
 * Order sets initial sort_order (index × 10).
 */
export const DRAG_SORT_DEFAULT_LABELS: DragSortDefaultLabelDef[] = [
  {
    defaultKey: 'advertising',
    name: 'Advertising',
    scheduleCLine: '8',
    description:
      'Marketing, ads, business cards, website promotion, truck wraps, flyers',
  },
  {
    defaultKey: 'car_truck_expenses',
    name: 'Car and Truck Expenses',
    scheduleCLine: '9',
    description:
      'Vehicle fuel/gas, maintenance, repairs, insurance, registration (actual expenses or standard mileage rate)',
  },
  {
    defaultKey: 'fuel_gas',
    name: 'Fuel / Gas',
    scheduleCLine: '9',
    description: 'Gasoline, diesel, and fuel for business vehicles/trucks',
  },
  {
    defaultKey: 'vehicle_maintenance_repairs',
    name: 'Vehicle Maintenance & Repairs',
    scheduleCLine: '9',
    description: 'Oil changes, tires, brakes, and routine truck upkeep',
  },
  {
    defaultKey: 'commissions_fees',
    name: 'Commissions and Fees',
    scheduleCLine: '10',
    description: 'Referral fees, sales commissions, or marketplace/platform fees',
  },
  {
    defaultKey: 'contract_labor',
    name: 'Contract Labor',
    scheduleCLine: '11',
    description: 'Payments to independent contractors, subs, or 1099 helpers',
  },
  {
    defaultKey: 'insurance',
    name: 'Insurance',
    scheduleCLine: '15',
    description:
      "Business liability, workers' comp, shop, and property insurance (vehicle portion may go in Line 9)",
  },
  {
    defaultKey: 'legal_professional',
    name: 'Legal and Professional Services',
    scheduleCLine: '17',
    description: 'Accountant, lawyer, bookkeeper, and consulting fees',
  },
  {
    defaultKey: 'office_expense',
    name: 'Office Expense',
    scheduleCLine: '18',
    description: 'Paper, postage, software subscriptions, general office supplies',
  },
  {
    defaultKey: 'rent_lease_20a',
    name: 'Equipment Lease',
    scheduleCLine: '20a',
    description: 'Vehicles, machinery, and equipment',
  },
  {
    defaultKey: 'rent_lease_20b',
    name: 'Property Lease',
    scheduleCLine: '20b',
    description: 'other business property',
  },
  {
    defaultKey: 'repairs_maintenance',
    name: 'Repairs and Maintenance',
    scheduleCLine: '21',
    description: 'Repairs to shop, equipment, or property (not capital improvements)',
  },
  {
    defaultKey: 'supplies',
    name: 'Supplies',
    scheduleCLine: '22',
    description: 'General materials, parts, and consumables used in business',
  },
  {
    defaultKey: 'job_materials_parts',
    name: 'Job Materials & Parts',
    scheduleCLine: '22 or COGS',
    description:
      'Pipes, fittings, valves, fixtures, and job-specific plumbing supplies',
  },
  {
    defaultKey: 'consumables',
    name: 'Consumables',
    scheduleCLine: '22',
    description:
      'Blades, gloves, tape, solder, drill bits, and other quick-use items (e.g., Harbor Freight purchases)',
  },
  {
    defaultKey: 'shop_supplies',
    name: 'Shop Supplies',
    scheduleCLine: '22',
    description: 'General workshop consumables and safety items',
  },
  {
    defaultKey: 'tools_small_equipment',
    name: 'Tools & Small Equipment',
    scheduleCLine: '22 or 13',
    description:
      'Hand tools, power tools, and small items (expensed if under de minimis limits)',
  },
  {
    defaultKey: 'taxes_licenses',
    name: 'Taxes and Licenses',
    scheduleCLine: '23',
    description: 'Business licenses, permits, and certain taxes',
  },
  {
    defaultKey: 'travel',
    name: 'Travel',
    scheduleCLine: '24a',
    description: 'Airfare, hotels, rental cars for business travel (not commuting)',
  },
  {
    defaultKey: 'meals',
    name: 'Meals',
    scheduleCLine: '24b',
    description: 'Business meals (usually 50% deductible)',
  },
  {
    defaultKey: 'utilities',
    name: 'Utilities',
    scheduleCLine: '25',
    description: 'Electricity, water, internet, and phone for business use',
  },
  {
    defaultKey: 'wages',
    name: 'Wages',
    scheduleCLine: '26',
    description: 'Employee salaries and wages (reduce by certain credits if applicable)',
  },
  {
    defaultKey: 'other_expenses_27a',
    name: 'Other Expenses',
    scheduleCLine: '27a',
    description:
      'Catch-all items like uniforms, continuing education, protective gear, or miscellaneous (describe each)',
  },
  {
    defaultKey: 'bad_debts_27b',
    name: 'Bad Debts',
    scheduleCLine: '27b (Other Expenses)',
    description: 'Uncollectible customer invoices',
  },
  {
    defaultKey: 'cogs_part_iii',
    name: 'Cost of Goods Sold',
    scheduleCLine: 'Part III',
    description: 'Direct materials and labor costs tied to jobs (if you track inventory)',
  },
  {
    defaultKey: 'income_part_i',
    name: 'Income',
    scheduleCLine: 'Part I',
    description: 'Gross receipts or sale',
  },
]

export async function ensureDragSortDefaultLabels(): Promise<void> {
  const payload: DragSortLabelInsert[] = DRAG_SORT_DEFAULT_LABELS.map((def, i) => ({
    default_key: def.defaultKey,
    name: def.name,
    schedule_c_line: def.scheduleCLine,
    description: def.description,
    is_system_default: true,
    sort_order: i * 10,
  }))
  await withRetry(async () => {
    const { error } = await supabase.from('mercury_drag_sort_labels').upsert(payload, {
      onConflict: 'default_key',
      ignoreDuplicates: true,
    })
    if (error) {
      throw new DatabaseError(
        `Failed to upsert mercury_drag_sort default labels: ${error.message}`,
        error.code,
        error.details
      )
    }
  })
}
