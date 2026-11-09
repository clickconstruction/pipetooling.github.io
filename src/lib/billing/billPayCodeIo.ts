/**
 * The bill's ten-letter short code (punch list #290, v2.6769): `bill_pay_code(p_invoice_id)` answers the code on the
 * row, or mints one on the first ask and keeps it, so the share row's text reads `my.clickplumbing.com/pay/<code>`.
 * One ask per bill per page load (a promise cache by id; a refusal is not cached, so the next draw asks again). Never
 * throws: a refusal (a training account, a twin, the RPC not yet pushed) answers null and the caller falls back to
 * the bill's id on the same page (`billTextLink`). The function is not in the generated types until its types PR, so
 * the client calls it untyped, as `estimateLinkIo.ts` does.
 */
import { isPayCode, isPayLinkId } from './payLink'

/** The little of a Supabase client the ask uses, so a test hands a fake. */
export interface BillPayCodeClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

const asked = new Map<string, Promise<string | null>>()

/** The code a successful answer carries; null for anything else. */
export function payCodeFromAnswer(answer: { data: unknown; error: unknown }): string | null {
  if (answer.error) return null
  const code = typeof answer.data === 'string' ? answer.data.trim().toLowerCase() : ''
  return isPayCode(code) ? code : null
}

/** The app's own client, loaded on the first ask so a test never needs the Supabase env. */
async function appClient(): Promise<BillPayCodeClient> {
  const mod = await import('../supabase')
  return mod.supabase as unknown as BillPayCodeClient
}

export async function billPayCode(invoiceId: string, client?: BillPayCodeClient): Promise<string | null> {
  const id = invoiceId.trim().toLowerCase()
  if (!isPayLinkId(id)) return null
  const pending = asked.get(id)
  if (pending) return pending
  const ask = (async () => {
    try {
      const db = client ?? (await appClient())
      const code = payCodeFromAnswer(await db.rpc('bill_pay_code', { p_invoice_id: id }))
      if (!code) asked.delete(id)
      return code
    } catch {
      asked.delete(id)
      return null
    }
  })()
  asked.set(id, ask)
  return ask
}

/** For tests: forget every ask. */
export function forgetBillPayCodes(): void {
  asked.clear()
}
