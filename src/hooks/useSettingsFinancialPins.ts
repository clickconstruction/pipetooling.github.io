import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getUsersWithPin } from '../lib/pinnedTabs'
import { fetchSubLaborDueTotal } from './useSubLaborDueTotal'
import { useWeeklyTeamLaborTotal } from './useWeeklyTeamLaborTotal'

type PinMessage = { type: 'success' | 'error'; text: string } | null

/**
 * Settings → Dashboard & alerts → dev-only financial-pins cluster: Billed /
 * Supply-Houses AP / External Team / Cost Matrix pin rosters + their totals.
 * Extracted verbatim from Settings.tsx (v2.858); loads on mount when `enabled`
 * (dev). Pin add/remove writes stay in SettingsDashboardTab (map quirk #8) —
 * this hook owns the loaders and the state the tab reads/writes via setters.
 */
export function useSettingsFinancialPins(enabled: boolean) {
  const [financialPinsSectionOpen, setFinancialPinsSectionOpen] = useState(false)
  const [pinBilledMasterIds, setPinBilledMasterIds] = useState<Set<string>>(new Set())
  const [pinBilledSaving, setPinBilledSaving] = useState(false)
  const [pinBilledUnpinSaving, setPinBilledUnpinSaving] = useState(false)
  const [pinBilledMessage, setPinBilledMessage] = useState<PinMessage>(null)
  const [billedCount, setBilledCount] = useState<number | null>(null)
  const [billedTotal, setBilledTotal] = useState<number | null>(null)
  const [pinAPMasterIds, setPinAPMasterIds] = useState<Set<string>>(new Set())
  const [pinAPSaving, setPinAPSaving] = useState(false)
  const [pinAPUnpinSaving, setPinAPUnpinSaving] = useState(false)
  const [pinAPMessage, setPinAPMessage] = useState<PinMessage>(null)
  const [apTotal, setApTotal] = useState<number | null>(null)
  const [pinExternalTeamMasterIds, setPinExternalTeamMasterIds] = useState<Set<string>>(new Set())
  const [pinExternalTeamSaving, setPinExternalTeamSaving] = useState(false)
  const [pinExternalTeamUnpinSaving, setPinExternalTeamUnpinSaving] = useState(false)
  const [pinExternalTeamMessage, setPinExternalTeamMessage] = useState<PinMessage>(null)
  const [externalTeamTotal, setExternalTeamTotal] = useState<number | null>(null)
  const [pinCostMatrixMasterIds, setPinCostMatrixMasterIds] = useState<Set<string>>(new Set())
  const [pinCostMatrixSaving, setPinCostMatrixSaving] = useState(false)
  const [pinCostMatrixUnpinSaving, setPinCostMatrixUnpinSaving] = useState(false)
  const [pinCostMatrixMessage, setPinCostMatrixMessage] = useState<PinMessage>(null)

  const { total: costMatrixTotal } = useWeeklyTeamLaborTotal(enabled)

  async function loadBilledTotalAndPinnedUsers() {
    if (!enabled) return
    const [jobsRes, invoicesRes, pinnedRes] = await Promise.all([
      supabase.from('jobs_ledger').select('revenue, payments_made').eq('status', 'billed'),
      supabase.from('jobs_ledger_invoices').select('amount').eq('status', 'billed'),
      getUsersWithPin('/jobs', 'billed'),
    ])
    const jobs = (jobsRes.data ?? []) as Array<{ revenue: number | null; payments_made: number | null }>
    const invoices = (invoicesRes.data ?? []) as Array<{ amount: number }>
    const jobsTotal = jobs.reduce((s, j) => s + (Number(j.revenue ?? 0) - Number(j.payments_made ?? 0)), 0)
    const invoicesTotal = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0)
    setBilledCount(jobs.length + invoices.length)
    setBilledTotal(jobsTotal + invoicesTotal)
    setPinBilledMasterIds(new Set(pinnedRes.map((r) => r.user_id)))
  }

  async function loadSupplyHousesAPTotalAndPinnedUsers() {
    if (!enabled) return
    const [invoicesRes, pinnedRes] = await Promise.all([
      supabase.from('supply_house_invoices').select('amount, is_paid').eq('is_paid', false),
      getUsersWithPin('/materials', 'supply-houses'),
    ])
    const total = (invoicesRes.data ?? []).reduce((sum, r) => sum + Number((r as { amount: number }).amount ?? 0), 0)
    setApTotal(total)
    setPinAPMasterIds(new Set(pinnedRes.map((r) => r.user_id)))
  }

  async function loadExternalTeamTotalAndPinnedUsers() {
    if (!enabled) return
    const [subLaborTotal, pinnedRes] = await Promise.all([
      fetchSubLaborDueTotal(),
      getUsersWithPin('/jobs', 'sub_sheet_ledger'),
    ])
    setExternalTeamTotal(subLaborTotal)
    setPinExternalTeamMasterIds(new Set(pinnedRes.map((r) => r.user_id)))
  }

  async function loadCostMatrixPinnedUsers() {
    if (!enabled) return
    const rows = await getUsersWithPin('/people', 'hours')
    setPinCostMatrixMasterIds(new Set(rows.map((r) => r.user_id)))
  }

  useEffect(() => {
    if (enabled) {
      loadBilledTotalAndPinnedUsers()
      loadSupplyHousesAPTotalAndPinnedUsers()
      loadExternalTeamTotalAndPinnedUsers()
      loadCostMatrixPinnedUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return {
    financialPinsSectionOpen,
    setFinancialPinsSectionOpen,
    pinBilledMasterIds,
    setPinBilledMasterIds,
    pinBilledSaving,
    setPinBilledSaving,
    pinBilledUnpinSaving,
    setPinBilledUnpinSaving,
    pinBilledMessage,
    setPinBilledMessage,
    billedCount,
    billedTotal,
    pinAPMasterIds,
    setPinAPMasterIds,
    pinAPSaving,
    setPinAPSaving,
    pinAPUnpinSaving,
    setPinAPUnpinSaving,
    pinAPMessage,
    setPinAPMessage,
    apTotal,
    pinExternalTeamMasterIds,
    setPinExternalTeamMasterIds,
    pinExternalTeamSaving,
    setPinExternalTeamSaving,
    pinExternalTeamUnpinSaving,
    setPinExternalTeamUnpinSaving,
    pinExternalTeamMessage,
    setPinExternalTeamMessage,
    externalTeamTotal,
    pinCostMatrixMasterIds,
    setPinCostMatrixMasterIds,
    pinCostMatrixSaving,
    setPinCostMatrixSaving,
    pinCostMatrixUnpinSaving,
    setPinCostMatrixUnpinSaving,
    pinCostMatrixMessage,
    setPinCostMatrixMessage,
    costMatrixTotal,
    loadBilledTotalAndPinnedUsers,
    loadSupplyHousesAPTotalAndPinnedUsers,
    loadExternalTeamTotalAndPinnedUsers,
    loadCostMatrixPinnedUsers,
  }
}
