import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadCardChargeExclusions } from '../lib/jobs/loadCardChargeExclusions'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../lib/jobs/cardChargeAllocationFilter'
import { DRIVE_SETTING_KEYS } from '../../supabase/functions/_shared/jobSubLaborInputs'
import { jobCostsFromRows, type SiteCostRows, type SiteCostsRead } from '../lib/developments/siteCosts'

/**
 * The costs on a site's jobs for the Development page's Jobs & bids table (v2.6215): one batched read
 * per source for every job on the page — the invoice amounts RPC, the supply-house and card
 * allocations, the card rule's exclusions, the tally, the jobs' other charges, the sub-labor sheets
 * and their items, the drive settings — never one round per job. `enabled` false (a role that does
 * not read costs, or no jobs) reads nothing and gives `undefined`; while reading, `null`.
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
        const [inv, supply, card, tally, other, sheets, settings] = await Promise.all([
          supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: ids }),
          supabase.from('supply_house_invoice_job_allocations').select('job_id, pct, supply_house_invoices(invoice_number, invoice_date, amount, is_paid, on_job_account, supply_houses(name))').in('job_id', ids).limit(2000),
          supabase.from('mercury_transaction_job_allocations').select('job_id, id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, amount, raw)').in('job_id', ids).order('created_at', { ascending: true }).limit(2000),
          supabase.rpc('list_tally_parts_with_po'),
          supabase.from('jobs_ledger_materials').select('job_id, amount').in('job_id', ids).limit(2000),
          supabase.from('people_labor_jobs').select('id, job_ledger_id, job_number, labor_rate, distance_miles').in('job_ledger_id', ids).limit(500),
          supabase.from('app_settings').select('key, value_num').in('key', [...DRIVE_SETTING_KEYS]),
        ])
        for (const r of [inv, supply, card, tally, other, sheets]) if (r.error) throw r.error
        const sheetRows = (sheets.data ?? []) as SiteCostRows['sheets']
        const items = sheetRows.length
          ? await supabase.from('people_labor_job_items').select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', sheetRows.map((s) => s.id)).limit(5000)
          : { data: [], error: null }
        if (items.error) throw items.error
        const cardAlloc = (card.data ?? []) as unknown as SiteCostRows['cardAlloc']
        const txIds = [...new Set(cardAlloc.map((l) => l.mercury_transaction_id).filter((id): id is string => !!id))]
        let cardExclusions = EMPTY_CARD_CHARGE_EXCLUSIONS
        try {
          cardExclusions = await loadCardChargeExclusions(txIds)
        } catch {
          cardExclusions = EMPTY_CARD_CHARGE_EXCLUSIONS
        }
        const map = jobCostsFromRows({
          jobIds: ids,
          invoiceAmounts: (inv.data ?? []) as SiteCostRows['invoiceAmounts'],
          cardAlloc,
          cardExclusions,
          tally: (tally.data ?? []) as unknown as SiteCostRows['tally'],
          otherCharges: (other.data ?? []) as SiteCostRows['otherCharges'],
          sheets: sheetRows,
          items: (items.data ?? []) as unknown as SiteCostRows['items'],
          settings: settings.error ? [] : ((settings.data ?? []) as SiteCostRows['settings']),
        })
        if (!cancelled) setState({ key, read: { state: 'read', byJobId: map } })
      } catch {
        // A cost source that will not read: the cells say so, never a false zero; the table stands without them.
        if (!cancelled) setState({ key, read: { state: 'failed' } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  if (!key) return undefined
  return state && state.key === key ? state.read : { state: 'reading' }
}
