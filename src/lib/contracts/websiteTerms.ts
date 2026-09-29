/**
 * The public Terms of Service: clickplumbing.com's footer links "Terms of Service" to /terms, a stub
 * that redirects to a page Housecall Pro hosts. The app cannot read that page at run time (another
 * origin, no API), so Settings → Contracts & terms shows this copy, dated by the day it was made.
 * When the page changes, paste the new wording here and move the date. The Estimate Terms and
 * Conditions (a Settings text) started from this document.
 */
export const WEBSITE_TERMS_URL = 'https://pro.housecallpro.com/ClickPlumbing/712596/terms'
export const WEBSITE_TERMS_HOSTED_BY = 'Housecall Pro'
/** The day the copy below was taken from the live page. */
export const WEBSITE_TERMS_COPIED_YMD = '2026-09-29'

/** "copied Sep 29, 2026" — the card's date line for a copy of a page kept elsewhere. */
export function copiedLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return 'copied on an unknown day'
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `copied ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export const WEBSITE_TERMS_TEXT = `CLICK PLUMBING AND ELECTRICAL – TERMS AND CONDITIONS
(Applicable to all invoices, proposals, and contracts unless superseded by a fully executed written agreement)

1. Payment Terms
Payment is due immediately upon receipt of invoice unless otherwise stated. Acceptable forms of payment include check, ACH, wire, or credit card (3% processing fee applies to credit card payments).

2. Late Payment / Prompt Payment Act
Pursuant to Texas Property Code Chapter 28 (Prompt Payment to Contractors and Subcontractors), invoices unpaid after 45 days from the invoice date shall bear interest at the rate of one and one-half percent (1.5%) per month (18% per annum) on the unpaid balance. Customer shall also be responsible for all collection costs, reasonable attorney’s fees, and court costs incurred to collect any overdue amount.

3. Conditional Lien Waiver
Any lien waiver provided with an invoice is conditional and becomes effective only upon receipt and collection of good funds in the full amount of the invoice. Click Plumbing and Electrical expressly reserves all mechanic’s lien, payment bond, and stop-payment notice rights until payment has cleared.

4. Change Orders
Any additional work or modifications to the original scope must be paid before the final invoice is complete. Payments may be applied partially to change orders before they are applied to the final bill at the discretion of Click Plumbing and Electrical, this may lead to lien waivers. Approved change orders will be billed at the rates shown or at time-and-material rates if no price is stated.

5. Warranty

Click Plumbing and Electrical warrants its workmanship for one (1) year from the date of substantial completion. Manufacturer warranties on materials and equipment shall pass through to Customer to the extent permitted by the manufacturer. This warranty does not cover damage caused by misuse, neglect, acts of God, or work performed by others.

6. Price Validity
Quoted prices are valid for 30 days from the date of the proposal unless otherwise noted.

7. Cancellation / Restocking Fees
Special-order materials are non-cancelable and non-refundable. A restocking fee of up to 30% may be charged on returned stock items.

8. Dispute Resolution & Venue
Any disputes arising under this agreement shall be governed by the laws of the State of Texas. Venue for any legal action shall lie exclusively in Guadalupe County, Texas.

9. Entire Agreement
These Terms and Conditions, together with the face of the invoice or signed proposal, constitute the entire agreement between the parties and supersede all prior discussions or agreements.

10. Severability
If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.

Click Plumbing and Electrical
5501 Balcones Dr, Ste A-141
Austin, Texas 78731
Phone: 210-773-7385
Email: office@clickplumbing.com
Texas State Board of Plumbing Examiners License RMP 41130
www.clickplumbing.com/terms`
