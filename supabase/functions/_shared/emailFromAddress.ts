/**
 * The sending address every sender falls back to when the `EMAIL_FROM` secret is unset —
 * one dependency-free constant so the app's From lines (`src/lib/customerEmailFrom.ts`)
 * and the Deno senders (`emailFrom.ts`) read the same address. The live secret mirrors it
 * (docs/DOMAIN_CUTOVER.md); change both together.
 */
export const EMAIL_FROM_FALLBACK_ADDRESS = 'team@noreply.clicktooling.com'
export const EMAIL_FROM_FALLBACK = `ClickTooling <${EMAIL_FROM_FALLBACK_ADDRESS}>`
