/**
 * Interest and late fees a supply house charged (the owner, 2026-11-16: "occasionally when we wait more than 30
 * days interest will be applied to our bills and we may have to pay that as well").
 *
 * His call: interest is a bill of its own, tied to the bill that ran late, and kept off the job's cost. So it is a
 * row of `supply_house_invoices` with `is_interest` set and, when known, `late_invoice_id`. It is owed, aged and
 * paid like any bill. Typed as a loose amount it would vanish into a payment's total; as a bill, the year can say
 * what paying late cost and at which house.
 *
 * This file words it. Pure: no React, no Supabase.
 */

import { usd } from './supplyPayment'

/** `Interest on S4398120`, or `Interest or a late fee` when no late bill is named. Null for an ordinary bill. */
export function interestTitle(bill: { is_interest?: boolean | null; late_invoice_id?: string | null }, bills: ReadonlyArray<{ id: string; invoice_number: string }>): string | null {
  if (!bill.is_interest) return null
  const late = bill.late_invoice_id ? bills.find((b) => b.id === bill.late_invoice_id) : null
  return late ? `Interest on ${late.invoice_number}` : 'Interest or a late fee'
}

export type InterestYear = {
  year: string
  total: number
  /** The houses that charged any, the most first. */
  houses: { supplyHouseId: string; name: string; amount: number; count: number }[]
  /** `Interest and late fees in 2026: $61.20 · Pecan Supply $18.60 · Cedar Fork Supply $42.60`. Empty when there were none. */
  words: string
}

/** What paying late cost in one year, by house, from the day each charge was billed. Paid or not: it was charged. */
export function interestByHouse(
  invoices: ReadonlyArray<{ supply_house_id: string; amount: number | null; invoice_date: string | null; is_interest?: boolean | null }>,
  houses: ReadonlyArray<{ id: string; name: string }>,
  year: string,
): InterestYear {
  const cents = new Map<string, { cents: number; count: number }>()
  for (const inv of invoices) {
    if (!inv.is_interest || !(inv.invoice_date ?? '').startsWith(`${year}-`)) continue
    const row = cents.get(inv.supply_house_id) ?? { cents: 0, count: 0 }
    row.cents += Math.round(Number(inv.amount ?? 0) * 100)
    row.count += 1
    cents.set(inv.supply_house_id, row)
  }
  const nameOf = new Map(houses.map((h) => [h.id, h.name]))
  const rows = [...cents.entries()]
    .map(([supplyHouseId, r]) => ({ supplyHouseId, name: nameOf.get(supplyHouseId)?.trim() || 'A supply house', amount: r.cents / 100, count: r.count }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  const total = rows.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100
  const words = rows.length === 0 ? '' : rows.length === 1 ? `Interest and late fees in ${year}: ${usd(total)} at ${rows[0]?.name}` : `Interest and late fees in ${year}: ${usd(total)} · ${rows.map((r) => `${r.name} ${usd(r.amount)}`).join(' · ')}`
  return { year, total, houses: rows, words }
}
