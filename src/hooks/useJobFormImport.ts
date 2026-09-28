/* eslint-disable react-hooks/exhaustive-deps -- the callbacks keep the dependency lists they had in the form; the setters are stable */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { formatPostgrestOrUnknownError, withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import type { UserRole } from './useAuth'
import { groupVersionsByGc, type GcPacket } from '../lib/bids/gcPackets'
import { latestSendByVersion, type VersionSendRow } from '../lib/bids/versionSends'
import { setGcPacketOutcome } from '../lib/bids/gcPacketOutcome'
import { bidBoardJobLinkLabel } from '../lib/bids/bidBoardJobLinks'
import { secondConversionMessage } from '../lib/bids/wonMomentActions'
import { bidImportCarry, bidImportCarryQuestion, bidImportEffectiveGc, bidImportFirstLine, bidImportGcOptions, bidImportLabel, bidImportWinWrite, decideBidImportGc } from '../lib/bids/jobImportFromBid'
import { estimateImportCustomerFields, estimateImportFixtureRows } from '../lib/jobs/jobImportFromEstimate'
import { visibleServiceTypesForJobForm } from '../lib/jobs/jobFormServiceTypes'
import { normalizeFormFixtureRows } from '../lib/jobs/jobFormFixtureHydrate'
import { normalizeEstimateLineItemsFromJson } from '../lib/estimateLineItemNormalize'
import { fixturesPayloadForCreateJobFromEstimate } from '../lib/createJobFromEstimateSubmit'
import type { JobBillToParty } from '../lib/jobs/billToParty'
import type { FixtureRow, JobFormServiceType, MeServiceTypeColumns } from '../lib/jobs/jobFormTypes'
import type { WinningGcOption } from '../components/jobs/PickWinningGcModal'
import type { JobBidLinkOption } from '../components/jobs/JobBidLinkChoiceModal'

type EstimatesRow = Database['public']['Tables']['estimates']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']

/** The winning-GC picker's open question: a bid with several GCs and no single recorded winner. */
export type JobImportWinningGcPick = {
  bidId: string
  bidName: string
  options: WinningGcOption[]
  writesWin: boolean
  bidOutcome: string | null
  packets: GcPacket[]
  /** The form was opened FOR this import (`openNewJob({ prefillBidId })`) — cancelling closes it instead of stranding a blank form. */
  closeOnCancel: boolean
}

export type JobFormImportArgs = {
  authUserId: string | undefined
  authRole: UserRole | null
  /** The form's customer cache — names come from it before the bid's own. */
  customers: CustomerRow[]
  serviceTypes: JobFormServiceType[]
  meServiceTypeColumns: MeServiceTypeColumns | null
  /** The picker's open pick — the form's: its Escape gate reads it. */
  winningGcPick: JobImportWinningGcPick | null
  setWinningGcPick: Dispatch<SetStateAction<JobImportWinningGcPick | null>>
  closeFormRef: MutableRefObject<(() => Promise<boolean>) | undefined>
  /** Set after a bid import so the imported rows are the discard guard's baseline. */
  newJobSnapshotArmedRef: MutableRefObject<boolean>
  setFixtures: Dispatch<SetStateAction<FixtureRow[]>>
  setFixtureScopeExpandedById: Dispatch<SetStateAction<Record<string, boolean>>>
  setSelectedSegmentIds: Dispatch<SetStateAction<Set<string>>>
  setBidId: Dispatch<SetStateAction<string | null>>
  setBids: Dispatch<SetStateAction<JobBidLinkOption[]>>
  setLinkedBidSummary: Dispatch<SetStateAction<{ project_name: string | null; bid_number: string | null; service_type_id?: string | null } | null>>
  setLinkedBidGc: Dispatch<SetStateAction<{ id: string; name: string } | null>>
  pickGcCustomerId: (v: SetStateAction<string | null>) => void
  setBillToParty: Dispatch<SetStateAction<JobBillToParty>>
  setFormServiceTypeId: Dispatch<SetStateAction<string>>
  setJobName: Dispatch<SetStateAction<string>>
  setJobAddress: Dispatch<SetStateAction<string>>
  setGoogleDriveLink: Dispatch<SetStateAction<string>>
  setJobPlansLink: Dispatch<SetStateAction<string>>
  setCustomerId: Dispatch<SetStateAction<string | null>>
  setCustomers: Dispatch<SetStateAction<CustomerRow[]>>
  setCustomerName: Dispatch<SetStateAction<string>>
  setCustomerEmail: Dispatch<SetStateAction<string>>
  setCustomerPhone: Dispatch<SetStateAction<string>>
  setDateMet: Dispatch<SetStateAction<string>>
}

export type JobFormImport = {
  cancelBidImport: (closeTheForm: boolean, message: string) => void
  applyPrefillFromBid: (bidRowId: string, forcedGc?: WinningGcOption, opts?: { closeOnCancel?: boolean }) => Promise<void>
  handleWinningGcPick: (opt: WinningGcOption) => Promise<void>
  applyPrefillFromEstimate: (estimateId: string) => Promise<void>
}

/**
 * New Job's imports, out of `JobFormModal` whole (the Job form map's order #7): a bid or an
 * estimate fills the form. The reads, the two questions, the picker and the writes are the
 * form's own text, with the dependency lists they had; what they decide is
 * `lib/bids/jobImportFromBid` and `lib/jobs/jobImportFromEstimate`. The form hands in its
 * setters and keeps every field.
 */
export function useJobFormImport(args: JobFormImportArgs): JobFormImport {
  const {
    authUserId,
    authRole,
    customers,
    serviceTypes,
    meServiceTypeColumns,
    winningGcPick,
    setWinningGcPick,
    closeFormRef,
    newJobSnapshotArmedRef,
    setFixtures,
    setFixtureScopeExpandedById,
    setSelectedSegmentIds,
    setBidId,
    setBids,
    setLinkedBidSummary,
    setLinkedBidGc,
    pickGcCustomerId,
    setBillToParty,
    setFormServiceTypeId,
    setJobName,
    setJobAddress,
    setGoogleDriveLink,
    setJobPlansLink,
    setCustomerId,
    setCustomers,
    setCustomerName,
    setCustomerEmail,
    setCustomerPhone,
    setDateMet,
  } = args
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()

  /**
   * Tier-1 #8 (J15-F4): an abandoned bid import never strands a blank form — say what happened, and
   * when this form was opened only for the import, close it too.
   */
  const cancelBidImport = useCallback(
    (closeTheForm: boolean, message: string) => {
      showToast(message, 'info')
      if (closeTheForm) void closeFormRef.current?.()
    },
    [showToast],
  )

  const applyPrefillFromBid = useCallback(
    async (bidRowId: string, forcedGc?: WinningGcOption, opts?: { closeOnCancel?: boolean }) => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            await supabase
              .from('bids')
              .select(
                'id, project_name, bid_number, service_type_id, customer_id, address, drive_link, plans_link, outcome, bid_date_sent, agreed_value, customers(name, address, contact_info, date_met)',
              )
              .eq('id', bidRowId)
              .maybeSingle(),
          'job form import bid',
        )
        if (!row) {
          showToast('Bid not found.', 'error')
          return
        }
        const b = row as {
          id: string
          project_name: string | null
          bid_number: string | null
          service_type_id: string | null
          customer_id: string | null
          address: string | null
          drive_link: string | null
          plans_link: string | null
          outcome: string | null
          bid_date_sent: string | null
          agreed_value: number | string | null
          customers: {
            name: string
            address: string | null
            contact_info: unknown
            date_met: string | null
          } | null
        }
        // Tier-1 #8: warn on a second conversion. First pass only — the picker's pick re-enters
        // with `forcedGc` after this check already ran. Fail-soft: a role that cannot read jobs sees no warning.
        if (!forcedGc) {
          const { data: existingRows } = await supabase
            .from('jobs_ledger')
            .select('id, hcp_number, created_at')
            .eq('bid_id', b.id)
            .order('created_at', { ascending: false })
            .limit(5)
          const existing = ((existingRows ?? []) as Array<{ id: string; hcp_number: string | null }>).map((r) => ({ jobId: r.id, hcpNumber: r.hcp_number ?? '' }))
          if (existing.length > 0) {
            const bidLabel = bidImportLabel(b, 'this bid')
            const ok = await confirmDialog({
              title: 'A job already exists from this bid',
              message: secondConversionMessage(existing, bidLabel),
              confirmLabel: 'Create another job',
              cancelLabel: 'Cancel',
            })
            if (!ok) {
              cancelBidImport(!!opts?.closeOnCancel, `Nothing created — ${bidBoardJobLinkLabel(existing[0]!.hcpNumber)} is on the bid's Job block.`)
              return
            }
          }
        }
        // Per-GC Phase 3: on a multi-GC bid, the job's GC is the WINNING packet's — one recorded
        // winner imports silently; otherwise ask once (the pick records the Won when undecided).
        let chosen: WinningGcOption | null = forcedGc ?? null
        // The dollar figure the bid was sent for (winner's packet, or the lone packet) — offered
        // below, never written on its own (v2.2909, J15-F8).
        let sentValue: number | null = forcedGc?.value ?? null
        if (!chosen) {
          const [vRes, sRes, rRes] = await Promise.all([
            supabase.from('bid_versions').select('id, name, customer_id, sort_order, created_at, outcome').eq('bid_id', b.id).order('sort_order'),
            supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', b.id),
            supabase.from('bid_gc_recipients').select('customer_id, customers(name)').eq('bid_id', b.id),
          ])
          const versions = (vRes.data ?? []) as Array<{ id: string; name: string; customer_id: string | null; sort_order: number; created_at: string | null; outcome: string | null }>
          const gcIds = [...new Set(versions.map((v) => v.customer_id).filter((x): x is string => !!x))]
          let gcNames: Record<string, string> = {}
          if (gcIds.length > 0) {
            const { data } = await supabase.from('customers').select('id, name').in('id', gcIds)
            gcNames = Object.fromEntries(((data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]))
          }
          const recipients = ((rRes.data ?? []) as Array<{ customer_id: string; customers: { name: string } | null }>).map((r) => ({ customerId: r.customer_id, name: r.customers?.name ?? '…' }))
          const packets = groupVersionsByGc(versions, {
            bidGcName: b.customers?.name ?? null,
            gcNames,
            latestSends: latestSendByVersion((sRes.data ?? []) as VersionSendRow[]),
            bidDateSent: b.bid_date_sent ?? null,
            recipients,
          })
          // A bid with recipients but no versions has no own packet — the bid's GC is still a choice.
          const options: WinningGcOption[] = bidImportGcOptions({
            packets,
            bidCustomerId: b.customer_id,
            cachedBidGcName: customers.find((c) => c.id === b.customer_id)?.name,
            embeddedBidGcName: b.customers?.name,
            bidDateSent: b.bid_date_sent ?? null,
          })
          const decision = decideBidImportGc(packets, options)
          if (decision.kind === 'ask') {
            setWinningGcPick({
              bidId: b.id,
              bidName: (b.project_name ?? '').trim() || (b.bid_number ?? 'This bid'),
              options,
              writesWin: decision.writesWin,
              bidOutcome: b.outcome ?? null,
              packets,
              closeOnCancel: !!opts?.closeOnCancel,
            })
            return
          }
          chosen = decision.chosen
          sentValue = decision.sentValue
        }
        // Tier-3 B5 (J15-F8): the job used to open at $0.00 while `agreed_value` was back-filled
        // onto the bid behind the office's back. Now one question: carry the figure over as the
        // job's first line item (and, when the bid has no agreed value yet, record it there too)
        // or start at $0 — and "No" writes nothing anywhere.
        const { agreedValue, carryValue } = bidImportCarry({ agreedValueRaw: b.agreed_value, sentValue })
        if (carryValue != null) {
          const carry = await confirmDialog(bidImportCarryQuestion({ carryValue, agreedValue, bid: b, gcName: chosen?.name ?? b.customers?.name }))
          if (carry) {
            setFixtures([{ id: crypto.randomUUID(), ...bidImportFirstLine({ carryValue, agreedValue, bid: b }) }])
            setFixtureScopeExpandedById({})
            if (agreedValue == null) {
              // Conditional carry (`.is('agreed_value', null)`): zero rows is the expected already-set case, not a refused write — no guard on purpose.
              void supabase.from('bids').update({ agreed_value: carryValue }).eq('id', b.id).is('agreed_value', null).then(() => undefined)
            }
          }
        }
        setBidId(b.id)
        setJobName((b.project_name ?? '').trim())
        setJobAddress((b.address ?? '').trim())
        setLinkedBidSummary({
          project_name: b.project_name,
          bid_number: b.bid_number,
          service_type_id: b.service_type_id ?? null,
        })
        setBids((prev) => {
          if (prev.some((x) => x.id === b.id)) return prev
          const opt: JobBidLinkOption = {
            id: b.id,
            project_name: b.project_name,
            bid_number: b.bid_number,
            customer_id: b.customer_id,
            customers: b.customers ? { name: b.customers.name } : null,
            service_type_id: b.service_type_id ?? null,
          }
          return [opt, ...prev]
        })
        const vis = visibleServiceTypesForJobForm(serviceTypes, meServiceTypeColumns)
        const allowed = new Set(vis.map((s) => s.id))
        if (b.service_type_id && allowed.has(b.service_type_id)) {
          setFormServiceTypeId(b.service_type_id)
        } else if (b.service_type_id) {
          showToast('Bid trade is not available for your role in this form; choose a service type.', 'info')
        }
        // Creating a job FROM a bid: the WINNING GC is the job's GC (per-GC Phase 3; the bid's own
        // GC when there's only one — the v2.1182 rule, now packet-aware).
        const effGc = bidImportEffectiveGc({
          chosen,
          bidCustomerId: b.customer_id,
          embeddedBidGcName: b.customers?.name,
          cachedNameOf: (id) => customers.find((c) => c.id === id)?.name,
        })
        const effGcId = effGc?.id ?? null
        setLinkedBidGc(effGc)
        // v2.3403: the GC is the GC, never also the customer. A job born from a
        // won bid is a GC job — its bills go to the GC — and the customer link
        // stays whatever the office set (usually nothing yet).
        pickGcCustomerId(effGcId ?? null)
        if (effGcId) setBillToParty('gc')
        setGoogleDriveLink((prev) => (prev.trim() ? prev : (b.drive_link ?? '').trim()))
        setJobPlansLink((prev) => (prev.trim() ? prev : (b.plans_link ?? '').trim()))
        showToast('Imported from bid.', 'success')
        // The import is the new baseline for the discard guard, not the user's typing.
        newJobSnapshotArmedRef.current = true
      } catch (e) {
        showToast(formatPostgrestOrUnknownError(e, 'Could not load bid'), 'error')
      }
    },
    [customers, meServiceTypeColumns, serviceTypes, showToast, confirmDialog, cancelBidImport],
  )

  const handleWinningGcPick = useCallback(
    async (opt: WinningGcOption) => {
      const pick = winningGcPick
      setWinningGcPick(null)
      if (!pick) return
      if (pick.writesWin && !opt.sharedLetter) {
        const write = bidImportWinWrite(pick.packets, opt.key)
        if (write) {
          // Tier-2 #21: the picker's sentence IS the confirm; the write snapshots the cascade so "↩ waiting" on the bid can undo it.
          const res = await setGcPacketOutcome({ bidId: pick.bidId, bidOutcome: pick.bidOutcome, versionIds: write.versionIds, outcome: 'won', packetsAfter: write.packetsAfter, previousOutcome: write.previousOutcome, actor: { userId: authUserId, role: authRole, path: 'job-import' } })
          if (res.error) {
            showToast(res.error, 'error')
          } else {
            window.dispatchEvent(new CustomEvent('bid-gc-outcome-changed', { detail: { bidId: pick.bidId } }))
            showToast(
              res.autoLost.length > 0
                ? `${opt.name} marked won on the bid — ${res.autoLost.join(', ')} marked lost (GC lost the project).`
                : `${opt.name} marked won on the bid.`,
              'success',
            )
          }
          // The packet's value is offered (not back-filled) inside applyPrefillFromBid — v2.2909, J15-F8.
        }
      } else if (opt.sharedLetter && opt.key.startsWith('shared:')) {
        showToast(`${opt.name} rode the shared letter — nothing recorded on the bid.`, 'info')
      }
      void applyPrefillFromBid(pick.bidId, opt)
    },
    [winningGcPick, applyPrefillFromBid, showToast],
  )

  const applyPrefillFromEstimate = useCallback(
    async (estimateId: string) => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            await supabase
              .from('estimates')
              .select('id, customer_id, for_address, title, line_items_snapshot, job_ledger_id, customer_email')
              .eq('id', estimateId)
              .maybeSingle(),
          'job form import estimate',
        )
        if (!row) {
          showToast('Estimate not found.', 'error')
          return
        }
        const e = row as Pick<
          EstimatesRow,
          'id' | 'customer_id' | 'for_address' | 'title' | 'line_items_snapshot' | 'job_ledger_id' | 'customer_email'
        >
        if (e.job_ledger_id) {
          showToast('This estimate is already linked to a job.', 'warning')
          return
        }
        setBidId(null)
        setLinkedBidSummary(null)
        setLinkedBidGc(null)
        setJobName((e.title ?? '').trim())
        setJobAddress((e.for_address ?? '').trim())
        const lines = normalizeEstimateLineItemsFromJson(e.line_items_snapshot)
        const payload = fixturesPayloadForCreateJobFromEstimate(lines)
        const nextFixtures: FixtureRow[] = estimateImportFixtureRows(payload, () => crypto.randomUUID())
        // A change order's credit lines arrive negative (v2.1829) — they are
        // discount rows here, not work rows the autosave would null.
        setFixtures(normalizeFormFixtureRows(nextFixtures))
        setFixtureScopeExpandedById({})
        setSelectedSegmentIds(new Set())
        const estimateCustomerId = e.customer_id
        if (estimateCustomerId) {
          setCustomerId(estimateCustomerId)
          let cList = customers.find((c) => c.id === estimateCustomerId)
          if (!cList) {
            const fetched = await withSupabaseRetry(
              async () =>
                await supabase
                  .from('customers')
                  .select('id, name, address, contact_info, billing_email, gc_pays_by_default, sees_customer_bills, date_met, date_met_source, master_user_id, customer_type, archived_at')
                  .eq('id', estimateCustomerId)
                  .maybeSingle(),
              'job form import estimate customer',
            )
            if (fetched) {
              cList = fetched as CustomerRow
              setCustomers((prev) => (prev.some((c) => c.id === cList!.id) ? prev : [...prev, cList!]))
            }
          }
          const fields = estimateImportCustomerFields(cList, e.customer_email)
          setCustomerName(fields.customerName)
          setCustomerEmail(fields.customerEmail)
          setCustomerPhone(fields.customerPhone)
          setDateMet(fields.dateMet)
        } else {
          setCustomerId(null)
          const fields = estimateImportCustomerFields(null, e.customer_email)
          setCustomerName(fields.customerName)
          setCustomerEmail(fields.customerEmail)
          setCustomerPhone(fields.customerPhone)
          setDateMet(fields.dateMet)
        }
        showToast('Imported from estimate.', 'success')
      } catch (err) {
        showToast(formatPostgrestOrUnknownError(err, 'Could not load estimate'), 'error')
      }
    },
    [customers, showToast],
  )

  return { cancelBidImport, applyPrefillFromBid, handleWinningGcPick, applyPrefillFromEstimate }
}
