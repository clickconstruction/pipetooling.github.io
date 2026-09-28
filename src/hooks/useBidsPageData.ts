/**
 * What the Bids page loads and who is looking: the role and its trade scope, the trades, the
 * bids with their contact recency and GC recipients, the customers and their contacts, the
 * estimators, the twin user ids — and the gates that decide when each load runs.
 *
 * The Bids map's step 8 (`docs/BIDS_TABS_ARCHITECTURE.md` → Recommended extraction order):
 * moved out of `src/pages/Bids.tsx` verbatim. `useBidsPageData` holds the state and the
 * loaders and runs no effect; `useBidsLoadGates` is the three load effects, called where they
 * stood in the page so they run in the order they ran. The page keeps the trade that is
 * picked, its loading and error lines, and the role load's own effect.
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { loadBidEntryRecency } from '../lib/bids/bidEntryRecency'
import { fetchBidGcRecipientsMap, type BidGcRecipientsMap } from '../lib/bids/bidGcRecipients'
import { canOpenBids, type BidsRole, type BidsTabKey } from '../lib/bids/bidsTabAccess'
import { filterActiveCustomersForPicker } from '../lib/customerArchive'
import type { BidWithBuilder, EstimatorUser } from '../types/bidWithBuilder'
import type { Bid } from '../types/bids'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'

type GcBuilder = Database['public']['Tables']['bids_gc_builders']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type CustomerContact = Database['public']['Tables']['customer_contacts']['Row']
type CustomerContactPerson = Database['public']['Tables']['customer_contact_persons']['Row']
type UserRole = BidsRole

export interface BidsServiceType {
  id: string
  name: string
  description: string | null
  color: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}
type ServiceType = BidsServiceType

export function useBidsPageData(input: {
  authUserId: string | null | undefined
  /** The trade pill's trade; `''` until the trades load or while it is cleared. */
  selectedServiceTypeId: string
  setSelectedServiceTypeId: Dispatch<SetStateAction<string>>
  setLoading: (loading: boolean) => void
  setError: (message: string | null) => void
}) {
  const { authUserId, selectedServiceTypeId, setSelectedServiceTypeId, setLoading, setError } = input

  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [estimatorServiceTypeIds, setEstimatorServiceTypeIds] = useState<string[] | null>(null)
  const [primaryServiceTypeIds, setPrimaryServiceTypeIds] = useState<string[] | null>(null)
  const [superintendentServiceTypeIds, setSuperintendentServiceTypeIds] = useState<string[] | null>(null)
  const [fixtureTypes, setFixtureTypes] = useState<Array<{ id: string; name: string }>>([])
  const [bids, setBids] = useState<BidWithBuilder[]>([])
  /** False until the first `loadBids` settles (success or error) — the board's skeleton gate (J10-F8). */
  const [bidsLoaded, setBidsLoaded] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [lastContactFromEntries, setLastContactFromEntries] = useState<Record<string, string>>({})
  // Method entries only (v2.2413: notes are not contacts) — feeds the chase lenses.
  const [lastMethodContactFromEntries, setLastMethodContactFromEntries] = useState<Record<string, string>>({})
  const [bidGcRecipientsByBidId, setBidGcRecipientsByBidId] = useState<BidGcRecipientsMap>({})
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([])
  const [customerContactPersons, setCustomerContactPersons] = useState<CustomerContactPerson[]>([])
  const [estimatorUsers, setEstimatorUsers] = useState<EstimatorUser[]>([])
  // People|Robots board scope (v2.2500): ids of users flagged is_digital_twin. Loaded
  // without an archived filter — a bid assigned to a retired twin still belongs on the
  // Robot Board, not back among the humans.
  const [twinUserIds, setTwinUserIds] = useState<ReadonlySet<string>>(() => new Set())

  async function loadRole() {
    if (!authUserId) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role, estimator_service_type_ids, primary_service_type_ids, superintendent_service_type_ids')
      .eq('id', authUserId)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole; estimator_service_type_ids?: string[] | null; primary_service_type_ids?: string[] | null; superintendent_service_type_ids?: string[] | null } | null)?.role ?? null
    const estIds = (me as { estimator_service_type_ids?: string[] | null } | null)?.estimator_service_type_ids
    const primIds = (me as { primary_service_type_ids?: string[] | null } | null)?.primary_service_type_ids
    const supIds = (me as { superintendent_service_type_ids?: string[] | null } | null)?.superintendent_service_type_ids
    setMyRole(role)
    if (role === 'estimator' && estIds && estIds.length > 0) {
      setEstimatorServiceTypeIds(estIds)
    } else {
      setEstimatorServiceTypeIds(null)
    }
    if (role === 'primary' && primIds && primIds.length > 0) {
      setPrimaryServiceTypeIds(primIds)
    } else {
      setPrimaryServiceTypeIds(null)
    }
    if (role === 'superintendent' && supIds && supIds.length > 0) {
      setSuperintendentServiceTypeIds(supIds)
    } else {
      setSuperintendentServiceTypeIds(null)
    }
    if (!canOpenBids(role)) {
      setLoading(false)
      return
    }
  }

  async function loadEstimatorUsers() {
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('users')
            .select('id, name, email, role')
            .is('archived_at', null)
            .neq('role', 'helpers')
            .order('name', { ascending: true, nullsFirst: false }),
        'load estimator users for bids',
      )
      const rows = (data as EstimatorUser[]) ?? []
      setEstimatorUsers(
        rows.filter((u) => (u.name?.trim().toLowerCase() ?? '') !== 'delete'),
      )
    } catch {
      // Preserve prior silent failure: do not reject Promise.all callers or clear the list.
    }
  }

  async function loadTwinUserIds() {
    try {
      const data = await withSupabaseRetry(
        async () => supabase.from('users').select('id').eq('is_digital_twin', true),
        'load twin user ids for board scope',
      )
      const rows = (data as { id: string }[] | null) ?? []
      setTwinUserIds(new Set(rows.map((r) => r.id)))
    } catch {
      // Scope degrades to "everything is people" — the pre-scope behavior, never a crash.
    }
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, address, master_user_id, contact_info, archived_at')
      .or('customer_type.is.null,customer_type.eq.commercial')
      .order('name')
    if (error) {
      setError(`Failed to load customers: ${error.message}`)
      return
    }
    // Archived customers stay out of the GC picker and Builder Review roster;
    // bid rows render their customer via the embedded customers(*) join, so
    // existing archived links still display.
    setCustomers(filterActiveCustomersForPicker((data as Customer[]) ?? []))
  }

  async function loadServiceTypes() {
    const { data, error } = await supabase
      .from('service_types' as any)
      .select('*')
      .order('sequence_order', { ascending: true })
    
    if (error) {
      setError(`Failed to load service types: ${error.message}`)
      return
    }
    
    const types = (data as unknown as ServiceType[]) ?? []
    setServiceTypes(types)
    
    // For estimators/primaries/superintendents with restrictions, filter to allowed types
    const visibleTypes = (estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0)
      ? types.filter((st) => estimatorServiceTypeIds.includes(st.id))
      : (primaryServiceTypeIds && primaryServiceTypeIds.length > 0)
        ? types.filter((st) => primaryServiceTypeIds.includes(st.id))
        : (superintendentServiceTypeIds && superintendentServiceTypeIds.length > 0)
          ? types.filter((st) => superintendentServiceTypeIds.includes(st.id))
          : types
    // Fallback: if filter yields no types (e.g. stale primary_service_type_ids), use all
    const typesToUse = visibleTypes.length > 0 ? visibleTypes : types
    const defaultId = (() => {
      if (typesToUse.length === 1) return typesToUse[0]?.id
      const plumbing = typesToUse.find((st) => st.name === 'Plumbing')
      if (plumbing) return plumbing.id
      const electrical = typesToUse.find((st) => st.name === 'Electrical')
      if (electrical) return electrical.id
      return typesToUse[0]?.id
    })()
    if (defaultId) {
      setSelectedServiceTypeId((prev) => {
        if (!prev || !typesToUse.some((st) => st.id === prev)) return defaultId
        return prev
      })
    }
  }

  async function loadFixtureTypes() {
    if (!selectedServiceTypeId) return
    const { data, error } = await supabase
      .from('fixture_types')
      .select('id, name')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (!error && data) {
      setFixtureTypes(data)
    }
  }

  async function loadBids(serviceTypeId?: string | null): Promise<BidWithBuilder[]> {
    const sid = serviceTypeId === undefined ? selectedServiceTypeId : serviceTypeId
    let q = supabase
      .from('bids')
      .select('*, customers(*), bids_gc_builders(*), estimator:users!bids_estimator_id_fkey(id, name, email), account_manager:users!bids_account_manager_id_fkey(id, name, email), service_type:service_types(id, name, color)')
      // v2.2133: bids adopted into another bid's package leave every list (the row stays for history).
      .is('adopted_into_bid_id', null)
    if (sid) q = q.eq('service_type_id', sid)
    // Primary scoping (v2.2174): a primary's board is the bids they are estimator,
    // account manager, or creator on — the same predicate RLS now enforces
    // (primary_scope_* policies), stated here so the board filters on purpose.
    if (myRole === 'primary' && authUserId) {
      q = q.or(`estimator_id.eq.${authUserId},account_manager_id.eq.${authUserId},created_by.eq.${authUserId}`)
    }
    const { data, error } = await q.order('bid_due_date', { ascending: false, nullsFirst: true })
    if (error) {
      setError(`Failed to load bids: ${error.message}`)
      setBidsLoaded(true)
      return []
    }
    type Raw = Bid & {
      customers: Customer | Customer[] | null
      bids_gc_builders: GcBuilder | GcBuilder[] | null
      estimator?: EstimatorUser | EstimatorUser[] | null
      account_manager?: EstimatorUser | EstimatorUser[] | null
    }
    const raw = (data as unknown as Raw[]) ?? []
    const rows: BidWithBuilder[] = raw.map((b) => {
      const est = b.estimator
      const estimatorNorm = est == null ? null : Array.isArray(est) ? est[0] ?? null : est
      const am = b.account_manager
      const accountManagerNorm = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
      return {
        ...b,
        customers: Array.isArray(b.customers) ? b.customers[0] ?? null : b.customers,
        bids_gc_builders: Array.isArray(b.bids_gc_builders) ? b.bids_gc_builders[0] ?? null : b.bids_gc_builders,
        estimator: estimatorNorm,
        account_manager: accountManagerNorm,
      }
    })
    setBids(rows)
    setBidsLoaded(true)
    // Two recencies from one pass (v2.2413 rule): only METHOD entries are contacts (chase
    // lenses); any entry is activity (Followup "Last update"). Read for the bids in hand and
    // paged (lib/bids/bidEntryRecency); a failed read shows no recency, as it always did.
    const recency = await loadBidEntryRecency(supabase, rows.map((b) => b.id)).catch(() => ({ lastActivityByBid: {}, lastContactByBid: {} }))
    setLastContactFromEntries(recency.lastActivityByBid)
    setLastMethodContactFromEntries(recency.lastContactByBid)
    // Multi-GC recipients (empty map until the table deploys) — feeds the
    // Followup lenses and the board's +N chip.
    setBidGcRecipientsByBidId(await fetchBidGcRecipientsMap())
    return rows
  }

  async function loadCustomerContacts() {
    const { data, error } = await supabase
      .from('customer_contacts')
      .select('*')
      .order('contact_date', { ascending: false })
    if (error) {
      setError(`Failed to load customer contacts: ${error.message}`)
      return
    }
    setCustomerContacts((data as CustomerContact[]) ?? [])
  }

  async function loadCustomerContactPersons() {
    const { data, error } = await supabase
      .from('customer_contact_persons')
      .select('*')
      .order('name')
    if (error) {
      setError(`Failed to load contact persons: ${error.message}`)
      return
    }
    setCustomerContactPersons((data as CustomerContactPerson[]) ?? [])
  }

  return {
    myRole,
    serviceTypes,
    estimatorServiceTypeIds,
    primaryServiceTypeIds,
    superintendentServiceTypeIds,
    fixtureTypes,
    bids,
    setBids,
    bidsLoaded,
    customers,
    setCustomers,
    lastContactFromEntries,
    lastMethodContactFromEntries,
    bidGcRecipientsByBidId,
    customerContacts,
    customerContactPersons,
    estimatorUsers,
    twinUserIds,
    loadRole,
    loadServiceTypes,
    loadFixtureTypes,
    loadBids,
    loadCustomers,
    loadCustomerContacts,
    loadCustomerContactPersons,
    loadEstimatorUsers,
    loadTwinUserIds,
  }
}

export type BidsPageData = ReturnType<typeof useBidsPageData>

/** The three load effects, in the order they ran in the page. Call it where they stood. */
export function useBidsLoadGates(
  data: BidsPageData,
  input: {
    activeTab: BidsTabKey
    selectedServiceTypeId: string
    setLoading: (loading: boolean) => void
    /** The books the pricing engine loads with the page's data (takeoff, labor and price book versions, material templates). */
    loadBooks: () => Array<Promise<unknown>>
  },
) {
  const { activeTab, selectedServiceTypeId, setLoading, loadBooks } = input
  const {
    myRole,
    estimatorServiceTypeIds,
    primaryServiceTypeIds,
    superintendentServiceTypeIds,
    loadServiceTypes,
    loadFixtureTypes,
    loadBids,
    loadCustomers,
    loadCustomerContacts,
    loadCustomerContactPersons,
    loadEstimatorUsers,
    loadTwinUserIds,
  } = data

  useEffect(() => {
    if (canOpenBids(myRole)) {
      const load = async () => {
        try {
          // Load service types first
          await loadServiceTypes()
          await loadFixtureTypes()
        } finally {
          setLoading(false)
        }
      }
      load()
    }
  }, [myRole, estimatorServiceTypeIds, primaryServiceTypeIds, superintendentServiceTypeIds])
  
  // Reload data when service type changes (skip when Builder Review is active; that tab loads all data)
  useEffect(() => {
    if (selectedServiceTypeId && activeTab !== 'builder-review' && canOpenBids(myRole)) {
      const t = setTimeout(async () => {
        await Promise.all([loadCustomers(), loadBids(selectedServiceTypeId), loadCustomerContacts(), loadCustomerContactPersons(), loadEstimatorUsers(), loadTwinUserIds(), loadFixtureTypes(), ...loadBooks()])
      }, 80)
      return () => clearTimeout(t)
    }
  }, [selectedServiceTypeId, activeTab, myRole])

  // Load all customers and bids when Builder Review tab is active (no service type filter)
  useEffect(() => {
    if (activeTab === 'builder-review' && canOpenBids(myRole)) {
      const t = setTimeout(async () => {
        await Promise.all([
          loadCustomers(),
          loadBids(null), // load all bids (no service type filter)
          loadCustomerContacts(),
          loadCustomerContactPersons(),
          loadEstimatorUsers(),
          loadTwinUserIds(),
          loadFixtureTypes(),
          ...loadBooks(),
        ])
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, myRole])
}
