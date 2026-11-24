import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addressesOnFile, type AddressOnFile, type AddressRow } from '../lib/addresses/addressesOnFile'

/**
 * The addresses the company already has, for the job form's address box (punch list #439, piece 1). One read of
 * every job's and every bid's address with its development, shared by every box on the page and kept for a
 * minute, so opening a second job does not ask again. Row security decides what the reader sees.
 *
 * It is a hint, never a gate: a read that fails answers an empty list and the box works as it did before, the
 * way Google's suggestions degrade (`useAddressSuggestions`).
 */
type Read = { rows: AddressRow[]; developments: Map<string, string> }

const FRESH_MS = 60_000
const PAGE = 1000
const NOTHING: Read = { rows: [], developments: new Map() }

let kept: { at: number; read: Read } | null = null
let reading: Promise<Read> | null = null

type Page = { data: unknown; error: unknown }

/** Every row of a table, a thousand at a time, since one read answers a thousand at most. */
async function everyRow(table: 'jobs_ledger' | 'bids' | 'developments', select: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = (await supabase
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)) as Page
    if (error) throw error
    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

async function readAddresses(): Promise<Read> {
  const [jobs, bids, developments] = await Promise.all([
    everyRow('jobs_ledger', 'id, job_address, development_id'),
    everyRow('bids', 'id, address, development_id'),
    everyRow('developments', 'id, name'),
  ])
  const rows: AddressRow[] = []
  for (const j of jobs) if (typeof j.id === 'string') rows.push({ kind: 'job', id: j.id, address: text(j.job_address), developmentId: text(j.development_id) })
  for (const b of bids) if (typeof b.id === 'string') rows.push({ kind: 'bid', id: b.id, address: text(b.address), developmentId: text(b.development_id) })
  const names = new Map<string, string>()
  for (const d of developments) {
    const name = text(d.name)
    if (typeof d.id === 'string' && name) names.set(d.id, name)
  }
  return { rows, developments: names }
}

/** The shared read: the kept one while it is fresh, else one new read however many boxes ask at once. */
function addressesRead(): Promise<Read> {
  if (kept && Date.now() - kept.at < FRESH_MS) return Promise.resolve(kept.read)
  if (!reading) {
    reading = readAddresses()
      .then((read) => {
        kept = { at: Date.now(), read }
        return read
      })
      .catch(() => NOTHING)
      .finally(() => {
        reading = null
      })
  }
  return reading
}

/** Forget the kept read. For tests, and for a caller that just saved an address. */
export function forgetAddressesOnFile(): void {
  kept = null
  reading = null
}

/**
 * The addresses on file, once `enabled` is true. `except` is the job being edited, left out of its own count.
 * Until the read lands, and when it fails, the list is empty.
 */
export function useAddressesOnFile(enabled: boolean, except?: { kind: 'job' | 'bid'; id: string } | null): AddressOnFile[] {
  const [read, setRead] = useState<Read>(kept?.read ?? NOTHING)
  useEffect(() => {
    if (!enabled) return
    let live = true
    void addressesRead().then((r) => {
      // A read that failed or found nothing leaves the empty list as it is: no draw for nothing.
      if (live && r !== NOTHING) setRead(r)
    })
    return () => {
      live = false
    }
  }, [enabled])
  const exceptKind = except?.kind ?? null
  const exceptId = except?.id ?? null
  return useMemo(
    () => addressesOnFile(read.rows, read.developments, exceptKind && exceptId ? { kind: exceptKind, id: exceptId } : null),
    [read, exceptKind, exceptId],
  )
}
