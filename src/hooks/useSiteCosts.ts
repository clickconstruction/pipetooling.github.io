import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { loadCardChargeExclusions } from '../lib/jobs/loadCardChargeExclusions'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../lib/jobs/cardChargeAllocationFilter'
import { DRIVE_SETTING_KEYS } from '../../supabase/functions/_shared/jobSubLaborInputs'
import { formatErrorMessage } from '../utils/errorHandling'
import { jobCostsFromRows, type SiteCostRows, type SiteCostsRead } from '../lib/developments/siteCosts'

/**
 * The costs on a site's jobs for the Development page's Jobs & bids table (v2.6215): one batched read
 * per source for every job on the page — the invoice amounts RPC, the supply-house and card
 * allocations, the card rule's exclusions, the tally, the jobs' other charges, the sub-labor sheets
 * and their items, the drive settings — never one round per job. Every row-by-job read pages
 * (v2.6463): PostgREST cuts an unpaged answer at 1,000 rows, and a busy site's card lines near that.
 * `enabled` false (a role that does not read costs, or no jobs) reads nothing and gives `undefined`;
 * while reading, `null`.
 */
export function useSiteCosts(jobIds: ReadonlyArray<string>, enabled: boolean): SiteCostsRead | undefined {
  const key = useMemo(() => (enabled && jobIds.length ? [...jobIds].sort().join(',') : ''), [jobIds, enabled])
  const [state, setState] = useState<{ key: string; read: SiteCostsRead } | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    void (async () => {
      const ids = key.split(',')
      try {
        const paged = { parallel: 3 }
        const [inv, supply, card, tally, other, sheets, settings] = await Promise.all([
          supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: ids }),
          // One allocation per invoice on a job: job and invoice order the pages (the table has no id of its own).
          fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('supply_house_invoice_job_allocations').select('job_id, invoice_id, pct, supply_house_invoices(invoice_number, invoice_date, amount, is_paid, on_job_account, supply_houses(name))').in('job_id', chunk).order('job_id').order('invoice_id').range(from, to), 'site supply allocations', paged),
          // No `raw` on the embed: the totals never read it (the card id it carries is the Job window's display), and on a large site the raw payloads were 1.5 MB of the page's read (the Gray Fox spike, 2026-11-02).
          // `mercury_category` (v2.6493): the bank's own category, the fuel split's fallback when nobody has labelled the charge, for the Timeline's ⛽ stream.
          fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('mercury_transaction_job_allocations').select('job_id, id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, amount, mercury_category)').in('job_id', chunk).order('id').range(from, to), 'site card lines', paged),
          supabase.rpc('list_tally_parts_with_po'),
          fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('jobs_ledger_materials').select('id, job_id, amount, created_at, description').in('job_id', chunk).order('id').range(from, to), 'site other charges', paged),
          fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('people_labor_jobs').select('id, job_ledger_id, job_number, labor_rate, distance_miles, assigned_to_name, job_date, created_at').in('job_ledger_id', chunk).order('id').range(from, to), 'site sub sheets', paged),
          supabase.from('app_settings').select('key, value_num').in('key', [...DRIVE_SETTING_KEYS]),
        ])
        for (const r of [inv, tally]) if (r.error) throw r.error
        const sheetRows = sheets as unknown as SiteCostRows['sheets']
        const items = sheetRows.length
          ? await fetchAllRowsChunkedIn(sheetRows.map((s) => s.id), (chunk, from, to) => supabase.from('people_labor_job_items').select('id, job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', chunk).order('id').range(from, to), 'site sheet items', paged)
          : []
        const cardAlloc = card as unknown as SiteCostRows['cardAlloc']
        const txIds = [...new Set(cardAlloc.map((l) => l.mercury_transaction_id).filter((id): id is string => !!id))]
        let cardExclusions = EMPTY_CARD_CHARGE_EXCLUSIONS
        try {
          cardExclusions = await loadCardChargeExclusions(txIds)
        } catch {
          cardExclusions = EMPTY_CARD_CHARGE_EXCLUSIONS
        }
        const rows: SiteCostRows = {
          jobIds: ids,
          invoiceAmounts: (inv.data ?? []) as SiteCostRows['invoiceAmounts'],
          cardAlloc,
          cardExclusions,
          tally: (tally.data ?? []) as unknown as SiteCostRows['tally'],
          otherCharges: other as unknown as SiteCostRows['otherCharges'],
          sheets: sheetRows,
          items: items as unknown as SiteCostRows['items'],
          settings: settings.error ? [] : ((settings.data ?? []) as SiteCostRows['settings']),
          // The allocations with their house, for the Scoreboard's supply rows (v2.6457); the total still reads the RPC.
          supplyAlloc: supply as unknown as NonNullable<SiteCostRows['supplyAlloc']>,
        }
        // The rows ride with the totals (v2.6493): the Money look's Timeline draws its events from them, so it ends on the column's figure.
        if (!cancelled) setState({ key, read: { state: 'read', byJobId: jobCostsFromRows(rows), rows } })
      } catch (e) {
        // A cost source that will not read: the cells say so, never a false zero; the table stands without them.
        if (!cancelled) setState({ key, read: { state: 'failed', reason: formatErrorMessage(e, 'the read did not finish') } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  if (!key) return undefined
  return state && state.key === key ? state.read : { state: 'reading' }
}
