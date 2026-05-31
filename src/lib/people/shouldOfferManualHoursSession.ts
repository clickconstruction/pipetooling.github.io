export interface ManualHoursSessionOfferInput {
  /** Decimal hours the user just typed into the grid cell. */
  hoursDecimal: number
  canAccessHours: boolean
  canAccessPay: boolean
  /** Whether this person's hours are editable (not salary-only). */
  canEditHours: boolean
  /** Whether the day is locked as "Correct". */
  dayIsMarkedCorrect: boolean
}

/** Hours grid blur rule: offer to open a manual My-Time session (instead of writing the grid value
 * straight to people_hours) only for a positive entry, with hours/pay access, on an editable,
 * not-yet-locked day. */
export function shouldOfferManualHoursSession({
  hoursDecimal,
  canAccessHours,
  canAccessPay,
  canEditHours,
  dayIsMarkedCorrect,
}: ManualHoursSessionOfferInput): boolean {
  return (
    hoursDecimal > 0 &&
    (canAccessHours || canAccessPay) &&
    canEditHours &&
    !dayIsMarkedCorrect
  )
}
