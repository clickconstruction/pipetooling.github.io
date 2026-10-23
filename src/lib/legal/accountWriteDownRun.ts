/**
 * The account write-down's run (v2.5760): each bill in turn through the per-bill path the Apply discount window
 * uses — Stripe's function for a Stripe-hosted bill, the RPC for the rest. Do what is ready, never all or nothing:
 * a bill the write-down refuses is held with the reason and the rest still go. The IO is handed in, so the loop
 * is tested without a database.
 */
import type { AccountBillShare } from './accountWriteDown'

export type WriteDownHeld = { jobLabel: string; reason: string }
/** Each door answers null when the bill was written down, else the refusal's words. A throw is a refusal too. */
export type WriteDownIo = {
  stripe: (share: AccountBillShare, note: string) => Promise<string | null>
  rpc: (share: AccountBillShare, note: string) => Promise<string | null>
}

export async function runAccountWriteDown(writes: ReadonlyArray<AccountBillShare>, note: string, io: WriteDownIo): Promise<{ done: number; held: WriteDownHeld[] }> {
  let done = 0
  const held: WriteDownHeld[] = []
  for (const s of writes) {
    try {
      const refused = s.stripeHosted ? await io.stripe(s, note) : await io.rpc(s, note)
      if (refused) held.push({ jobLabel: s.jobLabel, reason: refused })
      else done += 1
    } catch (e: unknown) {
      held.push({ jobLabel: s.jobLabel, reason: e instanceof Error && e.message ? e.message : 'the write-down failed' })
    }
  }
  return { done, held }
}
