/**
 * Whether the signer's page can show a site's address yet (punch list #439, piece 3, part 3e). The box **Print the
 * site's address on the paper** is a promise about what a signer reads, and the signer's page reads through the edge
 * function `get-contract-for-signer`. An edge function is deployed apart from the app, so the app asks before it
 * offers the box: the sample paper's answer has a `site_address` key once the function knows the rule
 * (`answersSitePrint`). No row is read and nothing is written: the sample token answers from a fixture.
 *
 * A yes is kept for the session, since a deployed function stays deployed. A no is asked again the next time.
 * Browser io, not pure; the rule is `supabase/functions/_shared/paperSitePrint.ts`.
 */
import { SAMPLE_TOKEN } from '../customerSample'
import { publicFunctionHeaders } from '../customerSampleMode'
import { answersSitePrint } from '../../../supabase/functions/_shared/paperSitePrint'

let knownYes = false

/** True when the signer's page shows a paper's site address. Throws when the function could not be asked. */
export async function readSignerPageShowsSite(): Promise<boolean> {
  if (knownYes) return true
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/get-contract-for-signer?token=${encodeURIComponent(SAMPLE_TOKEN)}`, {
    headers: await publicFunctionHeaders('live'),
  })
  if (!res.ok) throw new Error(`The signer’s page answered ${res.status}.`)
  knownYes = answersSitePrint(await res.json())
  return knownYes
}

/** For tests: forget a kept yes. */
export function forgetSignerPageShowsSite(): void {
  knownYes = false
}
