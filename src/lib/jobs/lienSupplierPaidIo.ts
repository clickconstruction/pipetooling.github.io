import { supabase } from '../supabase'
import { paidAtIsoFromYmd } from '../materials/supplyHouseInvoiceForm'

/**
 * The write behind *Mark paid…* on a supply house's row (v2.5838, punch list #175): the same two
 * columns the Supply houses tab's Paid check writes on `supply_house_invoices`, so Held for suppliers,
 * the Liens window and the Legal desk read one truth. Who may: the office roles the table's update
 * policy names (dev, master, assistant, controller).
 */
export async function markSupplierInvoicesPaid(invoiceIds: ReadonlyArray<string>, paidOnYmd: string): Promise<void> {
  if (invoiceIds.length === 0) return
  const paidAt = paidAtIsoFromYmd(paidOnYmd)
  if (!paidAt) throw new Error('The day it was paid is not a real day')
  const { error } = await supabase.from('supply_house_invoices').update({ is_paid: true, paid_at: paidAt }).in('id', [...invoiceIds])
  if (error) throw error
}
