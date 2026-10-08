/**
 * GC mode, every email to a trade partner (P3-a): the one call the office screens make to `gc-trade-email`. It never
 * throws for a refusal: the answer carries the key, and the screen says it with `gcTradeEmailRefusal`.
 */
import { supabase } from '../supabase'
import { readTradeEmailAnswer, type TradeEmailAnswer, type TradeEmailRequest } from './tradeEmail'

export async function sendGcTradeEmail(req: Omit<TradeEmailRequest, 'group'> & { group?: TradeEmailRequest['group'] }): Promise<TradeEmailAnswer> {
  try {
    const r = await supabase.functions.invoke('gc-trade-email', { body: req })
    const context = (r.error as { context?: { json?: () => Promise<unknown> } } | null)?.context
    const errorBody = r.error ? ((await context?.json?.().catch(() => null)) ?? { error: 'failed', detail: r.error.message }) : null
    return readTradeEmailAnswer(r.data, errorBody)
  } catch (e) {
    return { ok: false, key: 'failed', detail: e instanceof Error ? e.message : String(e) }
  }
}
