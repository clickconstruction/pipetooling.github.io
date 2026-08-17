/**
 * Customers list — type-classifier suggestion kernel (list redesign PR 3).
 * Pure name heuristic: business words → commercial, otherwise residential.
 * Suggestions only — the Classify modal shows every row pre-selected and the
 * user flips any before applying; nothing is written without review.
 */

const BUSINESS_WORDS =
  /\b(llc|inc|corp|co|ltd|lp|llp|company|construction|contracting|contractors?|builders?|group|services?|solutions?|foundation|properties|property|management|apartments?|housing|authority|city of|county|isd|school|church|carwash|car wash|saloon|restaurant|pizza|cafe|bar|grill|rv|park|ventures?|assoc|associates?|realty|reality|real estate|homes?|hoa|storage|express|salon|clinic|dental|medical|hotel|motel|inn|suites|plaza|center|centre|automotive|auto|repair|plumbing|electric|electrical|hvac|roofing|landscap\w*|remodel\w*|renovations?|designs?|interiors?|enterprises?|holdings?|partners?|investments?|capital|bank|credit union|church|ministries|academy|university|college|learning|daycare|assisted living|senior|healthcare|health|pharmacy|veterinary|vet|kennel|farms?|ranch|winery|brewery|distillery)\b/i

export type CustomerTypeSuggestion = {
  suggested: 'commercial' | 'residential'
  /** The business word that triggered a commercial suggestion, for display. */
  matchedWord: string | null
}

export function suggestCustomerType(name: string | null | undefined): CustomerTypeSuggestion {
  const n = (name ?? '').trim()
  const m = n.match(BUSINESS_WORDS)
  if (m) return { suggested: 'commercial', matchedWord: m[0] }
  return { suggested: 'residential', matchedWord: null }
}
