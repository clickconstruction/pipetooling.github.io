/**
 * Which name the Edit/New Job "Create customer from job" flow should use.
 *
 * The Customer block has two text inputs that both look like "the customer's
 * name": the "Link to customer" search box (`customerSearch`) and the
 * "Customer Name" field lower in the section (`customerName`). Users type the
 * new customer's name into the search box — that is where you go to look for a
 * customer, and finding none is exactly when you want to create one — but the
 * create handler only ever read `customerName`. On a job with no customer name
 * the create button stayed disabled; on a job that had one, create silently
 * used the stale prefill instead of what was typed.
 *
 * Rule: while no customer is linked, non-empty search text is the user's
 * intent and wins. Otherwise fall back to the Customer Name field.
 */
export function resolveCreateCustomerName(input: {
  customerName: string
  customerSearch: string
  customerId: string | null
}): string {
  const typed = input.customerSearch.trim()
  const named = input.customerName.trim()
  if (!input.customerId && typed) return typed
  return named
}
