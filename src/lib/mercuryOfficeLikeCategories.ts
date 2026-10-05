// Mercury's own category on a card charge, and the categories that are office
// spending by nature. One list for every reader: People → Review's office-charges
// line (`people/reviewOfficeLikeCharges.ts`) and the Tally sort suggestions
// (`tally/tallySortSuggestion.ts`). Pure — no Supabase.

/**
 * Mercury categories that are overhead by nature, never a job's direct cost.
 * Fuel, vehicle expenses, retail, professional services, fees and government
 * services are deliberately NOT here — those can be legitimate job purchases
 * (fuel to reach the site, permits, rentals) and are a separate labelling
 * question.
 */
export const OFFICE_LIKE_MERCURY_CATEGORIES: readonly string[] = [
  'Software',
  'Utilities',
  'Insurance',
  'InternetAndTelephone',
  'Advertising',
  'Medical',
  'Education',
]

/** `mercury_transactions.mercury_category` is jsonb: usually a JSON string, occasionally null/other. */
export function mercuryCategoryString(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null
  if (v && typeof v === 'object' && 'name' in v && typeof (v as { name: unknown }).name === 'string') {
    return ((v as { name: string }).name.trim() || null)
  }
  return null
}
