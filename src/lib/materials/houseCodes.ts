/**
 * House numbers: what each supply house calls a part (punch list #308, PR 2; table `supply_part_codes`).
 *
 * A house prints its own number for a part on every quote and bill. Kept against the part once, it is
 * the surest key the matcher has (`matchRow` in partMatch.ts): the next paper from that house finds
 * the part with no press. This file is the table's pure rules and its reads and writes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatErrorMessage } from '../../utils/errorHandling'
import { foldCode, type HouseCode } from './partMatch'

export type HouseCodeRow = {
  id: string
  supply_house_id: string
  code: string
  code_key: string
  part_id: string | null
  not_a_part: boolean
  unit_factor: number
  taught_from: string
}

export const HOUSE_CODE_SELECT = 'id,supply_house_id,code,code_key,part_id,not_a_part,unit_factor,taught_from'

/** The table's rows as the matcher reads them. */
export function toHouseCodes(rows: HouseCodeRow[]): HouseCode[] {
  return rows.map((r) => ({ supplyHouseId: r.supply_house_id, code: r.code, partId: r.part_id, notAPart: r.not_a_part, unitFactor: Number(r.unit_factor) || 1 }))
}

export type PartNumberRow = { supplyHouseId: string; houseName: string; priced: boolean; codes: HouseCodeRow[] }

/**
 * A part's *Their numbers* rows: each house that prices the part, then each other house that has a
 * number for it, by name.
 */
export function partNumberRows(
  houses: { id: string; name: string }[],
  pricedHouseIds: string[],
  codes: HouseCodeRow[],
): PartNumberRow[] {
  const priced = new Set(pricedHouseIds)
  const byHouse = new Map<string, HouseCodeRow[]>()
  for (const c of codes) {
    const list = byHouse.get(c.supply_house_id)
    if (list) list.push(c)
    else byHouse.set(c.supply_house_id, [c])
  }
  const rows: PartNumberRow[] = []
  for (const h of houses) {
    if (!priced.has(h.id) && !byHouse.has(h.id)) continue
    rows.push({ supplyHouseId: h.id, houseName: h.name, priced: priced.has(h.id), codes: (byHouse.get(h.id) ?? []).sort((a, b) => a.code.localeCompare(b.code)) })
  }
  return rows.sort((a, b) => Number(b.priced) - Number(a.priced) || a.houseName.localeCompare(b.houseName))
}

/**
 * Why a typed number cannot be kept for this part at this house, in words, or null when it can.
 * `houseCodes` is every number on file at that house.
 */
export function numberProblem(
  typed: string,
  partId: string,
  houseName: string,
  houseCodes: HouseCodeRow[],
  partName: (id: string) => string | null,
): string | null {
  const key = foldCode(typed)
  if (!typed.trim()) return 'Type the number as the house prints it.'
  if (!key) return 'A number needs a letter or a digit.'
  const hit = houseCodes.find((c) => c.code_key === key)
  if (!hit) return null
  if (hit.not_a_part) return `${houseName} uses ${hit.code} for anything it does not stock, so it is not kept on a part.`
  if (hit.part_id === partId) return `${hit.code} is already kept for this part.`
  const other = hit.part_id ? partName(hit.part_id) : null
  return `${houseName} already uses ${hit.code} for ${other ?? 'another part'}.`
}

export type NumberOffer = { partId: string; partName: string; supplyHouseId: string; code: string; from: 'name' | 'notes' }
export type NumberHold = { partId: string; partName: string; code: string; why: string }

// A house's number written at the head of a name: 512207 AX8802XL-LR-PC ARLO SUPPLY KIT.
const LEADING_NUMBER = /^\s*(\d{4,9})\s+\S/
// A note that is one number and nothing else.
const NOTE_IS_A_NUMBER = /^\s*(\d{4,9})\s*$/

/**
 * The numbers people already wrote into part names and notes, offered as house numbers. A number is
 * offered only when exactly one house prices the part, since that is the house the number came from.
 * The rest are held with the reason. A number already on file is passed over without a word.
 */
export function houseNumberOffers(
  parts: { id: string; name: string; notes?: string | null }[],
  pricedHousesByPart: Map<string, string[]>,
  codes: HouseCodeRow[],
): { offers: NumberOffer[]; held: NumberHold[] } {
  const onFile = new Set(codes.map((c) => `${c.supply_house_id}|${c.code_key}`))
  const found: { partId: string; partName: string; code: string; from: 'name' | 'notes' }[] = []
  for (const p of parts) {
    const inName = LEADING_NUMBER.exec(p.name)
    const inNotes = NOTE_IS_A_NUMBER.exec(p.notes ?? '')
    if (inName) found.push({ partId: p.id, partName: p.name, code: inName[1]!, from: 'name' })
    else if (inNotes) found.push({ partId: p.id, partName: p.name, code: inNotes[1]!, from: 'notes' })
  }
  const offers: NumberOffer[] = []
  const held: NumberHold[] = []
  const claimed = new Map<string, string>()
  for (const f of found) {
    const houses = [...new Set(pricedHousesByPart.get(f.partId) ?? [])]
    if (houses.length === 0) {
      held.push({ partId: f.partId, partName: f.partName, code: f.code, why: 'No house prices this part, so the number has no house.' })
      continue
    }
    if (houses.length > 1) {
      held.push({ partId: f.partId, partName: f.partName, code: f.code, why: `${houses.length} houses price this part, so the number could be any of theirs.` })
      continue
    }
    const key = `${houses[0]}|${foldCode(f.code)}`
    if (onFile.has(key)) continue
    const other = claimed.get(key)
    if (other && other !== f.partId) {
      held.push({ partId: f.partId, partName: f.partName, code: f.code, why: 'Another part carries the same number at that house.' })
      continue
    }
    claimed.set(key, f.partId)
    offers.push({ partId: f.partId, partName: f.partName, supplyHouseId: houses[0]!, code: f.code, from: f.from })
  }
  offers.sort((a, b) => a.partName.localeCompare(b.partName))
  held.sort((a, b) => a.partName.localeCompare(b.partName))
  return { offers, held }
}

// ---------- reads and writes ----------

// The table is not in the generated types until the types PR that follows its push.
type Db = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

type PgError = { code?: string | null; message?: string | null } | null | undefined

/** The table is not on the database yet: the client merged before the migration was pushed. */
export function isNotLiveYet(e: PgError): boolean {
  return e != null && (e.code === '42P01' || e.code === 'PGRST205' || /could not find the table|relation .* does not exist/i.test(e.message ?? ''))
}

export type HouseCodesRead = { live: boolean; rows: HouseCodeRow[]; error: string | null }

/** Every number on file, or one part's, or one house's. `live` is false until the table exists. */
export async function loadHouseCodes(supabase: Db, filter: { partId?: string; supplyHouseId?: string } = {}): Promise<HouseCodesRead> {
  const rows: HouseCodeRow[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('supply_part_codes').select(HOUSE_CODE_SELECT).order('id', { ascending: true }).range(from, from + 999)
    if (filter.partId) q = q.eq('part_id', filter.partId)
    if (filter.supplyHouseId) q = q.eq('supply_house_id', filter.supplyHouseId)
    const { data, error } = await q
    if (error) return isNotLiveYet(error) ? { live: false, rows: [], error: null } : { live: true, rows: [], error: formatErrorMessage(error, 'The house numbers could not be read') }
    const page = (data ?? []) as unknown as HouseCodeRow[]
    rows.push(...page.map((r) => ({ ...r, unit_factor: Number(r.unit_factor) })))
    if (page.length < 1000) break
  }
  return { live: true, rows, error: null }
}

export type KeepHouseCodeInput = {
  supplyHouseId: string
  code: string
  partId: string | null
  notAPart?: boolean
  unitFactor?: number
  taughtFrom?: 'typed' | 'name' | 'notes' | 'sheet' | 'bill'
  taughtLineId?: string | null
}

/** Keep one number. A number already on file for another part at that house is refused by the table. */
export async function keepHouseCode(supabase: Db, input: KeepHouseCodeInput): Promise<{ row: HouseCodeRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('supply_part_codes')
    .insert({
      supply_house_id: input.supplyHouseId,
      code: input.code.trim(),
      part_id: input.notAPart ? null : input.partId,
      not_a_part: input.notAPart === true,
      unit_factor: input.unitFactor ?? 1,
      taught_from: input.taughtFrom ?? 'typed',
      taught_line_id: input.taughtLineId ?? null,
    })
    .select(HOUSE_CODE_SELECT)
    .single()
  if (error) {
    const taken = (error as { code?: string }).code === '23505'
    return { row: null, error: taken ? 'That house already uses this number for another part.' : formatErrorMessage(error, 'The number could not be kept') }
  }
  const row = data as unknown as HouseCodeRow
  return { row: { ...row, unit_factor: Number(row.unit_factor) }, error: null }
}

export async function removeHouseCode(supabase: Db, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('supply_part_codes').delete().eq('id', id)
  return { error: error ? formatErrorMessage(error, 'The number could not be taken off') : null }
}
