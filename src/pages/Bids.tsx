import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { addExpandedPartsToPO, expandTemplate } from '../lib/materialPOUtils'
import { useAuth } from '../hooks/useAuth'
import NewCustomerForm from '../components/NewCustomerForm'
import { Database } from '../types/database'
import type { Json } from '../types/database'

type GcBuilder = Database['public']['Tables']['bids_gc_builders']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type Bid = Database['public']['Tables']['bids']['Row']
type BidCountRow = Database['public']['Tables']['bids_count_rows']['Row']
type BidSubmissionEntry = Database['public']['Tables']['bids_submission_entries']['Row']
type MaterialTemplate = Database['public']['Tables']['material_templates']['Row']
type CostEstimate = Database['public']['Tables']['cost_estimates']['Row']
type CostEstimateLaborRow = Database['public']['Tables']['cost_estimate_labor_rows']['Row']
type FixtureLaborDefault = Database['public']['Tables']['fixture_labor_defaults']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator'

type TakeoffMapping = { id: string; countRowId: string; templateId: string; quantity: number }
type DraftPO = { id: string; name: string }
type CostEstimatePO = { id: string; name: string }

type EstimatorUser = { id: string; name: string | null; email: string }

type BidWithBuilder = Bid & { customers: Customer | null; bids_gc_builders: GcBuilder | null; estimator?: EstimatorUser | EstimatorUser[] | null }

function extractContactInfo(ci: Json | null): { phone: string; email: string } {
  if (ci == null) return { phone: '', email: '' }
  if (typeof ci === 'object' && ci !== null) {
    const obj = ci as Record<string, unknown>
    return {
      phone: typeof obj.phone === 'string' ? obj.phone : '',
      email: typeof obj.email === 'string' ? obj.email : '',
    }
  }
  return { phone: '', email: '' }
}

const tabStyle = (active: boolean) => ({
  padding: '0.75rem 1.5rem',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
})

function formatTimeSinceLastContact(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.floor((now - d) / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day !== 1 ? 's' : ''} ago`
  const week = Math.floor(day / 7)
  if (week < 4) return `${week} week${week !== 1 ? 's' : ''} ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} month${mo !== 1 ? 's' : ''} ago`
  return `${Math.floor(mo / 12)} year${Math.floor(mo / 12) !== 1 ? 's' : ''} ago`
}

function formatTimeSinceDueDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const due = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} since deadline`
  if (diffDays === 0) return 'Due today'
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} until due`
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}`
}

function formatDateYYMMDD(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  const y = d.getFullYear() % 100
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

function formatCompactCurrency(n: number | null): string {
  if (n == null) return '—'
  const k = n / 1000
  if (k % 1 === 0) return `$${k}k`
  return `$${k.toFixed(1)}k`
}

function bidDisplayName(b: Bid): string {
  return [b.project_name, b.address].filter(Boolean).join(' – ') || ''
}

export default function Bids() {
  const { user: authUser } = useAuth()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bid-board' | 'counts' | 'takeoffs' | 'cost-estimate' | 'cover-letter' | 'submission-followup'>('bid-board')

  const [bids, setBids] = useState<BidWithBuilder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [lastContactFromEntries, setLastContactFromEntries] = useState<Record<string, string>>({})

  // Bid Board
  const [bidBoardSearchQuery, setBidBoardSearchQuery] = useState('')
  const [bidBoardHideLost, setBidBoardHideLost] = useState(false)
  const [bidFormOpen, setBidFormOpen] = useState(false)
  const [editingBid, setEditingBid] = useState<BidWithBuilder | null>(null)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [viewingGcBuilder, setViewingGcBuilder] = useState<GcBuilder | null>(null)
  const [savingBid, setSavingBid] = useState(false)
  const [deleteConfirmProjectName, setDeleteConfirmProjectName] = useState('')
  const [deletingBid, setDeletingBid] = useState(false)
  const [deleteBidModalOpen, setDeleteBidModalOpen] = useState(false)
  const [gcCustomerId, setGcCustomerId] = useState('')
  const [gcCustomerSearch, setGcCustomerSearch] = useState('')
  const [gcCustomerDropdownOpen, setGcCustomerDropdownOpen] = useState(false)
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false)

  const [driveLink, setDriveLink] = useState('')
  const [plansLink, setPlansLink] = useState('')
  const [projectName, setProjectName] = useState('')
  const [address, setAddress] = useState('')
  const [gcContactName, setGcContactName] = useState('')
  const [gcContactPhone, setGcContactPhone] = useState('')
  const [gcContactEmail, setGcContactEmail] = useState('')
  const [estimatorId, setEstimatorId] = useState('')
  const [estimatorUsers, setEstimatorUsers] = useState<EstimatorUser[]>([])
  const [bidDueDate, setBidDueDate] = useState('')
  const [estimatedJobStartDate, setEstimatedJobStartDate] = useState('')
  const [bidDateSent, setBidDateSent] = useState('')
  const [outcome, setOutcome] = useState<'won' | 'lost' | ''>('')
  const [bidValue, setBidValue] = useState('')
  const [agreedValue, setAgreedValue] = useState('')
  const [profit, setProfit] = useState('')
  const [distanceFromOffice, setDistanceFromOffice] = useState('')
  const [lastContact, setLastContact] = useState('')
  const [notes, setNotes] = useState('')
  const [notesModalBid, setNotesModalBid] = useState<BidWithBuilder | null>(null)
  const [notesModalText, setNotesModalText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Counts tab
  const [countsSearchQuery, setCountsSearchQuery] = useState('')
  const [selectedBidForCounts, setSelectedBidForCounts] = useState<BidWithBuilder | null>(null)
  const [countRows, setCountRows] = useState<BidCountRow[]>([])
  const [addingCountRow, setAddingCountRow] = useState(false)

  // Submission & Followup tab
  const [submissionSearchQuery, setSubmissionSearchQuery] = useState('')
  const [selectedBidForSubmission, setSelectedBidForSubmission] = useState<BidWithBuilder | null>(null)
  const [submissionEntries, setSubmissionEntries] = useState<BidSubmissionEntry[]>([])
  const [addingSubmissionEntry, setAddingSubmissionEntry] = useState(false)
  const [submissionSectionOpen, setSubmissionSectionOpen] = useState({ unsent: true, pending: true, won: true, lost: false })
  const [, setTick] = useState(0)

  // Takeoffs tab
  const [takeoffSearchQuery, setTakeoffSearchQuery] = useState('')
  const [selectedBidForTakeoff, setSelectedBidForTakeoff] = useState<BidWithBuilder | null>(null)
  const [takeoffCountRows, setTakeoffCountRows] = useState<BidCountRow[]>([])
  const [takeoffMappings, setTakeoffMappings] = useState<TakeoffMapping[]>([])
  const [materialTemplates, setMaterialTemplates] = useState<MaterialTemplate[]>([])
  const [draftPOs, setDraftPOs] = useState<DraftPO[]>([])
  const [takeoffExistingPOId, setTakeoffExistingPOId] = useState('')
  const [takeoffCreatingPO, setTakeoffCreatingPO] = useState(false)
  const [takeoffAddingToPO, setTakeoffAddingToPO] = useState(false)
  const [takeoffSuccessMessage, setTakeoffSuccessMessage] = useState<string | null>(null)
  const [takeoffTemplateSearch, setTakeoffTemplateSearch] = useState('')
  const [takeoffCreatedPOId, setTakeoffCreatedPOId] = useState<string | null>(null)

  // Cost Estimate tab
  const [costEstimateSearchQuery, setCostEstimateSearchQuery] = useState('')
  const [selectedBidForCostEstimate, setSelectedBidForCostEstimate] = useState<BidWithBuilder | null>(null)
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [costEstimateLaborRows, setCostEstimateLaborRows] = useState<CostEstimateLaborRow[]>([])
  const [costEstimateCountRows, setCostEstimateCountRows] = useState<BidCountRow[]>([])
  const [purchaseOrdersForCostEstimate, setPurchaseOrdersForCostEstimate] = useState<CostEstimatePO[]>([])
  const [costEstimateMaterialTotalRoughIn, setCostEstimateMaterialTotalRoughIn] = useState<number | null>(null)
  const [costEstimateMaterialTotalTopOut, setCostEstimateMaterialTotalTopOut] = useState<number | null>(null)
  const [costEstimateMaterialTotalTrimSet, setCostEstimateMaterialTotalTrimSet] = useState<number | null>(null)
  const [laborRateInput, setLaborRateInput] = useState('')
  const [savingCostEstimate, setSavingCostEstimate] = useState(false)

  function toggleSubmissionSection(key: 'unsent' | 'pending' | 'won' | 'lost') {
    setSubmissionSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    if (activeTab !== 'submission-followup') return
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [activeTab])

  async function loadRole() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole } | null)?.role ?? null
    setMyRole(role)
    if (role !== 'dev' && role !== 'master_technician' && role !== 'assistant' && role !== 'estimator') {
      setLoading(false)
      return
    }
  }

  async function loadEstimatorUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'estimator')
      .order('name', { ascending: true, nullsFirst: false })
    if (error) return
    setEstimatorUsers((data as EstimatorUser[]) ?? [])
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, address, master_user_id')
      .order('name')
    if (error) {
      setError(`Failed to load customers: ${error.message}`)
      return
    }
    setCustomers((data as Customer[]) ?? [])
  }

  async function loadBids(): Promise<BidWithBuilder[]> {
    const { data, error } = await supabase
      .from('bids')
      .select('*, customers(*), bids_gc_builders(*), estimator:users!bids_estimator_id_fkey(id, name, email)')
      .order('bid_due_date', { ascending: false, nullsFirst: false })
    if (error) {
      setError(`Failed to load bids: ${error.message}`)
      return []
    }
    type Raw = Bid & { customers: Customer | Customer[] | null; bids_gc_builders: GcBuilder | GcBuilder[] | null; estimator?: EstimatorUser | EstimatorUser[] | null }
    const raw = (data as Raw[]) ?? []
    const rows: BidWithBuilder[] = raw.map((b) => {
      const est = b.estimator
      const estimatorNorm = est == null ? null : Array.isArray(est) ? est[0] ?? null : est
      return {
        ...b,
        customers: Array.isArray(b.customers) ? b.customers[0] ?? null : b.customers,
        bids_gc_builders: Array.isArray(b.bids_gc_builders) ? b.bids_gc_builders[0] ?? null : b.bids_gc_builders,
        estimator: estimatorNorm,
      }
    })
    setBids(rows)
    const { data: entriesData } = await supabase
      .from('bids_submission_entries')
      .select('bid_id, occurred_at')
    const latestByBid: Record<string, string> = {}
    for (const row of entriesData ?? []) {
      const bidId = (row as { bid_id: string; occurred_at: string | null }).bid_id
      const at = (row as { bid_id: string; occurred_at: string | null }).occurred_at
      if (!at) continue
      const existing = latestByBid[bidId]
      if (!existing || new Date(at) > new Date(existing)) latestByBid[bidId] = at
    }
    setLastContactFromEntries(latestByBid)
    return rows
  }

  function getCustomerDisplay(c: Customer): string {
    if (c.address) return `${c.name} - ${c.address}`
    return c.name
  }

  async function loadCountRows(bidId: string) {
    const { data, error } = await supabase
      .from('bids_count_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      return
    }
    setCountRows((data as BidCountRow[]) ?? [])
  }

  function refreshAfterCountsChange() {
    const bidId = selectedBidForCounts?.id
    if (!bidId) return
    loadCountRows(bidId)
    if (selectedBidForTakeoff?.id === bidId) loadTakeoffCountRows(bidId)
    if (selectedBidForCostEstimate?.id === bidId) loadCostEstimateData(bidId)
  }

  async function loadSubmissionEntries(bidId: string) {
    const { data, error } = await supabase
      .from('bids_submission_entries')
      .select('*')
      .eq('bid_id', bidId)
      .order('occurred_at', { ascending: false })
    if (error) {
      setError(`Failed to load submission entries: ${error.message}`)
      return
    }
    setSubmissionEntries((data as BidSubmissionEntry[]) ?? [])
  }

  async function loadTakeoffCountRows(bidId: string) {
    const { data, error } = await supabase
      .from('bids_count_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      return
    }
    const rows = (data as BidCountRow[]) ?? []
    setTakeoffCountRows(rows)
    setTakeoffMappings(rows.map((row) => ({ id: crypto.randomUUID(), countRowId: row.id, templateId: '', quantity: Number(row.count) })))
  }

  async function loadMaterialTemplates() {
    const { data, error } = await supabase.from('material_templates').select('*').order('name', { ascending: true })
    if (error) {
      setError(`Failed to load templates: ${error.message}`)
      return
    }
    setMaterialTemplates((data as MaterialTemplate[]) ?? [])
  }

  async function loadDraftPOs() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, name')
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
    if (error) {
      setError(`Failed to load draft POs: ${error.message}`)
      return
    }
    setDraftPOs((data as DraftPO[]) ?? [])
  }

  async function loadPurchaseOrdersForCostEstimate() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, name')
      .order('updated_at', { ascending: false })
    if (error) {
      setError(`Failed to load purchase orders: ${error.message}`)
      return
    }
    setPurchaseOrdersForCostEstimate((data as CostEstimatePO[]) ?? [])
  }

  async function loadPOTotal(poId: string): Promise<number> {
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('price_at_time, quantity')
      .eq('purchase_order_id', poId)
    if (error) return 0
    const items = (data as { price_at_time: number; quantity: number }[]) ?? []
    return items.reduce((sum, i) => sum + Number(i.price_at_time) * Number(i.quantity), 0)
  }

  async function loadCostEstimate(bidId: string) {
    const { data: existing, error: e } = await supabase
      .from('cost_estimates')
      .select('*')
      .eq('bid_id', bidId)
      .maybeSingle()
    if (e) {
      setError(`Failed to load cost estimate: ${e.message}`)
      setCostEstimate(null)
      return null
    }
    const est = (existing as CostEstimate | null) ?? null
    setCostEstimate(est)
    if (est) {
      setLaborRateInput(est.labor_rate != null ? String(est.labor_rate) : '')
      const rough = est.purchase_order_id_rough_in ? await loadPOTotal(est.purchase_order_id_rough_in) : 0
      const top = est.purchase_order_id_top_out ? await loadPOTotal(est.purchase_order_id_top_out) : 0
      const trim = est.purchase_order_id_trim_set ? await loadPOTotal(est.purchase_order_id_trim_set) : 0
      setCostEstimateMaterialTotalRoughIn(est.purchase_order_id_rough_in ? rough : null)
      setCostEstimateMaterialTotalTopOut(est.purchase_order_id_top_out ? top : null)
      setCostEstimateMaterialTotalTrimSet(est.purchase_order_id_trim_set ? trim : null)
    } else {
      setLaborRateInput('')
      setCostEstimateMaterialTotalRoughIn(null)
      setCostEstimateMaterialTotalTopOut(null)
      setCostEstimateMaterialTotalTrimSet(null)
    }
    return est
  }

  async function loadCostEstimateCountRows(bidId: string) {
    const { data, error } = await supabase
      .from('bids_count_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      setCostEstimateCountRows([])
      return []
    }
    const rows = (data as BidCountRow[]) ?? []
    setCostEstimateCountRows(rows)
    return rows
  }

  async function loadFixtureLaborDefaults(): Promise<FixtureLaborDefault[]> {
    const { data, error } = await supabase.from('fixture_labor_defaults').select('*')
    if (error) return []
    return (data as FixtureLaborDefault[]) ?? []
  }

  async function loadCostEstimateLaborRowsAndSync(estimateId: string, countRows: BidCountRow[], defaults: FixtureLaborDefault[]) {
    const { data: laborData, error: laborErr } = await supabase
      .from('cost_estimate_labor_rows')
      .select('*')
      .eq('cost_estimate_id', estimateId)
      .order('sequence_order', { ascending: true })
    if (laborErr) {
      setError(`Failed to load labor rows: ${laborErr.message}`)
      setCostEstimateLaborRows([])
      return
    }
    let rows = (laborData as CostEstimateLaborRow[]) ?? []
    const countByFixture = new Map<string, number>()
    for (const r of countRows) countByFixture.set(r.fixture, Number(r.count))
    const fixtureSet = new Set(countRows.map((r) => r.fixture))
    const maxSeq = rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sequence_order))
    let seq = maxSeq
    for (const cr of countRows) {
      const existing = rows.find((l) => l.fixture === cr.fixture)
      const countVal = Number(cr.count)
      if (!existing) {
        const def = defaults.find((d) => d.fixture.toLowerCase() === cr.fixture.toLowerCase())
        const { data: inserted, error: insErr } = await supabase
          .from('cost_estimate_labor_rows')
          .insert({
            cost_estimate_id: estimateId,
            fixture: cr.fixture,
            count: countVal,
            rough_in_hrs_per_unit: def?.rough_in_hrs ?? 0,
            top_out_hrs_per_unit: def?.top_out_hrs ?? 0,
            trim_set_hrs_per_unit: def?.trim_set_hrs ?? 0,
            sequence_order: ++seq,
          })
          .select('*')
          .single()
        if (!insErr && inserted) rows = [...rows, inserted as CostEstimateLaborRow]
      } else if (Number(existing.count) !== countVal) {
        await supabase.from('cost_estimate_labor_rows').update({ count: countVal }).eq('id', existing.id)
      }
    }
    const toDelete = rows.filter((r) => !fixtureSet.has(r.fixture))
    for (const r of toDelete) {
      await supabase.from('cost_estimate_labor_rows').delete().eq('id', r.id)
    }
    const { data: refetched } = await supabase
      .from('cost_estimate_labor_rows')
      .select('*')
      .eq('cost_estimate_id', estimateId)
      .order('sequence_order', { ascending: true })
    setCostEstimateLaborRows((refetched as CostEstimateLaborRow[]) ?? [])
  }

  async function ensureCostEstimateForBid(bidId: string): Promise<CostEstimate | null> {
    let est = await loadCostEstimate(bidId)
    if (!est && authUser?.id) {
      const { data: inserted, error: insErr } = await supabase
        .from('cost_estimates')
        .insert({ bid_id: bidId })
        .select('*')
        .single()
      if (insErr) {
        setError(`Failed to create cost estimate: ${insErr.message}`)
        return null
      }
      est = inserted as CostEstimate
      setCostEstimate(est)
    }
    return est
  }

  async function loadCostEstimateData(bidId: string) {
    const countRows = await loadCostEstimateCountRows(bidId)
    if (countRows.length === 0) {
      setCostEstimateLaborRows([])
      const est = await loadCostEstimate(bidId)
      if (!est) await ensureCostEstimateForBid(bidId)
      return
    }
    const est = await ensureCostEstimateForBid(bidId)
    if (!est) return
    const defaults = await loadFixtureLaborDefaults()
    await loadCostEstimateLaborRowsAndSync(est.id, countRows, defaults)
  }

  async function saveCostEstimate() {
    if (!costEstimate) return
    setSavingCostEstimate(true)
    setError(null)
    const laborRateNum = laborRateInput.trim() === '' ? null : parseFloat(laborRateInput)
    if (laborRateInput.trim() !== '' && (isNaN(laborRateNum!) || laborRateNum! < 0)) {
      setError('Labor rate must be a non-negative number.')
      setSavingCostEstimate(false)
      return
    }
    const { error: updateErr } = await supabase
      .from('cost_estimates')
      .update({
        purchase_order_id_rough_in: costEstimate.purchase_order_id_rough_in || null,
        purchase_order_id_top_out: costEstimate.purchase_order_id_top_out || null,
        purchase_order_id_trim_set: costEstimate.purchase_order_id_trim_set || null,
        labor_rate: laborRateNum,
      })
      .eq('id', costEstimate.id)
    if (updateErr) {
      setError(`Failed to save cost estimate: ${updateErr.message}`)
      setSavingCostEstimate(false)
      return
    }
    setCostEstimate((prev) => (prev ? { ...prev, labor_rate: laborRateNum } : null))
    for (const row of costEstimateLaborRows) {
      await supabase
        .from('cost_estimate_labor_rows')
        .update({
          rough_in_hrs_per_unit: row.rough_in_hrs_per_unit,
          top_out_hrs_per_unit: row.top_out_hrs_per_unit,
          trim_set_hrs_per_unit: row.trim_set_hrs_per_unit,
          count: row.count,
        })
        .eq('id', row.id)
    }
    setSavingCostEstimate(false)
  }

  function setCostEstimatePO(stage: 'rough_in' | 'top_out' | 'trim_set', poId: string) {
    if (!costEstimate) return
    const key = stage === 'rough_in' ? 'purchase_order_id_rough_in' : stage === 'top_out' ? 'purchase_order_id_top_out' : 'purchase_order_id_trim_set'
    const id = poId || null
    setCostEstimate((prev) => (prev ? { ...prev, [key]: id } : null))
    if (id) {
      loadPOTotal(id).then((total) => {
        if (stage === 'rough_in') setCostEstimateMaterialTotalRoughIn(total)
        else if (stage === 'top_out') setCostEstimateMaterialTotalTopOut(total)
        else setCostEstimateMaterialTotalTrimSet(total)
      })
    } else {
      if (stage === 'rough_in') setCostEstimateMaterialTotalRoughIn(null)
      else if (stage === 'top_out') setCostEstimateMaterialTotalTopOut(null)
      else setCostEstimateMaterialTotalTrimSet(null)
    }
  }

  function setCostEstimateLaborRow(rowId: string, updates: Partial<Pick<CostEstimateLaborRow, 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit'>>) {
    setCostEstimateLaborRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r))
    )
  }

  function setTakeoffMapping(mappingId: string, updates: { templateId?: string; quantity?: number }) {
    setTakeoffMappings((prev) =>
      prev.map((m) =>
        m.id === mappingId
          ? { ...m, ...(updates.templateId !== undefined && { templateId: updates.templateId }), ...(updates.quantity !== undefined && { quantity: updates.quantity }) }
          : m
      )
    )
  }

  function addTakeoffTemplate(countRowId: string) {
    setTakeoffMappings((prev) => [...prev, { id: crypto.randomUUID(), countRowId, templateId: '', quantity: 1 }])
  }

  function removeTakeoffMapping(mappingId: string) {
    setTakeoffMappings((prev) => prev.filter((m) => m.id !== mappingId))
  }

  async function createPOFromTakeoff() {
    if (!authUser?.id || !selectedBidForTakeoff) return
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('Select a template for at least one fixture to create a purchase order.')
      return
    }
    setTakeoffCreatingPO(true)
    setError(null)
    setTakeoffSuccessMessage(null)
    const projectName = selectedBidForTakeoff.project_name?.trim() || 'Project'
    const dateStr = new Date().toLocaleDateString()
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        name: `${projectName} – Takeoff ${dateStr}`,
        status: 'draft',
        created_by: authUser.id,
        notes: null,
      })
      .select('id')
      .single()
    if (poError) {
      setError(`Failed to create PO: ${poError.message}`)
      setTakeoffCreatingPO(false)
      return
    }
    const allParts: Array<{ part_id: string; quantity: number }> = []
    for (const m of mapped) {
      const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
      const parts = await expandTemplate(supabase, m.templateId, qty)
      allParts.push(...parts)
    }
    const addErr = await addExpandedPartsToPO(supabase, poData.id, allParts)
    if (addErr) {
      setError(addErr)
      setTakeoffCreatingPO(false)
      return
    }
    setTakeoffCreatingPO(false)
    setTakeoffSuccessMessage(`Purchase order "${projectName} – Takeoff ${dateStr}" created. Open Materials → Purchase Orders to edit.`)
    setTakeoffCreatedPOId(poData.id)
    loadDraftPOs()
  }

  async function addTakeoffToExistingPO() {
    if (!authUser?.id || !takeoffExistingPOId.trim()) return
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('Select a template for at least one fixture to add to a purchase order.')
      return
    }
    setTakeoffAddingToPO(true)
    setError(null)
    setTakeoffSuccessMessage(null)
    const allParts: Array<{ part_id: string; quantity: number }> = []
    for (const m of mapped) {
      const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
      const parts = await expandTemplate(supabase, m.templateId, qty)
      allParts.push(...parts)
    }
    const addErr = await addExpandedPartsToPO(supabase, takeoffExistingPOId, allParts)
    if (addErr) {
      setError(addErr)
      setTakeoffAddingToPO(false)
      return
    }
    setTakeoffAddingToPO(false)
    const po = draftPOs.find((p) => p.id === takeoffExistingPOId)
    setTakeoffSuccessMessage(`Items added to "${po?.name ?? 'purchase order'}". Open Materials → Purchase Orders to view.`)
    setTakeoffCreatedPOId(takeoffExistingPOId)
    loadDraftPOs()
  }

  useEffect(() => {
    loadRole()
  }, [authUser?.id])

  useEffect(() => {
    if (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator') {
      const load = async () => {
        try {
          await Promise.all([loadCustomers(), loadBids(), loadEstimatorUsers()])
        } finally {
          setLoading(false)
        }
      }
      load()
    }
  }, [myRole])

  useEffect(() => {
    if (selectedBidForCounts?.id) loadCountRows(selectedBidForCounts.id)
    else setCountRows([])
  }, [selectedBidForCounts?.id])

  useEffect(() => {
    if (selectedBidForSubmission?.id) loadSubmissionEntries(selectedBidForSubmission.id)
    else setSubmissionEntries([])
  }, [selectedBidForSubmission?.id])

  useEffect(() => {
    if (selectedBidForTakeoff?.id) loadTakeoffCountRows(selectedBidForTakeoff.id)
    else {
      setTakeoffCountRows([])
      setTakeoffMappings([])
    }
  }, [selectedBidForTakeoff?.id, activeTab])

  useEffect(() => {
    if (activeTab === 'takeoffs') {
      loadMaterialTemplates()
      loadDraftPOs()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'cost-estimate') {
      loadPurchaseOrdersForCostEstimate()
    }
  }, [activeTab])

  useEffect(() => {
    if (!selectedBidForCostEstimate?.id) {
      setCostEstimate(null)
      setCostEstimateLaborRows([])
      setCostEstimateCountRows([])
      return
    }
    loadCostEstimateData(selectedBidForCostEstimate.id)
  }, [selectedBidForCostEstimate?.id, activeTab])

  function openNewBid() {
    setEditingBid(null)
    setDriveLink('')
    setPlansLink('')
    setGcCustomerId('')
    setGcCustomerSearch('')
    setProjectName('')
    setAddress('')
    setGcContactName('')
    setGcContactPhone('')
    setGcContactEmail('')
    setEstimatorId('')
    setBidDueDate('')
    setEstimatedJobStartDate('')
    setBidDateSent('')
    setOutcome('')
    setBidValue('')
    setAgreedValue('')
    setProfit('')
    setDistanceFromOffice('')
    setLastContact('')
    setNotes('')
    setBidFormOpen(true)
    setError(null)
  }

  function openEditBid(bid: BidWithBuilder) {
    setEditingBid(bid)
    setDriveLink(bid.drive_link ?? '')
    setPlansLink(bid.plans_link ?? '')
    if (bid.customer_id && bid.customers) {
      setGcCustomerId(bid.customer_id)
      setGcCustomerSearch(getCustomerDisplay(bid.customers))
    } else if (bid.gc_builder_id && bid.bids_gc_builders) {
      setGcCustomerId('')
      setGcCustomerSearch(bid.bids_gc_builders.name)
    } else {
      setGcCustomerId('')
      setGcCustomerSearch('')
    }
    setProjectName(bid.project_name ?? '')
    setAddress(bid.address ?? '')
    setGcContactName(bid.gc_contact_name ?? '')
    setGcContactPhone(bid.gc_contact_phone ?? '')
    setGcContactEmail(bid.gc_contact_email ?? '')
    setEstimatorId(bid.estimator_id ?? '')
    setBidDueDate(bid.bid_due_date ?? '')
    setEstimatedJobStartDate(bid.estimated_job_start_date ?? '')
    setBidDateSent(bid.bid_date_sent ?? '')
    setOutcome(bid.outcome ?? '')
    setBidValue(bid.bid_value != null ? String(bid.bid_value) : '')
    setAgreedValue(bid.agreed_value != null ? String(bid.agreed_value) : '')
    setProfit(bid.profit != null ? String(bid.profit) : '')
    setDistanceFromOffice(bid.distance_from_office ?? '')
    setLastContact(bid.last_contact ? bid.last_contact.slice(0, 16) : '')
    setNotes(bid.notes ?? '')
    setDeleteConfirmProjectName('')
    setBidFormOpen(true)
    setError(null)
  }

  function closeBidForm() {
    setBidFormOpen(false)
    setEditingBid(null)
    setDeleteConfirmProjectName('')
    setDeletingBid(false)
    setDeleteBidModalOpen(false)
  }

  async function saveBid(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    if (!projectName.trim()) {
      setError('Project Name is required.')
      return
    }
    setSavingBid(true)
    setError(null)
    const payload = {
      drive_link: driveLink.trim() || null,
      plans_link: plansLink.trim() || null,
      customer_id: gcCustomerId || null,
      gc_builder_id: null,
      project_name: projectName.trim() || null,
      address: address.trim() || null,
      gc_contact_name: gcContactName.trim() || null,
      gc_contact_phone: gcContactPhone.trim() || null,
      gc_contact_email: gcContactEmail.trim() || null,
      estimator_id: estimatorId || null,
      bid_due_date: bidDueDate || null,
      estimated_job_start_date: estimatedJobStartDate.trim() ? estimatedJobStartDate : null,
      bid_date_sent: bidDateSent || null,
      outcome: outcome === 'won' || outcome === 'lost' ? outcome : null,
      bid_value: bidValue !== '' && !isNaN(Number(bidValue)) ? Number(bidValue) : null,
      agreed_value: agreedValue !== '' && !isNaN(Number(agreedValue)) ? Number(agreedValue) : null,
      profit: profit !== '' && !isNaN(Number(profit)) ? Number(profit) : null,
      distance_from_office: distanceFromOffice.trim() || null,
      last_contact: lastContact ? new Date(lastContact).toISOString() : null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    if (editingBid) {
      const { error: err } = await supabase.from('bids').update(payload).eq('id', editingBid.id)
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
    } else {
      const { error: err } = await supabase.from('bids').insert({ ...payload, created_by: authUser.id })
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
    }
    await loadBids()
    closeBidForm()
    setSavingBid(false)
  }

  async function saveBidAndOpenCounts(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    if (!projectName.trim()) {
      setError('Project Name is required.')
      return
    }
    setSavingBid(true)
    setError(null)
    const payload = {
      drive_link: driveLink.trim() || null,
      plans_link: plansLink.trim() || null,
      customer_id: gcCustomerId || null,
      gc_builder_id: null,
      project_name: projectName.trim() || null,
      address: address.trim() || null,
      gc_contact_name: gcContactName.trim() || null,
      gc_contact_phone: gcContactPhone.trim() || null,
      gc_contact_email: gcContactEmail.trim() || null,
      estimator_id: estimatorId || null,
      bid_due_date: bidDueDate || null,
      estimated_job_start_date: estimatedJobStartDate.trim() ? estimatedJobStartDate : null,
      bid_date_sent: bidDateSent || null,
      outcome: outcome === 'won' || outcome === 'lost' ? outcome : null,
      bid_value: bidValue !== '' && !isNaN(Number(bidValue)) ? Number(bidValue) : null,
      agreed_value: agreedValue !== '' && !isNaN(Number(agreedValue)) ? Number(agreedValue) : null,
      profit: profit !== '' && !isNaN(Number(profit)) ? Number(profit) : null,
      distance_from_office: distanceFromOffice.trim() || null,
      last_contact: lastContact ? new Date(lastContact).toISOString() : null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }
    let bidId: string
    if (editingBid) {
      const { error: err } = await supabase.from('bids').update(payload).eq('id', editingBid.id)
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
      bidId = editingBid.id
    } else {
      const { data: inserted, error: err } = await supabase.from('bids').insert({ ...payload, created_by: authUser.id }).select('id').single()
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
      bidId = (inserted as { id: string }).id
    }
    const rows = await loadBids()
    closeBidForm()
    setSavingBid(false)
    setActiveTab('counts')
    const bid = rows.find((b) => b.id === bidId)
    if (bid) setSelectedBidForCounts(bid)
  }

  async function deleteBid() {
    if (!editingBid || deleteConfirmProjectName.trim() !== (editingBid.project_name ?? '').trim()) return
    setDeletingBid(true)
    setError(null)
    const { error: err } = await supabase.from('bids').delete().eq('id', editingBid.id)
    if (err) {
      setError(err.message)
      setDeletingBid(false)
      return
    }
    await loadBids()
    closeBidForm()
    setDeletingBid(false)
  }

  async function saveNotesModal() {
    if (!notesModalBid) return
    setSavingNotes(true)
    setError(null)
    const { error: err } = await supabase
      .from('bids')
      .update({ notes: notesModalText.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', notesModalBid.id)
    setSavingNotes(false)
    if (err) {
      setError(err.message)
      return
    }
    await loadBids()
    setNotesModalBid(null)
  }

  function openGcBuilderOrCustomerModal(bid: BidWithBuilder) {
    if (bid.customer_id && bid.customers) {
      setViewingCustomer(bid.customers)
      setViewingGcBuilder(null)
    } else if (bid.gc_builder_id && bid.bids_gc_builders) {
      setViewingGcBuilder(bid.bids_gc_builders)
      setViewingCustomer(null)
    }
  }

  const filteredBidsForBidBoard = bidBoardSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const bidsForBidBoardDisplay = bidBoardHideLost
    ? filteredBidsForBidBoard.filter((b) => b.outcome !== 'lost')
    : filteredBidsForBidBoard

  const filteredBidsForCounts = countsSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const filteredBidsForSubmission = submissionSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const filteredBidsForTakeoff = takeoffSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const filteredBidsForCostEstimate = costEstimateSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const takeoffMappedCount = takeoffMappings.filter((m) => m.templateId.trim()).length

  const takeoffTemplateFilterLower = takeoffTemplateSearch.trim().toLowerCase()
  const filteredTemplatesForTakeoff = takeoffTemplateFilterLower
    ? materialTemplates.filter((t) => t.name.toLowerCase().includes(takeoffTemplateFilterLower))
    : materialTemplates

  function takeoffTemplateOptionsForMapping(mapping: TakeoffMapping): MaterialTemplate[] {
    const selected = mapping.templateId ? materialTemplates.find((t) => t.id === mapping.templateId) : null
    if (!selected) return filteredTemplatesForTakeoff
    if (filteredTemplatesForTakeoff.some((t) => t.id === selected.id)) return filteredTemplatesForTakeoff
    return [selected, ...filteredTemplatesForTakeoff]
  }

  const submissionUnsent = filteredBidsForSubmission.filter((b) => !b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost')
  const submissionPending = filteredBidsForSubmission.filter((b) => b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost')
  const submissionWon = filteredBidsForSubmission.filter((b) => b.outcome === 'won')
  const submissionLost = filteredBidsForSubmission.filter((b) => b.outcome === 'lost')

  const wonBidsForCustomer = viewingCustomer ? bids.filter((b) => b.customer_id === viewingCustomer.id && b.outcome === 'won') : []
  const lostBidsForCustomer = viewingCustomer ? bids.filter((b) => b.customer_id === viewingCustomer.id && b.outcome === 'lost') : []
  const wonBidsForBuilder = viewingGcBuilder ? bids.filter((b) => b.gc_builder_id === viewingGcBuilder.id && b.outcome === 'won') : []
  const lostBidsForBuilder = viewingGcBuilder ? bids.filter((b) => b.gc_builder_id === viewingGcBuilder.id && b.outcome === 'lost') : []

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  if (myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'assistant' && myRole !== 'estimator') {
    return (
      <div style={{ padding: '2rem' }}>
        <p>You do not have access to Bids.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e5e7eb', marginBottom: '2rem' }}>
        <button type="button" onClick={() => setActiveTab('bid-board')} style={tabStyle(activeTab === 'bid-board')}>
          Bid Board
        </button>
        <button type="button" onClick={() => setActiveTab('counts')} style={tabStyle(activeTab === 'counts')}>
          Counts
        </button>
        <button type="button" onClick={() => setActiveTab('takeoffs')} style={tabStyle(activeTab === 'takeoffs')}>
          Takeoffs
        </button>
        <button type="button" onClick={() => setActiveTab('cost-estimate')} style={tabStyle(activeTab === 'cost-estimate')}>
          Cost Estimate
        </button>
        <button type="button" onClick={() => setActiveTab('cover-letter')} style={tabStyle(activeTab === 'cover-letter')}>
          Cover Letter
        </button>
        <button type="button" onClick={() => setActiveTab('submission-followup')} style={tabStyle(activeTab === 'submission-followup')}>
          Submission & Followup
        </button>
      </div>

      {/* Bid Board Tab */}
      {activeTab === 'bid-board' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search (project name or GC/Builder)..."
              value={bidBoardSearchQuery}
              onChange={(e) => setBidBoardSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={openNewBid}
              style={{ flexShrink: 0, padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              New
            </button>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Project Folder</th>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Job Plans</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>GC/Builder</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                    <button
                      type="button"
                      onClick={() => setBidBoardHideLost((prev) => !prev)}
                      title={bidBoardHideLost ? 'Click to show lost bids' : 'Click to hide lost bids'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 'inherit', color: 'inherit', textDecoration: bidBoardHideLost ? 'underline' : undefined }}
                    >
                      Win/ Loss{bidBoardHideLost ? ' (hiding lost)' : ''}
                    </button>
                  </th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Bid Value</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Estimator</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Bid Due Date</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Bid Date Sent</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Distance<br />to Office</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Last Contact</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Notes</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }} title="Edit" aria-label="Edit" />
                </tr>
              </thead>
              <tbody>
                {bidsForBidBoardDisplay.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      {filteredBidsForBidBoard.length === 0
                        ? (bids.length === 0 ? 'No bids yet. Click New to add one.' : 'No bids match your search.')
                        : (bidBoardHideLost ? 'No bids to show (lost are hidden).' : 'No bids yet. Click New to add one.')}
                    </td>
                  </tr>
                ) : (
                  bidsForBidBoardDisplay.map((bid) => (
                    <tr key={bid.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: 0, textAlign: 'center' }}>
                        {bid.drive_link ? (
                          <a href={bid.drive_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                            Link
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: 0, textAlign: 'center' }}>
                        {bid.plans_link ? (
                          <a href={bid.plans_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                            Link
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.0625rem', maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center' }}>
                        {(bid.customers || bid.bids_gc_builders) ? (
                          <button
                            type="button"
                            onClick={() => openGcBuilderOrCustomerModal(bid)}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                          >
                            {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.0625rem', maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center' }}>
                        {bid.project_name ?? '-'}
                      </td>
                      <td style={{ padding: '0.0625rem', maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center' }} title={bid.address ?? ''}>
                        {bid.address ? (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bid.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                            {bid.address}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>{bid.outcome ?? '-'}</td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>{formatCompactCurrency(bid.bid_value != null ? Number(bid.bid_value) : null)}</td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>{(() => { const est = Array.isArray(bid.estimator) ? bid.estimator[0] : bid.estimator; return est ? (est.name || est.email) : '—'; })()}</td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>{formatDateYYMMDD(bid.bid_date_sent)}</td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>{bid.distance_from_office != null && bid.distance_from_office !== '' ? `${bid.distance_from_office}mi` : '—'}</td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>{formatShortDate(bid.last_contact)}</td>
                      <td
                        role="button"
                        tabIndex={0}
                        onClick={() => { setNotesModalBid(bid); setNotesModalText(bid.notes ?? '') }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNotesModalBid(bid); setNotesModalText(bid.notes ?? '') } }}
                        style={{ padding: '0.0625rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', cursor: 'pointer' }}
                        title={bid.notes ? `${bid.notes} (click to edit)` : 'Click to add notes'}
                      >
                        {bid.notes ?? '-'}
                      </td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openEditBid(bid)}
                          title="Edit bid"
                          style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                            <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Counts Tab */}
      {activeTab === 'counts' && (
        <div>
          {selectedBidForCounts && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{bidDisplayName(selectedBidForCounts) || 'Bid'}</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => openEditBid(selectedBidForCounts)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Edit Bid
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBidForCounts(null)}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in*</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count*</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Plan Page</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }} aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {countRows.map((row) => (
                      <CountRow key={row.id} row={row} onUpdate={refreshAfterCountsChange} onDelete={refreshAfterCountsChange} />
                    ))}
                    {addingCountRow && (
                      <NewCountRow
                        bidId={selectedBidForCounts.id}
                        onSaved={() => { setAddingCountRow(false); refreshAfterCountsChange() }}
                        onCancel={() => setAddingCountRow(false)}
                        onSavedAndAddAnother={refreshAfterCountsChange}
                      />
                    )}
                  </tbody>
                </table>
              </div>
              {!addingCountRow && (
                <button
                  type="button"
                  onClick={() => setAddingCountRow(true)}
                  style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Add row
                </button>
              )}
            </div>
          )}
          <input
            type="text"
            placeholder="Search bids (project name or GC/Builder)..."
            value={countsSearchQuery}
            onChange={(e) => setCountsSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
          />
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredBidsForCounts.map((bid) => (
                  <tr
                    key={bid.id}
                    onClick={() => setSelectedBidForCounts(bid)}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      background: selectedBidForCounts?.id === bid.id ? '#eff6ff' : undefined,
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                    <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Takeoffs Tab */}
      {activeTab === 'takeoffs' && (
        <div>
          <input
            type="text"
            placeholder="Search bids (project name or GC/Builder)..."
            value={takeoffSearchQuery}
            onChange={(e) => setTakeoffSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
          />
          {selectedBidForTakeoff && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{bidDisplayName(selectedBidForTakeoff) || 'Bid'}</h2>
                <button
                  type="button"
                  onClick={() => { setSelectedBidForTakeoff(null); setTakeoffCreatedPOId(null) }}
                  style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
              {takeoffCountRows.length === 0 ? (
                <p style={{ color: '#6b7280', margin: 0 }}>Add fixtures in the Counts tab first.</p>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    Select a template for each fixture you want to include in a purchase order.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span style={{ fontWeight: 500 }}>dropdown filter:</span>
                    <input
                      type="text"
                      placeholder="Filter template list"
                      value={takeoffTemplateSearch}
                      onChange={(e) => setTakeoffTemplateSearch(e.target.value)}
                      style={{ width: 250, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                    />
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Template</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Quantity</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {takeoffCountRows.map((row) => {
                          const mappingsForRow = takeoffMappings.filter((m) => m.countRowId === row.id)
                          if (mappingsForRow.length === 0) {
                            return (
                              <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.75rem' }}>{row.fixture}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{Number(row.count)}</td>
                                <td colSpan={3} style={{ padding: '0.75rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => addTakeoffTemplate(row.id)}
                                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Add template
                                  </button>
                                </td>
                              </tr>
                            )
                          }
                          return (
                            <Fragment key={row.id}>
                              {mappingsForRow.map((mapping) => (
                                <tr key={mapping.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.75rem' }}>{row.fixture}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>{Number(row.count)}</td>
                                  <td style={{ padding: '0.75rem' }}>
                                    <select
                                      value={mapping.templateId}
                                      onChange={(e) => setTakeoffMapping(mapping.id, { templateId: e.target.value })}
                                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                    >
                                      <option value="">—</option>
                                      {takeoffTemplateOptionsForMapping(mapping).map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <input
                                      type="number"
                                      min={1}
                                      value={mapping.quantity}
                                      onChange={(e) => setTakeoffMapping(mapping.id, { quantity: e.target.value === '' ? 1 : Number(e.target.value) })}
                                      style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => removeTakeoffMapping(mapping.id)}
                                      style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.75rem' }} />
                                <td style={{ padding: '0.75rem' }} />
                                <td colSpan={3} style={{ padding: '0.75rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => addTakeoffTemplate(row.id)}
                                    style={{ padding: '0.5rem 1rem', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Add template
                                  </button>
                                </td>
                              </tr>
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={createPOFromTakeoff}
                      disabled={takeoffCreatingPO || takeoffMappedCount === 0}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: takeoffCreatingPO || takeoffMappedCount === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffCreatingPO ? 'Creating…' : 'Create purchase order'}
                    </button>
                    <select
                      value={takeoffExistingPOId}
                      onChange={(e) => setTakeoffExistingPOId(e.target.value)}
                      style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 200 }}
                    >
                      <option value="">Add to existing PO…</option>
                      {draftPOs.map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addTakeoffToExistingPO}
                      disabled={takeoffAddingToPO || takeoffMappedCount === 0 || !takeoffExistingPOId.trim()}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: takeoffAddingToPO || takeoffMappedCount === 0 || !takeoffExistingPOId ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffAddingToPO ? 'Adding…' : 'Add to selected PO'}
                    </button>
                  </div>
                  {takeoffSuccessMessage && (
                    <p style={{ margin: '1rem 0 0', color: '#059669', fontSize: '0.875rem' }}>{takeoffSuccessMessage}</p>
                  )}
                  {takeoffCreatedPOId && (
                    <p style={{ margin: '0.75rem 0 0' }}>
                      <Link
                        to="/materials"
                        state={{ openPOId: takeoffCreatedPOId }}
                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}
                      >
                        View purchase order
                      </Link>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredBidsForTakeoff.map((bid) => (
                  <tr
                    key={bid.id}
                    onClick={() => setSelectedBidForTakeoff(bid)}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      background: selectedBidForTakeoff?.id === bid.id ? '#eff6ff' : undefined,
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                    <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost Estimate Tab */}
      {activeTab === 'cost-estimate' && (
        <div>
          <input
            type="text"
            placeholder="Search bids (project name or GC/Builder)..."
            value={costEstimateSearchQuery}
            onChange={(e) => setCostEstimateSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
          />
          {selectedBidForCostEstimate && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{bidDisplayName(selectedBidForCostEstimate) || 'Bid'}</h2>
                <button
                  type="button"
                  onClick={() => setSelectedBidForCostEstimate(null)}
                  style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
              {costEstimateCountRows.length === 0 ? (
                <p style={{ color: '#6b7280', margin: 0 }}>Add fixtures in the Counts tab first.</p>
              ) : (
                <>
                  {/* Material section: three POs */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Materials by stage</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PO (Rough In)</label>
                        <select
                          value={costEstimate?.purchase_order_id_rough_in ?? ''}
                          onChange={(e) => setCostEstimatePO('rough_in', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        >
                          <option value="">—</option>
                          {purchaseOrdersForCostEstimate.map((po) => (
                            <option key={po.id} value={po.id}>{po.name}</option>
                          ))}
                        </select>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                          Rough In materials: {costEstimateMaterialTotalRoughIn != null ? `$${Number(costEstimateMaterialTotalRoughIn).toFixed(2)}` : '—'}
                        </p>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PO (Top Out)</label>
                        <select
                          value={costEstimate?.purchase_order_id_top_out ?? ''}
                          onChange={(e) => setCostEstimatePO('top_out', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        >
                          <option value="">—</option>
                          {purchaseOrdersForCostEstimate.map((po) => (
                            <option key={po.id} value={po.id}>{po.name}</option>
                          ))}
                        </select>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                          Top Out materials: {costEstimateMaterialTotalTopOut != null ? `$${Number(costEstimateMaterialTotalTopOut).toFixed(2)}` : '—'}
                        </p>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PO (Trim Set)</label>
                        <select
                          value={costEstimate?.purchase_order_id_trim_set ?? ''}
                          onChange={(e) => setCostEstimatePO('trim_set', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        >
                          <option value="">—</option>
                          {purchaseOrdersForCostEstimate.map((po) => (
                            <option key={po.id} value={po.id}>{po.name}</option>
                          ))}
                        </select>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                          Trim Set materials: {costEstimateMaterialTotalTrimSet != null ? `$${Number(costEstimateMaterialTotalTrimSet).toFixed(2)}` : '—'}
                        </p>
                      </div>
                    </div>
                    <p style={{ margin: '0.5rem 0 0', fontWeight: 600 }}>
                      Total materials: $
                      {(
                        (costEstimateMaterialTotalRoughIn ?? 0) +
                        (costEstimateMaterialTotalTopOut ?? 0) +
                        (costEstimateMaterialTotalTrimSet ?? 0)
                      ).toFixed(2)}
                    </p>
                  </div>
                  {/* Labor section */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Labor</h3>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Labor rate ($/hr)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={laborRateInput}
                        onChange={(e) => setLaborRateInput(e.target.value)}
                        style={{ width: '8rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Rough In (hrs/unit)</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Top Out (hrs/unit)</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Trim Set (hrs/unit)</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Total hrs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costEstimateLaborRows.map((row) => {
                            const totalHrs = Number(row.count) * (Number(row.rough_in_hrs_per_unit) + Number(row.top_out_hrs_per_unit) + Number(row.trim_set_hrs_per_unit))
                            return (
                              <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.75rem' }}>{row.fixture}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{Number(row.count)}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={row.rough_in_hrs_per_unit}
                                    onChange={(e) => setCostEstimateLaborRow(row.id, { rough_in_hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                    style={{ width: '5rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={row.top_out_hrs_per_unit}
                                    onChange={(e) => setCostEstimateLaborRow(row.id, { top_out_hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                    style={{ width: '5rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={row.trim_set_hrs_per_unit}
                                    onChange={(e) => setCostEstimateLaborRow(row.id, { trim_set_hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                    style={{ width: '5rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 500 }}>{totalHrs.toFixed(2)}</td>
                              </tr>
                            )
                          })}
                          {costEstimateLaborRows.length > 0 && (() => {
                            const totalRough = costEstimateLaborRows.reduce((s, r) => s + Number(r.count) * Number(r.rough_in_hrs_per_unit), 0)
                            const totalTop = costEstimateLaborRows.reduce((s, r) => s + Number(r.count) * Number(r.top_out_hrs_per_unit), 0)
                            const totalTrim = costEstimateLaborRows.reduce((s, r) => s + Number(r.count) * Number(r.trim_set_hrs_per_unit), 0)
                            const totalHours = totalRough + totalTop + totalTrim
                            const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0
                            const laborCost = totalHours * rate
                            return (
                              <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                                <td style={{ padding: '0.75rem' }}>Totals</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }} />
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalRough.toFixed(2)} hrs</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalTop.toFixed(2)} hrs</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalTrim.toFixed(2)} hrs</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalHours.toFixed(2)} hrs</td>
                              </tr>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                    {costEstimateLaborRows.length > 0 && (() => {
                      const totalHours = costEstimateLaborRows.reduce(
                        (s, r) => s + Number(r.count) * (Number(r.rough_in_hrs_per_unit) + Number(r.top_out_hrs_per_unit) + Number(r.trim_set_hrs_per_unit)),
                        0
                      )
                      const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0
                      const laborCost = totalHours * rate
                      return (
                        <p style={{ margin: '0.75rem 0 0', fontWeight: 600 }}>
                          Labor total: {totalHours.toFixed(2)} hrs × ${rate.toFixed(2)}/hr = ${laborCost.toFixed(2)}
                        </p>
                      )
                    })()}
                  </div>
                  {/* Summary */}
                  <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Summary</h3>
                    {(() => {
                      const totalMaterials =
                        (costEstimateMaterialTotalRoughIn ?? 0) + (costEstimateMaterialTotalTopOut ?? 0) + (costEstimateMaterialTotalTrimSet ?? 0)
                      const totalHours = costEstimateLaborRows.reduce(
                        (s, r) => s + Number(r.count) * (Number(r.rough_in_hrs_per_unit) + Number(r.top_out_hrs_per_unit) + Number(r.trim_set_hrs_per_unit)),
                        0
                      )
                      const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0
                      const laborCost = totalHours * rate
                      const grandTotal = totalMaterials + laborCost
                      return (
                        <>
                          <p style={{ margin: '0.25rem 0' }}>Total materials: ${totalMaterials.toFixed(2)}</p>
                          <p style={{ margin: '0.25rem 0' }}>Labor total: ${laborCost.toFixed(2)}</p>
                          <p style={{ margin: '0.5rem 0 0', fontWeight: 700, fontSize: '1.125rem' }}>Grand total: ${grandTotal.toFixed(2)}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={saveCostEstimate}
                      disabled={savingCostEstimate || !costEstimate}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingCostEstimate ? 'wait' : 'pointer' }}
                    >
                      {savingCostEstimate ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Print
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {!selectedBidForCostEstimate && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBidsForCostEstimate.map((bid) => (
                    <tr
                      key={bid.id}
                      onClick={() => setSelectedBidForCostEstimate(bid)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid #e5e7eb',
                        background: selectedBidForCostEstimate?.id === bid.id ? '#eff6ff' : undefined,
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>{bid.project_name ?? '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{bid.address ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cover Letter Tab */}
      {activeTab === 'cover-letter' && (
        <div style={{ padding: '2rem', color: '#6b7280', textAlign: 'center' }}>
          <p style={{ margin: 0 }}>Cover Letter – coming soon</p>
          <p style={{ margin: '0.5rem 0 0' }}>Until then, please use <a href="https://BidTooling.com" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>BidTooling.com</a></p>
        </div>
      )}

      {/* Submission & Followup Tab */}
      {activeTab === 'submission-followup' && (
        <div>
          <input
            type="text"
            placeholder="Search bids (project name or GC/Builder)..."
            value={submissionSearchQuery}
            onChange={(e) => setSubmissionSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
          />
          {selectedBidForSubmission && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{bidDisplayName(selectedBidForSubmission) || 'Bid'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => openEditBid(selectedBidForSubmission)}
                    title="Edit bid"
                    style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                      <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBidForSubmission(null)}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                <p style={{ margin: '0.25rem 0' }}><strong>Bid Size</strong> {formatCompactCurrency(selectedBidForSubmission.bid_value != null ? Number(selectedBidForSubmission.bid_value) : null)}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Builder Name</strong> {selectedBidForSubmission.customers?.name ?? selectedBidForSubmission.bids_gc_builders?.name ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Builder Address</strong> {selectedBidForSubmission.customers?.address ?? selectedBidForSubmission.bids_gc_builders?.address ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Builder Phone Number</strong> {selectedBidForSubmission.customers ? extractContactInfo(selectedBidForSubmission.customers.contact_info ?? null).phone || '—' : (selectedBidForSubmission.bids_gc_builders?.contact_number ?? '—')}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Builder Email</strong> {selectedBidForSubmission.customers ? extractContactInfo(selectedBidForSubmission.customers.contact_info ?? null).email || '—' : (selectedBidForSubmission.bids_gc_builders?.email ?? '—')}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Project Name</strong> {selectedBidForSubmission.project_name ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Project Address</strong> {selectedBidForSubmission.address ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Project Contact Name</strong> {selectedBidForSubmission.gc_contact_name ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Project Contact Phone</strong> {selectedBidForSubmission.gc_contact_phone ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Project Contact Email</strong> {selectedBidForSubmission.gc_contact_email ?? '—'}</p>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contact method</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Notes</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Time and date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissionEntries.map((entry) => (
                      <SubmissionEntryRow
                        key={entry.id}
                        entry={entry}
                        onUpdate={() => { loadSubmissionEntries(selectedBidForSubmission.id); loadBids() }}
                        onDelete={() => { loadSubmissionEntries(selectedBidForSubmission.id); loadBids() }}
                      />
                    ))}
                    {addingSubmissionEntry && (
                      <NewSubmissionEntryRow
                        bidId={selectedBidForSubmission.id}
                        onSaved={() => { setAddingSubmissionEntry(false); loadSubmissionEntries(selectedBidForSubmission.id); loadBids() }}
                        onCancel={() => setAddingSubmissionEntry(false)}
                      />
                    )}
                  </tbody>
                </table>
              </div>
              {!addingSubmissionEntry && (
                <button
                  type="button"
                  onClick={() => setAddingSubmissionEntry(true)}
                  style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Add row
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleSubmissionSection('unsent')}
            aria-expanded={submissionSectionOpen.unsent}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{submissionSectionOpen.unsent ? '\u25BC' : '\u25B6'}</span>
            Unsent bids ({submissionUnsent.length})
          </button>
          {submissionSectionOpen.unsent && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Due Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date Sent</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Time since last contact</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Time to/from bid due date</th>
                    <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {submissionUnsent.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                  ) : (
                    submissionUnsent.map((bid) => (
                      <tr
                        key={bid.id}
                        onClick={() => setSelectedBidForSubmission(bid)}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: selectedBidForSubmission?.id === bid.id ? '#eff6ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_date_sent)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatTimeSinceLastContact(
                          (() => {
                            const a = bid.last_contact
                            const b = lastContactFromEntries[bid.id]
                            if (!a) return b ?? null
                            if (!b) return a
                            return new Date(b) > new Date(a) ? b : a
                          })()
                        )}</td>
                        <td style={{ padding: '0.75rem' }}>{formatTimeSinceDueDate(bid.bid_due_date)}</td>
                        <td style={{ padding: '0.75rem', width: 44 }}>
                          {selectedBidForSubmission?.id === bid.id && (
                            <button
                              type="button"
                              title="Edit bid"
                              onClick={(e) => { e.stopPropagation(); openEditBid(bid) }}
                              style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleSubmissionSection('pending')}
            aria-expanded={submissionSectionOpen.pending}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{submissionSectionOpen.pending ? '\u25BC' : '\u25B6'}</span>
            Not yet won or lost ({submissionPending.length})
          </button>
          {submissionSectionOpen.pending && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Due Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date Sent</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Time since last contact</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Time to/from bid due date</th>
                    <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {submissionPending.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                  ) : (
                    submissionPending.map((bid) => (
                      <tr
                        key={bid.id}
                        onClick={() => setSelectedBidForSubmission(bid)}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: selectedBidForSubmission?.id === bid.id ? '#eff6ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_date_sent)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatTimeSinceLastContact(
                          (() => {
                            const a = bid.last_contact
                            const b = lastContactFromEntries[bid.id]
                            if (!a) return b ?? null
                            if (!b) return a
                            return new Date(b) > new Date(a) ? b : a
                          })()
                        )}</td>
                        <td style={{ padding: '0.75rem' }}>{formatTimeSinceDueDate(bid.bid_due_date)}</td>
                        <td style={{ padding: '0.75rem', width: 44 }}>
                          {selectedBidForSubmission?.id === bid.id && (
                            <button
                              type="button"
                              title="Edit bid"
                              onClick={(e) => { e.stopPropagation(); openEditBid(bid) }}
                              style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleSubmissionSection('won')}
            aria-expanded={submissionSectionOpen.won}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{submissionSectionOpen.won ? '\u25BC' : '\u25B6'}</span>
            Won ({submissionWon.length})
          </button>
          {submissionSectionOpen.won && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Estimated Job Start Date</th>
                    <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {submissionWon.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                  ) : (
                    submissionWon.map((bid) => (
                      <tr
                        key={bid.id}
                        onClick={() => setSelectedBidForSubmission(bid)}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: selectedBidForSubmission?.id === bid.id ? '#eff6ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.estimated_job_start_date)}</td>
                        <td style={{ padding: '0.75rem', width: 44 }}>
                          {selectedBidForSubmission?.id === bid.id && (
                            <button
                              type="button"
                              title="Edit bid"
                              onClick={(e) => { e.stopPropagation(); openEditBid(bid) }}
                              style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleSubmissionSection('lost')}
            aria-expanded={submissionSectionOpen.lost}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{submissionSectionOpen.lost ? '\u25BC' : '\u25B6'}</span>
            Lost ({submissionLost.length})
          </button>
          {submissionSectionOpen.lost && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Due Date</th>
                  <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid #e5e7eb' }} />
                </tr>
              </thead>
              <tbody>
                {submissionLost.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                ) : (
                  submissionLost.map((bid) => (
                    <tr
                      key={bid.id}
                      onClick={() => setSelectedBidForSubmission(bid)}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        background: selectedBidForSubmission?.id === bid.id ? '#eff6ff' : undefined,
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                      <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                      <td style={{ padding: '0.75rem', width: 44 }}>
                        {selectedBidForSubmission?.id === bid.id && (
                          <button
                            type="button"
                            title="Edit bid"
                            onClick={(e) => { e.stopPropagation(); openEditBid(bid) }}
                            style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* New/Edit Bid Modal */}
      {bidFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{editingBid ? 'Edit Bid' : 'New Bid'}</h2>
              <button type="button" onClick={closeBidForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
            <form onSubmit={saveBid}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Project Folder{'\u00A0'.repeat(10)}
                  bid folders:{' '}
                  <a href="https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB?usp=sharing" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                    [plumbing]
                  </a>
                  {' '}
                  <a href="https://drive.google.com/drive/folders/10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2?usp=sharing" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                    [electrical]
                  </a>
                  {' '}
                  <a href="https://drive.google.com/drive/folders/1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL?usp=drive_link" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                    [HVAC]
                  </a>
                </label>
                <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Job Plans</label>
                <input type="url" value={plansLink} onChange={(e) => setPlansLink(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>GC/Builder (customer)</label>
                <input
                  type="text"
                  value={gcCustomerSearch}
                  onChange={(e) => {
                    const value = e.target.value
                    setGcCustomerSearch(value)
                    setGcCustomerDropdownOpen(true)
                    if (gcCustomerId) {
                      const selected = customers.find((c) => c.id === gcCustomerId)
                      if (!selected || !value || getCustomerDisplay(selected).toLowerCase() !== value.toLowerCase()) {
                        setGcCustomerId('')
                      }
                    }
                  }}
                  onFocus={() => setGcCustomerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setGcCustomerDropdownOpen(false), 200)}
                  placeholder="Search customers..."
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
                {gcCustomerDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      maxHeight: 200,
                      overflowY: 'auto',
                      zIndex: 100,
                      marginTop: 2,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {(myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator') && (
                      <div
                        onClick={() => {
                          setAddCustomerModalOpen(true)
                          setGcCustomerDropdownOpen(false)
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          padding: '0.5rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #e5e7eb',
                          color: '#2563eb',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white'
                        }}
                      >
                        + Add new customer
                      </div>
                    )}
                    {customers
                      .filter((c) => {
                        const searchLower = gcCustomerSearch.toLowerCase()
                        const nameLower = c.name.toLowerCase()
                        const addressLower = (c.address || '').toLowerCase()
                        return nameLower.includes(searchLower) || addressLower.includes(searchLower)
                      })
                      .map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setGcCustomerId(c.id)
                            setGcCustomerSearch(getCustomerDisplay(c))
                            setGcCustomerDropdownOpen(false)
                          }}
                          style={{
                            padding: '0.5rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f3f4f6'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white'
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          {c.address && <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>{c.address}</div>}
                        </div>
                      ))}
                    {customers.filter((c) => {
                      const searchLower = gcCustomerSearch.toLowerCase()
                      return c.name.toLowerCase().includes(searchLower) || (c.address || '').toLowerCase().includes(searchLower)
                    }).length === 0 && (
                      <div style={{ padding: '0.5rem', color: '#6b7280', fontStyle: 'italic' }}>No customers found</div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Contact Name</label>
                <input type="text" value={gcContactName} onChange={(e) => setGcContactName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Contact Phone</label>
                <input type="tel" value={gcContactPhone} onChange={(e) => setGcContactPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Contact Email</label>
                <input type="email" value={gcContactEmail} onChange={(e) => setGcContactEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Name *</label>
                <input type="text" value={projectName} onChange={(e) => { setProjectName(e.target.value); setError(null) }} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estimator</label>
                <select value={estimatorId} onChange={(e) => setEstimatorId(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                  <option value="">—</option>
                  {estimatorUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Due Date</label>
                  <input type="date" value={bidDueDate} onChange={(e) => setBidDueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Date Sent</label>
                  <input type="date" value={bidDateSent} onChange={(e) => setBidDateSent(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Win/ Loss</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value as 'won' | 'lost' | '')} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                  <option value="">—</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              {outcome === 'won' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estimated Job Start Date</label>
                  <input type="date" value={estimatedJobStartDate} onChange={(e) => setEstimatedJobStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Value</label>
                  <input type="number" step="0.01" value={bidValue} onChange={(e) => setBidValue(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Agreed Value</label>
                  <input type="number" step="0.01" value={agreedValue} onChange={(e) => setAgreedValue(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Maximum Profit</label>
                  <input type="number" step="0.01" value={profit} onChange={(e) => setProfit(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Distance to Office</label>
                <input type="number" min={0} step={0.1} value={distanceFromOffice} onChange={(e) => setDistanceFromOffice(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Last Contact</label>
                <input type="datetime-local" value={lastContact} onChange={(e) => setLastContact(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={saveBidAndOpenCounts}
                  disabled={savingBid}
                  style={{ marginRight: 'auto', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Save and start Counts
                </button>
                {editingBid && (
                  <button
                    type="button"
                    onClick={() => { setDeleteBidModalOpen(true); setDeleteConfirmProjectName(''); setError(null) }}
                    style={{ marginRight: 'auto', padding: '0.5rem 1rem', color: '#b91c1b', background: 'white', border: '1px solid #b91c1b', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Delete bid
                  </button>
                )}
                <button type="submit" disabled={savingBid} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  {savingBid ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer modal (from GC/Builder in Edit Bid) */}
      {addCustomerModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <NewCustomerForm
              showQuickFill={false}
              mode="modal"
              onCancel={() => setAddCustomerModalOpen(false)}
              onCreated={(c) => {
                loadCustomers()
                setGcCustomerId(c.id)
                setGcCustomerSearch(getCustomerDisplay(c))
                setAddCustomerModalOpen(false)
              }}
            />
          </div>
        </div>
      )}

      {/* Delete bid confirmation modal */}
      {deleteBidModalOpen && editingBid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Delete bid</h2>
            <p style={{ marginBottom: '1rem' }}>
              {editingBid.project_name
                ? <>Type the project name <strong>{editingBid.project_name}</strong> to confirm.</>
                : 'This bid has no project name; leave the field empty to confirm.'}
            </p>
            <input
              type="text"
              value={deleteConfirmProjectName}
              onChange={(e) => { setDeleteConfirmProjectName(e.target.value); setError(null) }}
              placeholder={editingBid.project_name ? 'Project name' : 'No project name'}
              disabled={deletingBid}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              autoComplete="off"
            />
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={deleteBid}
                disabled={deletingBid || deleteConfirmProjectName.trim() !== (editingBid.project_name ?? '').trim()}
                style={{ padding: '0.5rem 1rem', color: '#b91c1c', background: 'white', border: '1px solid #b91c1c', borderRadius: 4, cursor: deletingBid || deleteConfirmProjectName.trim() !== (editingBid.project_name ?? '').trim() ? 'not-allowed' : 'pointer' }}
              >
                {deletingBid ? 'Deleting…' : 'Delete bid'}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteBidModalOpen(false); setDeleteConfirmProjectName(''); setError(null) }}
                disabled={deletingBid}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: deletingBid ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes quick-edit modal */}
      {notesModalBid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1rem' }}>Notes – {bidDisplayName(notesModalBid) || 'Bid'}</h2>
            <textarea
              value={notesModalText}
              onChange={(e) => setNotesModalText(e.target.value)}
              placeholder="Add or edit notes…"
              rows={6}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setNotesModalBid(null)}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNotesModal}
                disabled={savingNotes}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                {savingNotes ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GC/Builder view modal (customer) */}
      {viewingCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1rem' }}>{viewingCustomer.name}</h2>
            <p style={{ margin: '0.25rem 0' }}><strong>Address:</strong> {viewingCustomer.address || '—'}</p>
            {(() => {
              const contact = extractContactInfo(viewingCustomer.contact_info)
              return (
                <>
                  {contact.phone && <p style={{ margin: '0.25rem 0' }}><strong>Phone:</strong> {contact.phone}</p>}
                  {contact.email && <p style={{ margin: '0.25rem 0' }}><strong>Email:</strong> {contact.email}</p>}
                </>
              )
            })()}
            <p style={{ margin: '0.25rem 0' }}><strong>Won bids:</strong> {wonBidsForCustomer.length}</p>
            {wonBidsForCustomer.length > 0 && (
              <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
                {wonBidsForCustomer.map((b) => (
                  <li key={b.id}>{bidDisplayName(b) || b.id}</li>
                ))}
              </ul>
            )}
            <p style={{ margin: '0.25rem 0' }}><strong>Lost bids:</strong> {lostBidsForCustomer.length}</p>
            {lostBidsForCustomer.length > 0 && (
              <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
                {lostBidsForCustomer.map((b) => (
                  <li key={b.id}>{bidDisplayName(b) || b.id}</li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setViewingCustomer(null)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* GC/Builder view modal (legacy bids_gc_builders) */}
      {viewingGcBuilder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1rem' }}>{viewingGcBuilder.name}</h2>
            <p style={{ margin: '0.25rem 0' }}><strong>Address:</strong> {viewingGcBuilder.address || '—'}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Contact number:</strong> {viewingGcBuilder.contact_number || '—'}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Won bids:</strong> {wonBidsForBuilder.length}</p>
            {wonBidsForBuilder.length > 0 && (
              <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
                {wonBidsForBuilder.map((b) => (
                  <li key={b.id}>{bidDisplayName(b) || b.id}</li>
                ))}
              </ul>
            )}
            <p style={{ margin: '0.25rem 0' }}><strong>Lost bids:</strong> {lostBidsForBuilder.length}</p>
            {lostBidsForBuilder.length > 0 && (
              <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
                {lostBidsForBuilder.map((b) => (
                  <li key={b.id}>{bidDisplayName(b) || b.id}</li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setViewingGcBuilder(null)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CountRow({ row, onUpdate, onDelete }: { row: BidCountRow; onUpdate: () => void; onDelete: () => void }) {
  const [fixture, setFixture] = useState(row.fixture)
  const [count, setCount] = useState(String(row.count))
  const [page, setPage] = useState(row.page ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const num = parseFloat(count)
    if (isNaN(num)) { setSaving(false); return }
    const { error } = await supabase.from('bids_count_rows').update({ fixture: fixture.trim(), count: num, page: page.trim() || null }).eq('id', row.id)
    if (error) { setSaving(false); return }
    setEditing(false)
    onUpdate()
    setSaving(false)
  }

  async function remove() {
    if (!confirm('Remove this row?')) return
    await supabase.from('bids_count_rows').delete().eq('id', row.id)
    onDelete()
  }

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={fixture} onChange={(e) => setFixture(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={page} onChange={(e) => setPage(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <button type="button" onClick={save} disabled={saving} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
        </td>
      </tr>
    )
  }
  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '0.75rem' }}>{row.fixture}</td>
      <td style={{ padding: '0.75rem' }}>{row.count}</td>
      <td style={{ padding: '0.75rem' }}>{row.page ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>
        <button type="button" onClick={() => setEditing(true)} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
        <button type="button" onClick={remove} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
      </td>
    </tr>
  )
}

function NewCountRow({ bidId, onSaved, onCancel, onSavedAndAddAnother }: { bidId: string; onSaved: () => void; onCancel: () => void; onSavedAndAddAnother?: () => void }) {
  const [fixture, setFixture] = useState('')
  const [count, setCount] = useState('')
  const [page, setPage] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    const num = parseFloat(count)
    if (isNaN(num) || !fixture.trim()) return
    setSaving(true)
    const { error } = await supabase.from('bids_count_rows').insert({ bid_id: bidId, fixture: fixture.trim(), count: num, page: page.trim() || null })
    if (error) { setSaving(false); return }
    onSaved()
  }

  async function submitAndAdd() {
    const num = parseFloat(count)
    if (isNaN(num) || !fixture.trim()) return
    setSaving(true)
    const { error } = await supabase.from('bids_count_rows').insert({ bid_id: bidId, fixture: fixture.trim(), count: num, page: page.trim() || null })
    if (error) { setSaving(false); return }
    setFixture('')
    setCount('')
    setPage('')
    setSaving(false)
    onSavedAndAddAnother?.()
  }

  const fixtureGroups: { label: string; fixtures: string[] }[] = [
    { label: 'Bathrooms:', fixtures: ['Toilets', 'Bathroom sinks', 'Shower/tub combos', 'Showers no tub', 'Bathtubs', 'Urinals', 'Water closets'] },
    { label: 'Kitchen:', fixtures: ['Kitchen sinks', 'Garbage disposals', 'Ice makers', 'Pot filler'] },
    { label: 'Laundry:', fixtures: ['Laundry sinks', 'Washing machine'] },
    { label: 'Plumbing Fixtures:', fixtures: ['Hose bibs', 'Water fountain', 'Gas drops', 'Floor drains', 'Dog wash'] },
    { label: 'Appliances:', fixtures: ['Water heaters (gas)', 'Water heaters (electric)', 'Water heaters (tankless)', 'Water softener'] },
  ]

  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td colSpan={3} style={{ padding: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="text" value={fixture} onChange={(e) => setFixture(e.target.value)} placeholder="Fixture or Tie-in*" style={{ flex: 1, minWidth: 120, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            <input type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Count*" style={{ flex: 1, minWidth: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            <input type="text" value={page} onChange={(e) => setPage(e.target.value)} placeholder="Plan Page" style={{ flex: 1, minWidth: 100, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {fixtureGroups.map((group) => (
              <div key={group.label} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, marginRight: '0.25rem', flexShrink: 0 }}>{group.label}</span>
                {group.fixtures.map((name) => (
                  <button key={name} type="button" onClick={() => setFixture(name)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>{name}</button>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem', maxWidth: 160 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button key={d} type="button" onClick={() => setCount((c) => c + String(d))} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>{d}</button>
              ))}
              <button type="button" onClick={() => setCount('')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }} title="All clear">C</button>
              <button type="button" onClick={() => setCount((c) => c + '0')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>0</button>
              <button type="button" onClick={() => setCount((c) => c.slice(0, -1))} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }} title="Delete">⌫</button>
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button type="button" onClick={submit} disabled={saving || !fixture.trim() || isNaN(parseFloat(count))} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
            <button type="button" onClick={onCancel} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
          </div>
          <button type="button" onClick={submitAndAdd} disabled={saving || !fixture.trim() || isNaN(parseFloat(count))} style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', alignSelf: 'center' }}>Save and Add</button>
        </div>
      </td>
    </tr>
  )
}

function SubmissionEntryRow({ entry, onUpdate, onDelete }: { entry: BidSubmissionEntry; onUpdate: () => void; onDelete: () => void }) {
  const [contactMethod, setContactMethod] = useState(entry.contact_method ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [occurredAt, setOccurredAt] = useState(entry.occurred_at ? entry.occurred_at.slice(0, 16) : '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const occurredAtIso = occurredAt ? new Date(occurredAt).toISOString() : entry.occurred_at
    const { error } = await supabase
      .from('bids_submission_entries')
      .update({ contact_method: contactMethod.trim() || null, notes: notes.trim() || null, occurred_at: occurredAtIso })
      .eq('id', entry.id)
    if (error) { setSaving(false); return }
    if (occurredAtIso && entry.bid_id) {
      await supabase.from('bids').update({ last_contact: occurredAtIso }).eq('id', entry.bid_id)
    }
    setEditing(false)
    onUpdate()
    setSaving(false)
  }

  async function remove() {
    if (!confirm('Remove this entry?')) return
    await supabase.from('bids_submission_entries').delete().eq('id', entry.id)
    onDelete()
  }

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <button type="button" onClick={save} disabled={saving} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
        </td>
      </tr>
    )
  }
  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '0.75rem' }}>{entry.contact_method ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>{entry.notes ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>{entry.occurred_at ? new Date(entry.occurred_at).toLocaleString() : '—'}</td>
      <td style={{ padding: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Edit"
          style={{ marginRight: '0.5rem', padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={remove}
          title="Delete"
          style={{ padding: '0.25rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function NewSubmissionEntryRow({ bidId, onSaved, onCancel }: { bidId: string; onSaved: () => void; onCancel: () => void }) {
  const [contactMethod, setContactMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    const occurredAtIso = new Date(occurredAt).toISOString()
    const { error } = await supabase.from('bids_submission_entries').insert({
      bid_id: bidId,
      contact_method: contactMethod.trim() || null,
      notes: notes.trim() || null,
      occurred_at: occurredAtIso,
    })
    if (error) { setSaving(false); return }
    await supabase.from('bids').update({ last_contact: occurredAtIso }).eq('id', bidId)
    onSaved()
  }

  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '0.75rem' }}>
        <input type="text" value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} placeholder="Contact method" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '0.75rem' }}>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '0.75rem' }}>
        <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '0.75rem' }}>
        <button type="button" onClick={submit} disabled={saving} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
        <button type="button" onClick={onCancel} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
      </td>
    </tr>
  )
}
