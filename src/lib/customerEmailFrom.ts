/**
 * The From line a customer sees, as the client can know it (punch list #53, PR 3, v2.4138).
 * The browser cannot read the `EMAIL_FROM` function secret, so the address is the fallback
 * the senders share (`_shared/emailFromAddress.ts`), which the live secret mirrors. The display name follows the
 * senders: the estimate's per-trade company (`estimateEmailCompanyName`), the company for
 * every other customer-facing email (`COMPANY_EMAIL_FROM` on the server).
 */
import { PORTAL_COMPANY } from '../../supabase/functions/_shared/portalCompany'
import { EMAIL_FROM_FALLBACK_ADDRESS } from '../../supabase/functions/_shared/emailFromAddress'
import { mailboxWithName } from '../../supabase/functions/_shared/mailboxWithName'
import { estimateEmailCompanyName, type EstimateLetterheadBrand } from './estimateEmailLetterhead'

/** The Resend-verified sending address (the address half of the live `EMAIL_FROM`). */
export const CUSTOMER_EMAIL_FROM_ADDRESS = EMAIL_FROM_FALLBACK_ADDRESS

/** `Click Plumbing and Electrical <team@…>` — what every customer-facing email other than the estimate sends as. */
export const COMPANY_EMAIL_FROM_LABEL = mailboxWithName(PORTAL_COMPANY.name, CUSTOMER_EMAIL_FROM_ADDRESS)

/** The estimate email's From for its brand — `Click Plumbing <team@…>`, `Click Electrical <…>`, or the company. */
export function estimateEmailFrom(brand: EstimateLetterheadBrand): string {
  return mailboxWithName(estimateEmailCompanyName(brand), CUSTOMER_EMAIL_FROM_ADDRESS)
}
