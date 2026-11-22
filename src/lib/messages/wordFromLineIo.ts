/** The read behind the word from the thread (v2.5649): a customer's jobs the caller is a person of, as money lines. A read that fails gives none, and the press says so. */
import { bidMoneyLine, parseBidMoneyStrip, todayYmd, type BidMoneyLine } from '../bids/bidMoneyLine'
import { supabase } from '../supabase'

export async function loadCustomerMoneyLines(customerId: string, client: unknown = supabase): Promise<BidMoneyLine[]> {
  try {
    const db = client as typeof supabase
    const res = await db.rpc('list_customer_money_strip', { p_customer_id: customerId })
    if (res.error) return []
    const today = todayYmd()
    return parseBidMoneyStrip(res.data).map((e) => bidMoneyLine(e, today))
  } catch {
    return []
  }
}
