/**
 * Projects → Forecast → Specific stage modal: Line Items For Office data layer.
 *
 * Pure data-access helpers (no React) that mirror the Workflow page's Line Items For
 * Office behavior:
 *
 *   - Load `workflow_step_line_items` for one step.
 *   - Load the picker options for "+ Add Supply House Invoice" (recent invoices, joined
 *     to `supply_houses` for the name) and "+ Add PO" (finalized POs with totals).
 *   - Persist add/edit/delete line items, with the special-case writers `addPOToStep`
 *     and `addInvoiceToStep` that fabricate a memo + amount from the PO / invoice and
 *     stamp the FK column so the Workflow page's "View PO" / "View Invoice" buttons
 *     keep working.
 *   - Load detail snapshots for the View PO / View Invoice popovers.
 *   - Small URL / amount / date formatters that the section UI reuses verbatim from
 *     Workflow's local helpers so the visual output matches.
 *
 * All errors are returned as `string | null` (or the strict `Result` shape on the more
 * complex actions) so callers can render them with the existing Toast / inline-error
 * patterns without each call site re-stringifying Supabase errors.
 */

import { supabase } from './supabase'
import type { Database } from '../types/database'

export type LineItemRow = Database['public']['Tables']['workflow_step_line_items']['Row']

export type AvailablePOOption = { id: string; name: string; total: number }

export type AvailableInvoiceOption = {
  id: string
  invoice_number: string
  supply_house_name: string
  amount: number
  invoice_date: string
  due_date: string | null
  is_paid: boolean
  purchase_order_number: string | null
}

export type PODetail = {
  id: string
  name: string
  items: Array<{
    part: { name: string }
    quantity: number
    supply_house: { name: string } | null
    price_at_time: number
  }>
}

export type InvoiceDetail = {
  id: string
  invoice_number: string
  supply_house_name: string
  amount: number
  link: string | null
}

export async function loadLineItemsForStep(stepId: string): Promise<{
  items: LineItemRow[]
  error: string | null
}> {
  if (!stepId) return { items: [], error: null }
  const { data, error } = await supabase
    .from('workflow_step_line_items')
    .select('*')
    .eq('step_id', stepId)
    .order('sequence_order', { ascending: true })
  if (error) {
    // RLS rejection codes mimic the Workflow page's quiet handling — surface them so the
    // section can render the read-only-or-blocked state, but callers can choose whether to
    // toast the user. We pass the message back verbatim.
    return { items: [], error: error.message }
  }
  return { items: (data as LineItemRow[]) ?? [], error: null }
}

/** Finalized POs available to attach to a step (matches Workflow page's loader). */
export async function loadFinalizedPOOptions(): Promise<{
  options: AvailablePOOption[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, name')
    .eq('status', 'finalized')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return { options: [], error: error.message }
  const pos = (data as Array<{ id: string; name: string }>) ?? []
  if (pos.length === 0) return { options: [], error: null }
  const poIds = pos.map((p) => p.id)
  const { data: itemsData } = await supabase
    .from('purchase_order_items')
    .select('purchase_order_id, price_at_time, quantity')
    .in('purchase_order_id', poIds)
  const totalsByPo: Record<string, number> = {}
  ;(itemsData ?? []).forEach((item: { purchase_order_id: string; price_at_time: number; quantity: number }) => {
    const id = item.purchase_order_id
    totalsByPo[id] = (totalsByPo[id] ?? 0) + item.price_at_time * item.quantity
  })
  return {
    options: pos.map((po) => ({ ...po, total: totalsByPo[po.id] ?? 0 })),
    error: null,
  }
}

export async function loadSupplyHouseInvoiceOptions(): Promise<{
  options: AvailableInvoiceOption[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('supply_house_invoices')
    .select(`
      id,
      invoice_number,
      invoice_date,
      due_date,
      amount,
      is_paid,
      purchase_order_number,
      supply_house_id,
      supply_houses(name)
    `)
    .order('invoice_date', { ascending: false })
    .limit(100)
  if (error) return { options: [], error: error.message }
  const rows = (data as Array<{
    id: string
    invoice_number: string
    invoice_date: string
    due_date: string | null
    amount: number
    is_paid: boolean
    purchase_order_number: string | null
    supply_houses: { name: string } | null
  }>) ?? []
  return {
    options: rows.map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date,
      due_date: r.due_date,
      amount: r.amount,
      is_paid: r.is_paid,
      purchase_order_number: r.purchase_order_number,
      supply_house_name: r.supply_houses?.name ?? 'Unknown',
    })),
    error: null,
  }
}

export type SaveLineItemArgs = {
  stepId: string
  /** Pass the existing row to UPDATE; pass `null` to INSERT a new line item. */
  item: LineItemRow | null
  memo: string
  amount: string
  itemDate: string
  link: string
  /** Used to compute the new row's `sequence_order` on inserts. */
  existing: readonly LineItemRow[]
}

export async function saveLineItem(args: SaveLineItemArgs): Promise<string | null> {
  const { stepId, item, memo, amount, itemDate, link, existing } = args
  if (!memo.trim()) return 'Memo is required'
  const amountNum = parseFloat(amount) || 0
  const itemDateVal = itemDate.trim() ? itemDate.trim().slice(0, 10) : null
  const trimmedLink = link.trim()
  let finalLink: string | null = null
  if (trimmedLink) {
    const normalized = normalizeUrl(trimmedLink)
    if (!normalized || !normalized.trim()) return 'Link must be a valid URL'
    finalLink = normalized
  }
  if (item) {
    const { error } = await supabase
      .from('workflow_step_line_items')
      .update({ link: finalLink, memo: memo.trim(), amount: amountNum, item_date: itemDateVal })
      .eq('id', item.id)
    if (error) return `Failed to update line item: ${error.message}`
    return null
  }
  const maxOrder = Math.max(0, ...existing.map((li) => li.sequence_order))
  const { error } = await supabase.from('workflow_step_line_items').insert({
    step_id: stepId,
    memo: memo.trim(),
    amount: amountNum,
    item_date: itemDateVal,
    link: finalLink,
    sequence_order: maxOrder + 1,
  })
  if (error) return `Failed to add line item: ${error.message}`
  return null
}

export async function deleteLineItemRow(itemId: string): Promise<string | null> {
  const { error } = await supabase.from('workflow_step_line_items').delete().eq('id', itemId)
  return error ? `Failed to delete line item: ${error.message}` : null
}

export async function addPOToStep(
  stepId: string,
  poId: string,
  existing: readonly LineItemRow[],
): Promise<string | null> {
  const { data: itemsData } = await supabase
    .from('purchase_order_items')
    .select('price_at_time, quantity')
    .eq('purchase_order_id', poId)
  const total = (itemsData ?? []).reduce(
    (sum, item: { price_at_time: number; quantity: number }) =>
      sum + item.price_at_time * item.quantity,
    0,
  )
  const { data: poData } = await supabase
    .from('purchase_orders')
    .select('name')
    .eq('id', poId)
    .single()
  const poName = (poData as { name: string } | null)?.name || 'Purchase Order'
  const itemCount = itemsData?.length || 0
  const maxOrder = Math.max(0, ...existing.map((li) => li.sequence_order))
  const { error } = await supabase.from('workflow_step_line_items').insert({
    step_id: stepId,
    memo: `PO: ${poName} - ${itemCount} items, $${total.toFixed(2)} total`,
    amount: total,
    sequence_order: maxOrder + 1,
    purchase_order_id: poId,
  })
  return error ? `Failed to add PO to step: ${error.message}` : null
}

export async function addInvoiceToStep(
  stepId: string,
  invoiceId: string,
  existing: readonly LineItemRow[],
): Promise<string | null> {
  const { data: invData, error: invError } = await supabase
    .from('supply_house_invoices')
    .select('*, supply_houses(name)')
    .eq('id', invoiceId)
    .single()
  if (invError || !invData) {
    return `Failed to load invoice: ${invError?.message ?? 'Not found'}`
  }
  const inv = invData as {
    invoice_number: string
    amount: number
    supply_houses: { name: string } | null
  }
  const supplyHouseName = inv.supply_houses?.name ?? 'Unknown'
  const memo = `Invoice #${inv.invoice_number} - ${supplyHouseName} - $${Number(inv.amount).toFixed(2)}`
  const maxOrder = Math.max(0, ...existing.map((li) => li.sequence_order))
  const { error } = await supabase.from('workflow_step_line_items').insert({
    step_id: stepId,
    memo,
    amount: inv.amount,
    sequence_order: maxOrder + 1,
    supply_house_invoice_id: invoiceId,
  })
  return error ? `Failed to add invoice to step: ${error.message}` : null
}

export async function loadPODetail(poId: string): Promise<{
  detail: PODetail | null
  error: string | null
}> {
  const { data: poData, error: poError } = await supabase
    .from('purchase_orders')
    .select('id, name')
    .eq('id', poId)
    .single()
  if (poError || !poData) {
    return { detail: null, error: `Failed to load PO: ${poError?.message ?? 'Not found'}` }
  }
  const { data: itemsData, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select('*, material_parts(*), supply_houses(*)')
    .eq('purchase_order_id', poId)
    .order('sequence_order', { ascending: true })
  if (itemsError) {
    return { detail: null, error: `Failed to load PO items: ${itemsError.message}` }
  }
  const items = (itemsData as unknown as Array<{
    quantity: number
    price_at_time: number
    material_parts: { name: string }
    supply_houses: { name: string } | null
  }>) ?? []
  const row = poData as { id: string; name: string }
  return {
    detail: {
      id: row.id,
      name: row.name,
      items: items.map((item) => ({
        part: { name: item.material_parts.name },
        quantity: item.quantity,
        supply_house: item.supply_houses as { name: string } | null,
        price_at_time: item.price_at_time,
      })),
    },
    error: null,
  }
}

export async function loadInvoiceDetail(invoiceId: string): Promise<{
  detail: InvoiceDetail | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('supply_house_invoices')
    .select('*, supply_houses(name)')
    .eq('id', invoiceId)
    .single()
  if (error || !data) {
    return { detail: null, error: `Failed to load invoice: ${error?.message ?? 'Not found'}` }
  }
  const row = data as {
    id: string
    invoice_number: string
    amount: number
    link: string | null
    supply_houses: { name: string } | null
  }
  return {
    detail: {
      id: row.id,
      invoice_number: row.invoice_number,
      supply_house_name: row.supply_houses?.name ?? 'Unknown',
      amount: row.amount,
      link: row.link ?? null,
    },
    error: null,
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────
// Small display helpers — copy/pasted from Workflow.tsx so the section's visual output
// matches exactly. Marked exported so the section UI + any future tests can pull from
// one source of truth.
// ──────────────────────────────────────────────────────────────────────────────────────

export function normalizeUrl(url: string | null | undefined): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.match(/^https?:\/\//i)) return trimmed
  if (trimmed.match(/^https?\/\//i)) return trimmed.replace(/^(https?)\/\//i, '$1://')
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return `https://${trimmed}`
}

export function formatAmount(amount: number | null | undefined): string {
  const value = amount || 0
  const absValue = Math.abs(value)
  const formatted = absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return value < 0 ? `-$${formatted}` : `$${formatted}`
}

export function formatLineItemDate(isoDate: string | null | undefined): string {
  if (isoDate == null || isoDate === '') return '\u2014'
  const ymd = isoDate.slice(0, 10)
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '\u2014'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatShortIsoDate(iso: string | null | undefined): string {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' })
}
