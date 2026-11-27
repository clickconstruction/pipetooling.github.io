import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { assignedNamesLabel, buildSubsHqRows, groupUnattributedSheets, type SubsHqResult, type UnattributedGroup } from '../../lib/people/subsHqRows'
import { suggestSubSheetAssignee } from '../../lib/people/subSheetNameSuggestion'
import type { ComplianceBadge } from '../../lib/people/subCompliance'
import { parseSubWorkOrderSnapshot } from '../../lib/subWorkOrders/subWorkOrder'
import SubPortalGlobeButton from './SubPortalGlobeButton'
import { useOptionalPersonDesk } from '../../contexts/PersonDeskContext'
import { appendNoteLine, backNoteLine, benchNoteLine, compareSubsForBench, subBenchStatus, type SubBenchStatus } from '../../lib/people/subBench'
import { useAuth } from '../../hooks/useAuth'
import { isOfficeRole } from '../../lib/doorRoles'
import { SubDocumentAddForm } from './SubDocumentAddForm'
import { FinishedDateInput } from '../FinishedDateInput'
import { SUB_DOCUMENT_TYPE_LABEL, suggestedRetype } from '../../lib/people/subDocumentDraft'
import { EmptyState } from '../EmptyState'
import { subsRosterEmptyWords } from '../../lib/people/peopleEmptyWords'
import { SKY_UNDER_WORDS, WORDS_ON_SKY } from '../../lib/skyUnderWords'
import { PeopleSubsLedger } from './PeopleSubsLedger'
import { creditNoteWords } from '../../lib/subWorkOrders/subSending'
import { useSubLaborLedger } from '../../hooks/useSubLaborLedger'
import { useSubsOwed } from '../../hooks/useSubsOwed'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { buildSubOwedBreakdown, owedCsv, owedCsvFileName, owedMoney, owedPersonById, owedPersonMatches, owedTiles, owedUnderFigure, owedView, OWED_SORTS, OWED_SORT_LABEL, type OwedPerson, type OwedSort } from '../../lib/people/subOwedBreakdown'
import { subLaborJobBalance } from '../../lib/subLaborOutstanding'
import { sheetOwedToChip, TEAM_SHEET_RULE, teamSheetsLineWords, type TeamSheetRule } from '../../lib/subWorkOrders/teamSheetRule'
import { isRosterSub } from '../../lib/subWorkOrders/rosterSub'
import { WE_OWE_NOTHING } from '../../lib/subWorkOrders/subPaymentsLedger'
import { SubOwedBlock } from './SubOwedBlock'
import { SubPapersWindow } from '../jobs/SubPapersWindowConnected'
import type { SubPapersOpen } from '../jobs/SubPapersWindow'
import { PeopleSubsReach } from './PeopleSubsReach'
import SubLaborPaymentModals, { type SubLaborPaymentModalsHandle } from '../jobs/SubLaborPaymentModals'
import { ScheduleSheet } from '../schedule/ScheduleBlockSheet'
import { WhoseSheetWindow } from './WhoseSheetWindow'
import { RideAlongCleanUpWindow } from './RideAlongCleanUpWindow'
import { rideAlongCleanUp, rideAlongOfferWords } from '../../lib/subWorkOrders/rideAlongCleanUp'
import { sheetLabel } from '../../lib/jobs/subPaymentMoveRemove'
import { saveBlobAs } from '../../lib/storageSave'
import { MoneyText } from '../Money'

/**
 * People → Subs: one row per subcontractor relationship (RUN_SUBS_PLAN
 * Phase 3, PR 3.4 — Option C of the approved mockups). Merges the roster,
 * junction-attributed sub-sheet balances (identity-plan C1-7 for this
 * surface), open work orders, compliance badges, and a simple track record.
 * Self-contained: loads everything itself under the caller's RLS.
 *
 * The per-sub Documents expander is the compliance micro-editor: set a
 * document's type and expiry here (writes person_contract_documents
 * directly), or file a new COI / W-9 / license with "+ Add document"
 * (SubDocumentAddForm — the same door Person Desk → Paperwork mounts;
 * journey-map Tier-2 #33). Sending/signing stays on the Contracts tab.
 * doc_type is NOT NULL DEFAULT 'agreement' in the DB, so rows the Contracts
 * tab mints arrive typed as the Agreement; a row whose name says COI/W-9/
 * license but whose type is still that default gets a one-tap retype hint.
 *
 * The "Unattributed sheets" panel at the top surfaces sheets the junction
 * resolves to no one or to several people, grouped per (job, raw name), with
 * Open → (deep link to Jobs → Sub Labor by sheet id), an Assign… roster
 * picker, and a conservative one-tap suggestion (subSheetNameSuggestion).
 */

type DocRow = {
  id: string
  document_name: string
  applied_contract_template_document_id?: string | null
  applied_version_date?: string | null
  doc_type: string
  status: string
  expires_at: string | null
  person_id: string | null
  person_name: string | null
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const BADGE_STYLE: Record<ComplianceBadge['state'], { background: string; color: string }> = {
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-600)' },
  expiring: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  expired: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
  missing: { background: 'var(--bg-neutral-100)', color: 'var(--text-muted)' },
}

const DOC_TYPES = ['agreement', 'coi', 'w9', 'license', 'other'] as const

/** Roster fields the bench reads (v2.2853): dates, notes, and when the row was added. */
type BenchMeta = { startDate: string | null; endDate: string | null; notes: string | null; createdYmd: string | null }

type BenchFilter = 'owed' | 'active' | 'bench' | 'all'

const DOT: Record<SubBenchStatus['tone'], string> = { green: '#22c55e', amber: '#f59e0b', gray: '#94a3b8' }
/** Mirrors the `person_contract_documents` INSERT policy: is_dev / is_master_or_dev / is_assistant (assistant or controller since v2.714). */
const CAN_ADD_DOCUMENT_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])

/** `onOpenHire` opens People's Hire window on Subcontractor, the empty roster's press (punch list #184, sweep C); absent for a viewer who adds nobody. */
export default function PeopleSubsTab({ onOpenHire }: { onOpenHire?: () => void } = {}) {
  const navigate = useNavigate()
  // v2.7231 (punch list #347, PR 3): Roster | Ledger. The Ledger is what was paid to each sub, and one sub's
  // statement, at `/people?tab=subs&view=ledger` (`&sub=<people id>` for one person).
  const [searchParams, setSearchParams] = useSearchParams()
  const subsView: 'roster' | 'ledger' = searchParams.get('view') === 'ledger' ? 'ledger' : 'roster'
  const setSubsView = (view: 'roster' | 'ledger') =>
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      if (view === 'ledger') next.set('view', 'ledger')
      else {
        next.delete('view')
        next.delete('sub')
      }
      return next
    })
  const personDesk = useOptionalPersonDesk()
  const { role, readOnly, user, profileName } = useAuth()
  const narrow = useIsNarrowScreen()
  const canAddDocument = !readOnly && role != null && CAN_ADD_DOCUMENT_ROLES.has(role)
  const [result, setResult] = useState<SubsHqResult | null>(null)
  /** v2.7235: each sub's credit, the sum of their `sub_credit_entries`. Empty until that table exists. */
  const [creditByPersonId, setCreditByPersonId] = useState<Map<string, number>>(new Map())
  const [docsByPerson, setDocsByPerson] = useState<Record<string, DocRow[]>>({})
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [addingDocForPersonId, setAddingDocForPersonId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingDocId, setSavingDocId] = useState<string | null>(null)
  /** Active sub roster — exactly the population buildSubsHqRows attributes against. */
  const [roster, setRoster] = useState<Array<{ id: string; name: string; benched: boolean }>>([])
  const [assignPickerKey, setAssignPickerKey] = useState<string | null>(null)
  const [assignSavingKey, setAssignSavingKey] = useState<string | null>(null)
  const [showAllUnattributed, setShowAllUnattributed] = useState(false)
  const [benchMeta, setBenchMeta] = useState<Record<string, BenchMeta>>({})
  const [benchFilter, setBenchFilter] = useState<BenchFilter>('active')
  /** The row whose inline Bench… form is open, with its draft. */
  const [benchForm, setBenchForm] = useState<{ personId: string; date: string; reason: string } | null>(null)
  const [benchSavingId, setBenchSavingId] = useState<string | null>(null)
  const [todayYmd, setTodayYmd] = useState(() => calendarYmdInAppTzFromIso(new Date().toISOString()))
  // Punch list #346: what makes up each Balance due. The sheets come through the Jobs page's own hook, the one the
  // Ledger view reads, so a payment recorded from an open row lands exactly as it does on Jobs → Subs → Pay.
  const [owedError, setOwedError] = useState<string | null>(null)
  const ledger = useSubLaborLedger({ authUserId: user?.id, authUserName: profileName, setError: setOwedError })
  const loadLedger = ledger.loadLaborJobs
  useEffect(() => {
    if (user?.id) void loadLedger()
    // `loadLaborJobs` is made new on every render: the signed-in person is what the read depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  // Taunya's rule of 2026-11-15: a sheet that names one teammate and no sub is owed to that teammate.
  const teamRule: TeamSheetRule = TEAM_SHEET_RULE
  /** Punch list #350: the papers window, from an open row's Statement of account… or a sheet's Work statement…. */
  const [papers, setPapers] = useState<{ key: string; name: string; open: SubPapersOpen } | null>(null)
  const owed = useSubsOwed(ledger.laborJobs, ledger.laborJobAssigneesByJobId, teamRule)
  const breakdown = useMemo(() => buildSubOwedBreakdown(owed.inputs, { rule: teamRule }), [owed.inputs, teamRule])
  const owedReady = ledger.laborJobsLoadedOnce && owed.ready
  // Punch list #346: the subs' sheets that also name a teammate, and the window that takes the teammates off.
  const rideAlongs = useMemo(
    () =>
      rideAlongCleanUp(
        owed.inputs.map((i) => {
          const bal = subLaborJobBalance(i.sheet)
          return { id: i.sheet.id, label: sheetLabel(i.sheet, ledger.laborJobNamesByJobId), day: (i.sheet.job_date ?? '').slice(0, 10) || (i.sheet.created_at ?? '').slice(0, 10), parties: i.parties, total: bal.totalCost, open: Math.max(0, bal.balance) }
        }),
      ),
    [owed.inputs, ledger.laborJobNamesByJobId],
  )
  const rideAlongLine = owedReady ? rideAlongOfferWords(rideAlongs) : ''
  const [rideAlongOpen, setRideAlongOpen] = useState(false)
  const tiles = useMemo(() => owedTiles(breakdown), [breakdown])
  /** Teammates with a row on this roster: kind `sub` behind a team login. The login's role, by people id. */
  const teammateRoleById = useMemo(() => new Map(owed.roster.filter((p) => p.kind === 'sub' && !isRosterSub(p)).map((p) => [p.id, (p.accountRole ?? '').replace(/_/g, ' ')] as const)), [owed.roster])
  /** The row whose Balance due is open, by the breakdown's key (`id:<people id>`). */
  const [owedOpenKey, setOwedOpenKey] = useState<string | null>(() => (searchParams.get('owed') ? `id:${searchParams.get('owed')}` : null))
  const [subSearch, setSubSearch] = useState('')
  const [owedSort, setOwedSort] = useState<OwedSort>('owed')
  const paymentModalsRef = useRef<SubLaborPaymentModalsHandle>(null)
  /** On a phone the roster is cards. The six-column table is one press away, for the bench and the documents. */
  const [phoneTable, setPhoneTable] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const [peopleRes, usersRes, sheetsRes, assigneesRes, commitmentsRes, docsRes] = await Promise.all([
      // v2.7169: the whole roster and every login's role, the two lists the Pay view reads, so a teammate on a
      // sub's sheet is told from a second sub. The rows of this page are still the kind `sub` people alone.
      supabase.from('people').select('id, name, kind, archived_at, account_user_id, start_date, end_date, notes, created_at').limit(1000),
      supabase.from('users').select('id, name, email, role').limit(1000),
      supabase.from('people_labor_jobs').select('id, assigned_to_name, address, job_number, labor_rate, job_date, paid_at'),
      supabase.from('people_labor_job_assignees').select('labor_job_id, person_id'),
      supabase.from('step_commitments').select('person_id, amount, status, step_id, labor_job_id, offer_scope_snapshot, accepted_at'),
      supabase
        .from('person_contract_documents')
        .select('id, document_name, doc_type, status, expires_at, person_id, person_name, applied_contract_template_document_id, applied_version_date'),
    ])
    // v2.2790: the Book's General Conditions for subs (audience = 'sub'), for the Gen. Cond. pill.
    const { data: subBookDocs } = await supabase
      .from('contract_template_documents')
      .select('id, document_name, book_version_date')
      .eq('audience', 'sub')
      .is('flow_kind', null)
      .order('sequence_order', { ascending: true })
    const gcDoc =
      ((subBookDocs ?? []) as Array<{ id: string; document_name: string; book_version_date: string | null }>).find((d) => /general conditions/i.test(d.document_name)) ??
      ((subBookDocs ?? []) as Array<{ id: string; document_name: string; book_version_date: string | null }>)[0] ??
      null
    const firstError = peopleRes.error ?? usersRes.error ?? sheetsRes.error ?? assigneesRes.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    const sheetRows = (sheetsRes.data ?? []) as Array<{ id: string; assigned_to_name: string; address: string; job_number: string | null; labor_rate: number | null; job_date?: string | null; paid_at?: string | null }>
    const sheetIds = sheetRows.map((s) => s.id)
    let itemsByJob = new Map<string, Array<{ fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean; labor_rate?: number | null; direct_labor_amount?: number | null }>>()
    let paymentsByJob = new Map<string, Array<{ id: string; amount: number; memo: string | null; created_at: string }>>()
    // v2.7235: the credit ledger. A refused read means migration 20261114020000 is not pushed yet: nobody has a credit.
    {
      const creditsRes = await supabase.from('sub_credit_entries' as never).select('person_id, amount')
      const credits = new Map<string, number>()
      for (const r of ((creditsRes as { data: unknown[] | null }).data ?? []) as Array<{ person_id: string; amount: number | string }>) {
        credits.set(r.person_id, Math.round(((credits.get(r.person_id) ?? 0) + (Number(r.amount) || 0)) * 100) / 100)
      }
      setCreditByPersonId(credits)
    }
    if (sheetIds.length > 0) {
      const [itemsRes, paymentsRes] = await Promise.all([
        supabase.from('people_labor_job_items').select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount').in('job_id', sheetIds),
        supabase.from('people_labor_job_payments').select('id, job_id, amount, memo, created_at').in('job_id', sheetIds),
      ])
      itemsByJob = new Map()
      for (const it of (itemsRes.data ?? []) as Array<{ job_id: string; fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean; labor_rate?: number | null; direct_labor_amount?: number | null }>) {
        ;(itemsByJob.get(it.job_id) ?? itemsByJob.set(it.job_id, []).get(it.job_id)!).push(it)
      }
      paymentsByJob = new Map()
      for (const p of (paymentsRes.data ?? []) as Array<{ id: string; job_id: string; amount: number; memo: string | null; created_at: string }>) {
        ;(paymentsByJob.get(p.job_id) ?? paymentsByJob.set(p.job_id, []).get(p.job_id)!).push({ id: p.id, amount: Number(p.amount), memo: p.memo, created_at: p.created_at })
      }
    }

    // Commitments enriched with step/project names (fail-soft pre-migration).
    const commitmentRows = commitmentsRes.error
      ? []
      : ((commitmentsRes.data ?? []) as Array<{ person_id: string; amount: number; status: string; step_id: string | null; labor_job_id: string | null; offer_scope_snapshot: unknown; accepted_at?: string | null }>)
    const stepInfo = new Map<string, { stepName: string; projectName: string | null }>()
    const sheetLabelById = new Map(sheetRows.map((sh) => [sh.id, [sh.job_number, sh.address].filter(Boolean).join(' · ') || sh.assigned_to_name]))
    if (commitmentRows.some((c) => c.step_id)) {
      const stepIds = [...new Set(commitmentRows.map((c) => c.step_id).filter((id): id is string => !!id))]
      const { data: stepRows } = await supabase
        .from('project_workflow_steps')
        .select('id, name, project_workflows(projects(name))')
        .in('id', stepIds)
      for (const s of (stepRows ?? []) as Array<{ id: string; name: string; project_workflows: { projects: { name: string } | { name: string }[] | null } | { projects: { name: string } | { name: string }[] | null }[] | null }>) {
        const wf = Array.isArray(s.project_workflows) ? s.project_workflows[0] : s.project_workflows
        const proj = wf ? (Array.isArray(wf.projects) ? wf.projects[0] : wf.projects) : null
        stepInfo.set(s.id, { stepName: s.name, projectName: proj?.name ?? null })
      }
    }

    const docRows = docsRes.error ? [] : ((docsRes.data ?? []) as DocRow[])
    const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
    setTodayYmd(todayYmd)

    type RosterRow = { id: string; name: string; kind: string; archived_at: string | null; account_user_id: string | null; start_date?: string | null; end_date?: string | null; notes?: string | null; created_at?: string | null }
    const everyone = (peopleRes.data ?? []) as RosterRow[]
    const subPeople = everyone.filter((p) => p.kind === 'sub')
    const allUsers = (usersRes.data ?? []) as Array<{ id: string; name: string | null; email: string | null; role: string | null }>
    const roleByUserId = new Map(allUsers.map((u) => [u.id, u.role]))

    const meta: Record<string, BenchMeta> = {}
    for (const p of subPeople) {
      meta[p.id] = {
        startDate: p.start_date ?? null,
        endDate: p.end_date ?? null,
        notes: p.notes ?? null,
        createdYmd: p.created_at ? calendarYmdInAppTzFromIso(p.created_at) : null,
      }
    }
    setBenchMeta(meta)

    const activeRoster = subPeople
      .filter((p) => !p.archived_at)
      .map((p) => ({ id: p.id, name: p.name, benched: !!p.end_date }))
      .sort((a, b) => a.name.localeCompare(b.name))
    setRoster(activeRoster)

    setResult(
      buildSubsHqRows({
        people: subPeople.map((p) => ({
          id: p.id,
          name: p.name,
          archived: !!p.archived_at,
          accountUserId: p.account_user_id,
        })),
        users: allUsers.filter((u) => u.role === 'subcontractor'),
        roster: everyone.map((p) => ({ id: p.id, name: p.name, kind: p.kind, accountRole: p.account_user_id ? (roleByUserId.get(p.account_user_id) ?? null) : null })),
        sheets: sheetRows.map((s) => ({
          id: s.id,
          label: [s.job_number, s.address].filter(Boolean).join(' · ') || s.assigned_to_name,
          assignedToName: s.assigned_to_name,
          jobNumber: s.job_number,
          labor_rate: s.labor_rate,
          items: itemsByJob.get(s.id) ?? [],
          payments: paymentsByJob.get(s.id) ?? [],
          jobDateYmd: s.job_date ?? null,
          paidAtYmd: s.paid_at ? calendarYmdInAppTzFromIso(s.paid_at) : null,
        })),
        assignees: (assigneesRes.data ?? []) as Array<{ labor_job_id: string; person_id: string }>,
        commitments: commitmentRows.map((c) => ({
          person_id: c.person_id,
          amount: Number(c.amount),
          status: c.status,
          stepName: c.step_id ? stepInfo.get(c.step_id)?.stepName ?? null : null,
          projectName: c.step_id ? stepInfo.get(c.step_id)?.projectName ?? null : null,
          sheetLabel: !c.step_id && c.labor_job_id ? parseSubWorkOrderSnapshot(c.offer_scope_snapshot).sheetLabel ?? sheetLabelById.get(c.labor_job_id) ?? 'Sub sheet' : null,
          acceptedAtYmd: c.accepted_at ? calendarYmdInAppTzFromIso(c.accepted_at) : null,
          laborJobId: c.labor_job_id ?? null,
        })),
        docs: docRows.map((d) => ({
          person_id: d.person_id,
          person_name: d.person_name,
          doc_type: d.doc_type,
          status: d.status,
          expires_at: d.expires_at ?? null,
          applied_contract_template_document_id: d.applied_contract_template_document_id ?? null,
          applied_version_date: d.applied_version_date ?? null,
          document_name: d.document_name,
        })),
        todayYmd,
        generalConditions: gcDoc ? { documentId: gcDoc.id, documentName: gcDoc.document_name, bookVersionDate: gcDoc.book_version_date } : null,
      }),
    )

    const grouped: Record<string, DocRow[]> = {}
    const peopleByNameLower = new Map(subPeople.map((p) => [p.name.trim().toLowerCase(), p.id]))
    for (const d of docRows) {
      const pid = d.person_id ?? (d.person_name ? peopleByNameLower.get(d.person_name.trim().toLowerCase()) : undefined)
      if (!pid) continue
      ;(grouped[pid] ??= []).push(d)
    }
    setDocsByPerson(grouped)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // The bench (v2.2853): status per row from the roster dates + last worked; Active first.
  const benchRows = useMemo(() => {
    if (!result) return { active: [] as Array<{ row: SubsHqResult['rows'][number]; status: SubBenchStatus }>, bench: [] as Array<{ row: SubsHqResult['rows'][number]; status: SubBenchStatus }> }
    const withStatus = result.rows.map((row) => {
      const m = benchMeta[row.personId] ?? { startDate: null, endDate: null, notes: null, createdYmd: null }
      return { row, status: subBenchStatus({ ...m, lastWorkedYmd: row.lastWorkedYmd }, todayYmd) }
    })
    withStatus.sort((a, b) => compareSubsForBench(a.row, b.row, a.status, b.status))
    return { active: withStatus.filter((x) => x.status.kind === 'active'), bench: withStatus.filter((x) => x.status.kind === 'bench') }
  }, [result, benchMeta, todayYmd])

  async function benchSub(personId: string, date: string, reason: string) {
    const m = benchMeta[personId]
    setBenchSavingId(personId)
    setError(null)
    const { error: err } = await supabase
      .from('people')
      .update({ end_date: date, notes: appendNoteLine(m?.notes, benchNoteLine(date, reason)) })
      .eq('id', personId)
    setBenchSavingId(null)
    if (err) {
      setError(err.message)
      return
    }
    setBenchForm(null)
    await load()
  }

  async function reactivateSub(personId: string) {
    const m = benchMeta[personId]
    setBenchSavingId(personId)
    setError(null)
    const { error: err } = await supabase
      .from('people')
      .update({ end_date: null, start_date: todayYmd, notes: appendNoteLine(m?.notes, backNoteLine(todayYmd)) })
      .eq('id', personId)
    setBenchSavingId(null)
    if (err) {
      setError(err.message)
      return
    }
    await load()
  }

  const unattributedGroups = useMemo(
    () => (result ? groupUnattributedSheets(result.unattributed) : []),
    [result],
  )

  /** Conservative one-tap suggestion per unmatched group (null = no safe guess). */
  const suggestionByGroup = useMemo(() => {
    const candidates = roster.map((r) => ({ personId: r.id, name: r.name }))
    const map = new Map<string, { id: string; name: string } | null>()
    for (const g of unattributedGroups) {
      if (g.reason !== 'unmatched') {
        map.set(g.key, null)
        continue
      }
      const hit = suggestSubSheetAssignee(g.rawAssignedTo, candidates)
      map.set(g.key, hit ? { id: hit.personId, name: hit.name } : null)
    }
    return map
  }, [unattributedGroups, roster])

  /**
   * Attribute every sheet in an unattributed group to one roster person.
   * The junction (people_labor_job_assignees) is a trigger-maintained shadow
   * of assigned_to_name (sync_people_labor_job_assignees DELETEs + rebuilds it
   * on every name write), so a bare junction insert would be wiped by the next
   * name edit. The durable write is the name itself: set assigned_to_name to
   * the person's canonical roster name and the trigger mints the junction row
   * buildSubsHqRows counts. A direct junction upsert follows as belt-and-braces
   * for names resolve_pay_person_id can't map (e.g. duplicate roster names).
   */
  async function assignGroup(group: UnattributedGroup, person: { id: string; name: string }) {
    setAssignSavingKey(group.key)
    const upd = await supabase.from('people_labor_jobs').update({ assigned_to_name: person.name }).in('id', group.sheetIds)
    if (upd.error) {
      setAssignSavingKey(null)
      setError(`Failed to assign sheets: ${upd.error.message}`)
      return
    }
    const ins = await supabase
      .from('people_labor_job_assignees')
      .upsert(
        group.sheetIds.map((labor_job_id) => ({ labor_job_id, person_id: person.id })),
        { onConflict: 'labor_job_id,person_id', ignoreDuplicates: true },
      )
    if (ins.error) setError(`Sheets renamed but the roster link failed: ${ins.error.message}`)
    setAssignSavingKey(null)
    setAssignPickerKey(null)
    await load()
  }

  async function updateDoc(docId: string, patch: { doc_type?: string; expires_at?: string | null }) {
    setSavingDocId(docId)
    const { error: err } = await supabase.from('person_contract_documents').update(patch).eq('id', docId)
    setSavingDocId(null)
    if (err) {
      setError(`Failed to update document: ${err.message}`)
      return
    }
    await load()
  }

  const balanceDueByPersonId = useMemo(() => new Map((result?.rows ?? []).map((r) => [r.personId, r.balanceDue] as const)), [result])

  // ── Punch list #346: the row that opens, the acts in place, the reach ─────────────────────────────────────
  const canAct = !readOnly && role != null && CAN_ADD_DOCUMENT_ROLES.has(role)
  const sheetById = useMemo(() => new Map(ledger.laborJobs.map((j) => [j.id, j] as const)), [ledger.laborJobs])
  /** A person's open figure: the roster's Balance due for a sub, the breakdown's sum for a teammate paid as sub labor. */
  const figureFor = useCallback(
    (row: { personId: string; balanceDue: number }): { amount: number; person: OwedPerson | null; team: boolean } => {
      const person = owedPersonById(breakdown, row.personId)
      const team = person?.kind === 'team'
      return { amount: team ? owedView(person, 'open').open : row.balanceDue, person, team }
    },
    [breakdown],
  )
  function openPay(sheetId: string) {
    const job = sheetById.get(sheetId)
    if (!job) return
    const b = subLaborJobBalance(job)
    paymentModalsRef.current?.openMakePayment({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost: b.totalCost, paid: b.paid, outstanding: Math.max(0, b.balance) }, b.balance > 0 ? String(b.balance) : '')
  }
  function openBackcharge(sheetId: string) {
    const job = sheetById.get(sheetId)
    if (!job) return
    const b = subLaborJobBalance(job)
    paymentModalsRef.current?.openBackcharge({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost: b.totalCost, paid: b.paid })
  }
  const openSheetOnPay = (sheetId: string) => navigate(`/jobs?tab=subs&view=pay&editLabor=${encodeURIComponent(sheetId)}`)
  const openPayRunFor = (name: string) => navigate(`/jobs?tab=subs&view=pay&subSearch=${encodeURIComponent(name)}`)
  const openLedgerFor = (personId: string) =>
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('view', 'ledger')
      next.set('sub', personId)
      return next
    })
  /** One person's block: under their row on a desk, in a sheet on a phone. */
  const renderOwedBlock = (personId: string, name: string, balanceDue: number | null, onClose?: () => void) => (
    <SubOwedBlock
      person={owedPersonById(breakdown, personId)}
      name={name}
      balanceDue={balanceDue}
      narrow={narrow}
      onOpenJob={(jobId) => navigate(`/jobs?edit=${encodeURIComponent(jobId)}`)}
      onOpenSheet={openSheetOnPay}
      onOpenPayRun={() => openPayRunFor(name)}
      onByDate={() => openLedgerFor(personId)}
      onPay={canAct ? openPay : undefined}
      onBackcharge={canAct ? openBackcharge : undefined}
      // Punch list #350: the papers are the office's who see sub pay. Anyone else gets no paper press here.
      onStatement={isOfficeRole(role) ? () => setPapers({ key: `id:${personId}`, name, open: { kind: 'statement' } }) : undefined}
      onWorkStatement={isOfficeRole(role) ? (sheetId) => setPapers({ key: `id:${personId}`, name, open: { kind: 'work', sheetId } }) : undefined}
      onClose={onClose}
    />
  )

  const viewSwitch = (
    <div role="group" aria-label="Subs view" style={{ display: 'inline-flex', gap: 4, marginBottom: '0.75rem' }}>
      {(
        [
          ['roster', 'Roster', 'who they are, their papers and what we owe'],
          ['ledger', 'Ledger', 'what was paid to each sub, and when'],
        ] as const
      ).map(([key, label, hint]) => (
        <button
          key={key}
          type="button"
          aria-pressed={subsView === key}
          title={hint}
          onClick={() => setSubsView(key)}
          style={{
            font: 'inherit',
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.3rem 0.85rem',
            borderRadius: 999,
            border: `1px solid ${subsView === key ? 'var(--text-strong)' : 'var(--border-strong)'}`,
            background: subsView === key ? 'var(--text-strong)' : 'var(--surface)',
            color: subsView === key ? 'var(--surface)' : 'var(--text-700)',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (subsView === 'ledger') {
    return (
      <div>
        {viewSwitch}
        <PeopleSubsLedger
          balanceDueByPersonId={balanceDueByPersonId}
          sub={searchParams.get('sub')}
          onSubChange={(sub) =>
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              if (sub) next.set('sub', sub)
              else next.delete('sub')
              return next
            })
          }
        />
      </div>
    )
  }

  if (error) return <p style={{ color: 'var(--text-red-700)' }}>{error}</p>
  if (!result) return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
  if (result.rows.length === 0 && unattributedGroups.length === 0) return <EmptyState {...subsRosterEmptyWords(onOpenHire ?? null)} />

  // Archived-and-settled sheets are history, not problems — they get a quiet
  // summary line instead of amber rows. Archived with money open stays amber.
  // Crew pay (v2.7169) is nothing to fix either: teammates only, paid through payroll, a quiet line of its own.
  const crewGroups = unattributedGroups.filter((g) => g.reason === 'crew')
  const crewSheetCount = crewGroups.reduce((n, g) => n + g.sheetCount, 0)
  const actionableGroups = unattributedGroups.filter((g) => g.reason !== 'crew' && (g.reason !== 'archived' || g.totalBalance > 0))
  const archivedSettledGroups = unattributedGroups.filter((g) => g.reason === 'archived' && g.totalBalance <= 0)
  const actionableSheetCount = actionableGroups.reduce((n, g) => n + g.sheetCount, 0)
  const archivedSettledSheetCount = archivedSettledGroups.reduce((n, g) => n + g.sheetCount, 0)
  const archivedNames = [...new Set(archivedSettledGroups.map((g) => g.archivedPersonName).filter(Boolean))] as string[]

  const visibleGroups = showAllUnattributed ? actionableGroups : actionableGroups.slice(0, 3)

  const archivedSummaryLine = archivedSettledSheetCount > 0 && (
    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
      {archivedSettledSheetCount} sheet{archivedSettledSheetCount === 1 ? ' belongs' : 's belong'} to archived{' '}
      {archivedNames.length === 1 ? 'person' : 'people'}
      {archivedNames.length > 0 ? ` (${archivedNames.join(', ')})` : ''} — nothing owed.
    </p>
  )

  // Sheets with a teammate and no sub: what is open on them, under the rule in force.
  const teamPeople = [...breakdown.people.values()].filter((p) => p.kind === 'team')
  const teamSheetCount = teamRule === 'owed' ? teamPeople.reduce((n, p) => n + p.sheets.length, 0) : breakdown.payroll.length
  const teamSheetsLine = owedReady ? teamSheetsLineWords(teamSheetCount, teamRule === 'owed' ? tiles.teamOpen : tiles.payrollOpen, teamRule) : ''
  /** Teammates paid as sub labor who have no row on this roster (their roster kind is not `sub`). */
  const rosterIds = new Set(result.rows.map((r) => r.personId))
  const teamWithoutRow = teamPeople.filter((p) => !p.personId || !rosterIds.has(p.personId))
  const crewSummaryLine = (crewSheetCount > 0 || teamSheetCount > 0) && (
    <p data-testid="subs-crew-pay-line" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
      {teamSheetsLine || `${crewSheetCount} ${crewSheetCount === 1 ? 'sheet names' : 'sheets name'} a teammate and no sub.`}{' '}
      <button
        type="button"
        onClick={() => navigate('/jobs?tab=subs&view=pay')}
        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'var(--text-link)', fontFamily: 'inherit' }}
      >
        See {teamSheetCount === 1 ? 'it' : 'them'} on Jobs → Subs → Pay
      </button>
    </p>
  )

  /** One sub's documents, drawn in a row under theirs (it used to open below the whole table, out of sight on a long roster). */
  const renderDocsPanel = (personId: string) => (
        <div style={{ margin: '0.75rem 0', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.8125rem' }}>
              Documents — {result.rows.find((r) => r.personId === personId)?.name}
            </h4>
            {canAddDocument && addingDocForPersonId !== personId ? (
              <button
                type="button"
                onClick={() => setAddingDocForPersonId(personId)}
                title="File a COI, W-9, license, or a paper-signed agreement — typed from the start so the badge flips"
                style={{ padding: '0.15rem 0.55rem', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', fontFamily: 'inherit' }}
              >
                + Add document
              </button>
            ) : null}
          </div>
          {canAddDocument && addingDocForPersonId === personId ? (
            <div style={{ marginBottom: '0.5rem' }}>
              <SubDocumentAddForm
                personId={personId}
                personName={result.rows.find((r) => r.personId === personId)?.name ?? ''}
                onCancel={() => setAddingDocForPersonId(null)}
                onSaved={async () => {
                  setAddingDocForPersonId(null)
                  await load()
                }}
              />
            </div>
          ) : null}
          {(docsByPerson[personId] ?? []).length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {canAddDocument
                ? 'No documents yet — file a COI or W-9 with + Add document, or send a contract from the Contracts tab.'
                : 'No documents yet — a contracts role can file a COI or W-9 here, or send a contract from the Contracts tab.'}
            </p>
          ) : (
            (docsByPerson[personId] ?? []).map((d) => (
              <div key={d.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', borderBottom: '1px dashed var(--border)', fontSize: '0.8125rem' }}>
                <span style={{ minWidth: '10rem' }}>{d.document_name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({d.status})</span>
                {(() => {
                  const hint = suggestedRetype(d)
                  return hint ? (
                    <button
                      type="button"
                      disabled={savingDocId === d.id}
                      onClick={() => void updateDoc(d.id, { doc_type: hint })}
                      title={`Typed as the Agreement (the default for anything minted on Contracts), but the name reads like a ${SUB_DOCUMENT_TYPE_LABEL[hint]}. Click to retype it.`}
                      style={{ ...BADGE_STYLE.expiring, border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', fontFamily: 'inherit' }}
                    >
                      Looks like a {SUB_DOCUMENT_TYPE_LABEL[hint]} — set type
                    </button>
                  ) : null
                })()}
                <select
                  value={d.doc_type}
                  disabled={savingDocId === d.id}
                  onChange={(e) => void updateDoc(d.id, { doc_type: e.target.value })}
                  style={{ padding: '0.15rem 0.3rem', borderRadius: 5, border: '1px solid var(--border)', fontSize: '0.78rem' }}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  expires
                  <FinishedDateInput
                    aria-label={`${d.document_name} expires`}
                    value={d.expires_at ?? ''}
                    onCommit={(day) => void updateDoc(d.id, { expires_at: day })}
                    style={{ padding: '0.15rem 0.3rem', borderRadius: 5, border: '1px solid var(--border)', fontSize: '0.78rem' }}
                  />
                </label>
              </div>
            ))
          )}
        </div>
  )

  // The rows the chips, the search and the sort leave.
  const allRows = [...benchRows.active, ...benchRows.bench]
  const owedRows = allRows.filter((x) => figureFor(x.row).amount > 0)
  const chipRows = benchFilter === 'owed' ? owedRows : benchFilter === 'active' ? benchRows.active : benchFilter === 'bench' ? benchRows.bench : allRows
  const searchedRows = chipRows.filter((x) => owedPersonMatches(x.row.name, owedPersonById(breakdown, x.row.personId), subSearch))
  const shownRows =
    owedSort === 'owed' && benchFilter !== 'owed'
      ? searchedRows
      : [...searchedRows].sort((a, b) => {
          if (owedSort === 'name') return a.row.name.localeCompare(b.row.name)
          if (owedSort === 'ready') return owedView(figureFor(b.row).person, 'open').ready - owedView(figureFor(a.row).person, 'open').ready || figureFor(b.row).amount - figureFor(a.row).amount
          if (owedSort === 'worked') return (b.row.lastWorkedYmd ?? '').localeCompare(a.row.lastWorkedYmd ?? '')
          return figureFor(b.row).amount - figureFor(a.row).amount || a.row.name.localeCompare(b.row.name)
        })
  /** The bench's section line reads right only on the page's own order. */
  const plainOrder = owedSort === 'owed' && !subSearch.trim()
  const exportShown = () => {
    const people = shownRows.map((x) => owedPersonById(breakdown, x.row.personId)).filter((p): p is OwedPerson => !!p)
    saveBlobAs(new Blob(['\uFEFF', owedCsv(people)], { type: 'text/csv;charset=utf-8' }), owedCsvFileName(todayYmd))
  }
  const phoneOpen = narrow && owedOpenKey ? allRows.find((x) => `id:${x.row.personId}` === owedOpenKey) ?? null : null
  const phoneOpenTeam = narrow && owedOpenKey ? teamWithoutRow.find((p) => p.key === owedOpenKey) ?? null : null

  return (
    <div>
      {viewSwitch}
      {owedError ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem' }}>{owedError}</p> : null}
      {owedReady ? <PeopleSubsReach tiles={tiles} rule={teamRule} narrow={narrow} onOpenPayRun={() => navigate('/jobs?tab=subs&view=pay')} /> : null}
      {actionableGroups.length > 0 && (
        <div
          style={{
            marginBottom: '1rem',
            border: '1px solid var(--border-amber)',
            background: 'var(--bg-amber-tint)',
            borderRadius: 8,
            padding: '0.7rem 0.9rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-amber-900)' }}>
            {actionableSheetCount} {actionableSheetCount === 1 ? 'sheet needs' : 'sheets need'} one sub · <MoneyText text={money(actionableGroups.reduce((n, g) => n + g.totalBalance, 0))} /> open
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', margin: '0.15rem 0 0.5rem' }}>
            {actionableSheetCount === 1 ? 'Its' : 'Their'} money is counted once, here. It is in no sub's Balance due until {actionableSheetCount === 1 ? 'the sheet names' : 'each sheet names'} one sub.
          </div>
          {visibleGroups.map((g) => {
            const suggestion = suggestionByGroup.get(g.key)
            const saving = assignSavingKey === g.key
            const addressLabel =
              g.jobNumber && g.label.startsWith(g.jobNumber) ? g.label.slice(g.jobNumber.length).replace(/^ · /, '') : g.label
            return (
              <div
                key={g.key}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.4rem 0',
                  borderTop: '1px solid var(--border-amber-soft)',
                  fontSize: '0.8125rem',
                }}
              >
                {g.jobNumber ? (
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'var(--bg-amber-100)',
                      color: 'var(--text-amber-900)',
                      borderRadius: 5,
                      padding: '0.05rem 0.35rem',
                    }}
                  >
                    #{g.jobNumber}
                  </span>
                ) : null}
                <span style={{ fontWeight: 600 }}>{addressLabel}</span>
                {g.sheetCount > 1 && (
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>· {g.sheetCount} sheets</span>
                )}
                <span style={{ color: 'var(--text-muted)' }} title={g.rawAssignedTo ? `Written on the sheet as "${g.rawAssignedTo}"` : undefined}>
                  Assigned to:{' '}
                  {g.rawAssignedTo ? (
                    <span style={{ color: 'var(--text-strong)' }}>{assignedNamesLabel(g.rawAssignedTo)}</span>
                  ) : (
                    'nobody (blank)'
                  )}
                </span>
                <span
                  title={g.reason === 'archived' && g.archivedPersonName ? `Matches archived roster person "${g.archivedPersonName}" — shown because money is still open` : undefined}
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 650,
                    borderRadius: 999,
                    padding: '0.08rem 0.5rem',
                    whiteSpace: 'nowrap',
                    background:
                      g.reason === 'shared' ? 'var(--bg-blue-tint)' : g.reason === 'archived' ? 'var(--bg-amber-100)' : 'var(--bg-red-tint)',
                    color:
                      g.reason === 'shared' ? 'var(--text-blue-700)' : g.reason === 'archived' ? 'var(--text-amber-900)' : 'var(--text-red-700)',
                  }}
                >
                  {g.reason === 'shared' ? 'Multiple subs' : g.reason === 'archived' ? 'Archived person' : 'No roster match'}
                </span>
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: g.totalBalance > 0 ? 700 : 400,
                    color: g.totalBalance > 0 ? 'var(--text-strong)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ${Math.round(g.totalBalance).toLocaleString('en-US')} open
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/jobs?tab=subs&view=pay&editLabor=${encodeURIComponent(g.sheetIds[0] ?? '')}`)}
                    style={{ padding: '0.15rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}
                  >
                    Open →
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setAssignPickerKey((prev) => (prev === g.key ? null : g.key))}
                    style={{ padding: '0.15rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}
                  >
                    Whose is it…
                  </button>
                  {suggestion && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void assignGroup(g, suggestion)}
                      style={{ padding: '0.15rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-900)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 650, fontFamily: 'inherit' }}
                    >
                      ✨ Link to {suggestion.name}
                    </button>
                  )}
                  {saving && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Saving…</span>}
                </span>
              </div>
            )
          })}
          {actionableGroups.length > 3 && !showAllUnattributed && (
            <button
              type="button"
              onClick={() => setShowAllUnattributed(true)}
              style={{ marginTop: '0.4rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-link)', fontFamily: 'inherit' }}
            >
              Show all {actionableSheetCount} sheets
            </button>
          )}
        </div>
      )}
      {archivedSummaryLine}
      {crewSummaryLine}
      {rideAlongLine ? (
        <p data-testid="subs-ride-along-line" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          {rideAlongLine}{' '}
          <button type="button" onClick={() => setRideAlongOpen(true)} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'var(--text-link)', fontFamily: 'inherit' }}>
            Take the teammates off…
          </button>
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', margin: '0.5rem 0 0.35rem' }} role="group" aria-label="Show subs">
        {(
          [
            ['owed', `Owed · ${owedRows.length}`],
            ['active', `Active · ${benchRows.active.length}`],
            ['bench', `On the bench · ${benchRows.bench.length}`],
            ['all', `All · ${benchRows.active.length + benchRows.bench.length}`],
          ] as Array<[BenchFilter, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={benchFilter === key}
            onClick={() => setBenchFilter(key)}
            style={{
              font: 'inherit',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.2rem 0.7rem',
              borderRadius: 999,
              border: `1px solid ${benchFilter === key ? 'var(--border-blue)' : 'var(--border)'}`,
              background: benchFilter === key ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: benchFilter === key ? 'var(--text-blue-700)' : 'var(--text-700)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
        <input
          type="search"
          aria-label="Search a sub or a job"
          placeholder="Search a sub or a job…"
          value={subSearch}
          onChange={(e) => setSubSearch(e.target.value)}
          style={{ flex: '1 1 170px', minWidth: 140, maxWidth: 280, padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.78rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Sort
            <select aria-label="Sort the subs" value={owedSort} onChange={(e) => setOwedSort(e.target.value as OwedSort)} style={{ padding: '0.2rem 0.3rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.78rem', fontFamily: 'inherit' }}>
              {OWED_SORTS.map((k) => (
                <option key={k} value={k}>
                  {OWED_SORT_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={exportShown} disabled={!owedReady} title="One row per open sheet of the subs shown" style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-700)', cursor: owedReady ? 'pointer' : 'default' }}>
            Export CSV
          </button>
        </span>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 0.35rem' }}>Benched subs can come back any time — their portal, sheets, and balances stay put.</div>
      {narrow ? (
        <button type="button" onClick={() => setPhoneTable((v) => !v)} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-link)', fontFamily: 'inherit', margin: '0 0 0.4rem' }}>
          {phoneTable ? 'Show the cards' : 'Show the full table, with the bench and the documents'}
        </button>
      ) : null}
      {narrow && !phoneTable ? (
        <div data-testid="subs-phone-cards" style={{ display: 'grid', gap: 8 }}>
          {shownRows.map(({ row, status }) => {
            const fig = figureFor(row)
            const v = owedView(fig.person, 'open')
            return (
              <div key={row.personId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', background: 'var(--surface)', opacity: status.kind === 'bench' ? 0.72 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  {personDesk ? (
                    <button type="button" onClick={() => personDesk.open({ personId: row.personId, displayName: row.name })} style={{ fontWeight: 650, border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.9375rem', textAlign: 'left' }}>
                      {row.name}
                    </button>
                  ) : (
                    <b>{row.name}</b>
                  )}
                  {fig.amount > 0 || (fig.person && fig.person.sheets.length > 0) ? (
                    <button
                      type="button"
                      data-testid={`subs-owed-press-${row.personId}`}
                      aria-label={`What makes up ${money(fig.amount)} for ${row.name}`}
                      onClick={() => setOwedOpenKey(`id:${row.personId}`)}
                      style={{ font: 'inherit', fontWeight: 700, fontVariantNumeric: 'tabular-nums', border: 'none', background: 'none', padding: '0.2rem 0', cursor: 'pointer', color: fig.amount > 0 ? 'var(--text-link)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}
                    >
                      {fig.amount > 0 ? <MoneyText text={money(fig.amount)} /> : WE_OWE_NOTHING} ›
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[status.tone], flexShrink: 0 }} />
                  <span>
                    {[status.kind === 'active' ? 'Active' : `Bench since ${status.since}`, v.sheetCount > 0 ? `${v.sheetCount} ${v.sheetCount === 1 ? 'sheet' : 'sheets'} on ${v.jobCount} ${v.jobCount === 1 ? 'job' : 'jobs'}` : status.lastWorkedLine, v.ready > 0 ? `${owedMoney(v.ready)} ready` : ''].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {fig.team ? <div style={{ marginTop: 4, fontSize: '0.7rem', fontWeight: 650, color: 'var(--text-violet-700)' }}>{sheetOwedToChip('team')}</div> : null}
                {row.badges.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                    {row.badges.map((b) => (
                      <span key={b.key} style={{ ...BADGE_STYLE[b.state], fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', whiteSpace: 'nowrap' }}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
          {shownRows.length === 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{benchFilter === 'owed' && !subSearch.trim() ? 'Nothing waiting on a sub. Every sheet is paid.' : 'No sub matches. Clear the search or pick another chip.'}</p> : null}
        </div>
      ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              {['Sub', 'Status', 'Open work orders', 'Balance due', 'Compliance', 'Track record'].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i === 3 ? 'right' : 'left',
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-faint)',
                    padding: '0.4rem 0.6rem',
                    borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownRows.flatMap(({ row, status }, idx) => {
              const fig = figureFor(row)
              const owedKey = `id:${row.personId}`
              const owedOpen = owedOpenKey === owedKey
              const quiet = status.kind === 'bench'
              const saving = benchSavingId === row.personId
              const formOpen = benchForm?.personId === row.personId
              const sectionRow =
                benchFilter === 'all' && plainOrder && quiet && idx === benchRows.active.length ? (
                  <tr key="bench-section">
                    <td colSpan={6} style={{ padding: '0.35rem 0.6rem', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', background: 'var(--bg-page)', borderBottom: '1px solid var(--border)' }}>
                      On the bench · {benchRows.bench.length}
                    </td>
                  </tr>
                ) : null
              const statusCell = (
                <td style={{ padding: '0.6rem', fontSize: '0.8125rem', minWidth: 170 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[status.tone], flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: quiet ? 'var(--text-muted)' : 'var(--text-strong)' }}>
                      {status.kind === 'active' ? 'Active' : `Bench since ${status.since}`}
                    </span>
                    {status.kind === 'active' ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setBenchForm(formOpen ? null : { personId: row.personId, date: todayYmd, reason: '' })}
                        title={`Put ${row.name} on the bench — they can come back any time`}
                        style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                      >
                        Bench…
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void reactivateSub(row.personId)}
                        title={`Make ${row.name} active again`}
                        style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: 5, border: 'none', background: SKY_UNDER_WORDS, color: WORDS_ON_SKY, cursor: saving ? 'wait' : 'pointer' }}
                      >
                        {saving ? 'Saving…' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: 16 }}>
                    {status.reason ? <div>&ldquo;{status.reason}&rdquo;</div> : null}
                    <div>{status.lastWorkedLine}</div>
                  </div>
                  {status.nudge ? (
                    <div style={{ marginTop: 3, marginLeft: 16, display: 'inline-block', fontSize: '0.72rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 5, padding: '0.08rem 0.5rem' }}>
                      {status.nudge.text} ·{' '}
                      {status.nudge.kind === 'bench' ? (
                        <button type="button" onClick={() => setBenchForm({ personId: row.personId, date: todayYmd, reason: '' })} style={{ font: 'inherit', fontWeight: 700, border: 'none', background: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
                          Bench…
                        </button>
                      ) : (
                        <button type="button" disabled={saving} onClick={() => void reactivateSub(row.personId)} style={{ font: 'inherit', fontWeight: 700, border: 'none', background: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
                          Reactivate?
                        </button>
                      )}
                    </div>
                  ) : null}
                  {formOpen && benchForm ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void benchSub(row.personId, benchForm.date, benchForm.reason)
                      }}
                      style={{ marginTop: 6, display: 'grid', gap: 4, padding: '0.45rem 0.55rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-page)', maxWidth: 260 }}
                    >
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        Bench from
                        <input type="date" required value={benchForm.date} max={todayYmd} onChange={(e) => setBenchForm({ ...benchForm, date: e.target.value })} style={{ padding: '0.12rem 0.3rem', borderRadius: 5, border: '1px solid var(--border)', fontSize: '0.75rem', fontFamily: 'inherit' }} />
                      </label>
                      <input
                        type="text"
                        value={benchForm.reason}
                        maxLength={140}
                        placeholder="Why (one line, optional)"
                        onChange={(e) => setBenchForm({ ...benchForm, reason: e.target.value })}
                        style={{ padding: '0.2rem 0.4rem', borderRadius: 5, border: '1px solid var(--border)', fontSize: '0.75rem', fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="submit" disabled={saving} style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.6rem', borderRadius: 5, border: 'none', background: SKY_UNDER_WORDS, color: WORDS_ON_SKY, cursor: saving ? 'wait' : 'pointer' }}>
                          {saving ? 'Saving…' : 'Put on the bench'}
                        </button>
                        <button type="button" disabled={saving} onClick={() => setBenchForm(null)} style={{ font: 'inherit', fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                </td>
              )
              const tr = (
              <tr key={row.personId} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top', opacity: quiet ? 0.72 : 1 }}>
                <td style={{ padding: '0.6rem' }}>
                  <div style={{ fontWeight: 650, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {personDesk ? (
                      <button
                        type="button"
                        onClick={() => personDesk.open({ personId: row.personId, displayName: row.name })}
                        title={`Open ${row.name}'s desk`}
                        style={{ fontWeight: 650, border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'inherit', fontSize: 'inherit', textAlign: 'left', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
                      >
                        {row.name}
                      </button>
                    ) : (
                      row.name
                    )}
                    <SubPortalGlobeButton personId={row.personId} personName={row.name} />
                    {teammateRoleById.has(row.personId) ? (
                      <span data-testid={`subs-teammate-chip-${row.personId}`} title="On the team, with a row on this roster. A sheet is owed to them only when it names them and no sub." style={{ fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', whiteSpace: 'nowrap', background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)' }}>
                        Teammate
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {teammateRoleById.has(row.personId) ? `signs in as ${teammateRoleById.get(row.personId) || 'a teammate'}` : row.hasAccount ? row.email ?? 'account linked' : 'roster only — no login'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedPersonId((prev) => (prev === row.personId ? null : row.personId))}
                    style={{ marginTop: 4, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-link)', fontFamily: 'inherit' }}
                  >
                    {expandedPersonId === row.personId ? '▼' : '▶'} Documents ({(docsByPerson[row.personId] ?? []).length})
                  </button>
                </td>
                {statusCell}
                <td style={{ padding: '0.6rem' }}>
                  {row.openCommitments.length === 0 ? (
                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                  ) : (
                    row.openCommitments.map((c, i) => (
                      <div key={i} style={{ whiteSpace: 'nowrap' }}>
                        {c.sheetLabel ? (
                          <>
                            {c.sheetLabel}
                            <span style={{ color: 'var(--text-muted)' }}> · sheet</span>
                          </>
                        ) : (
                          c.stepName ?? 'Step'
                        )}
                        {c.projectName ? <span style={{ color: 'var(--text-muted)' }}> @ {c.projectName}</span> : null}{' '}
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}><MoneyText text={money(c.amount)} /></span>{' '}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({c.status})</span>
                      </div>
                    ))
                  )}
                </td>
                <td style={{ padding: '0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: fig.amount > 0 ? 700 : 400 }}>
                  {fig.amount > 0 || (fig.person && fig.person.sheets.length > 0) ? (
                    <button
                      type="button"
                      data-testid={`subs-owed-press-${row.personId}`}
                      aria-expanded={owedOpen}
                      aria-label={`What makes up ${money(fig.amount)} for ${row.name}`}
                      onClick={() => setOwedOpenKey((prev) => (prev === owedKey ? null : owedKey))}
                      style={{ font: 'inherit', fontWeight: 'inherit', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: fig.amount > 0 ? 'var(--text-link)' : 'var(--text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
                    >
                      {fig.amount > 0 ? <MoneyText text={money(fig.amount)} /> : WE_OWE_NOTHING} {owedOpen ? '▾' : '▸'}
                    </button>
                  ) : (
                    '—'
                  )}
                  {owedReady && owedUnderFigure(fig.person) ? <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>{owedUnderFigure(fig.person)}</div> : null}
                  {fig.team ? <div style={{ fontSize: '0.7rem', fontWeight: 650, color: 'var(--text-violet-700)' }}>{sheetOwedToChip('team')}</div> : null}
                  {creditNoteWords(creditByPersonId.get(row.personId) ?? 0) ? (
                    <div data-testid={`subs-credit-${row.personId}`} title="Sent past what their sheets needed. The next payment to them offers it first." style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-green-700)' }}>
                      <MoneyText text={creditNoteWords(creditByPersonId.get(row.personId) ?? 0)} />
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: '0.6rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {row.badges.map((b) => (
                      <span key={b.key} style={{ ...BADGE_STYLE[b.state], fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', whiteSpace: 'nowrap' }}>
                        {b.label}
                      </span>
                    ))}
                    {row.generalConditions !== 'none' && (
                      <span
                        title={
                          row.generalConditions === 'current'
                            ? 'Signed the current General Conditions'
                            : row.generalConditions === 'behind'
                              ? 'Signed an older General Conditions than the Contract Book — send the update from the library'
                              : 'Never signed the General Conditions — the portal asks at their next work order'
                        }
                        style={{
                          ...BADGE_STYLE[row.generalConditions === 'current' ? 'ok' : row.generalConditions === 'behind' ? 'expiring' : 'missing'],
                          fontSize: '0.7rem',
                          fontWeight: 650,
                          borderRadius: 999,
                          padding: '0.08rem 0.5rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Gen. Cond. {row.generalConditions === 'current' ? '✓' : row.generalConditions === 'behind' ? 'behind' : 'unsigned'}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {row.sheetCount} sheet{row.sheetCount === 1 ? '' : 's'} · {row.settledCount} settled
                  {row.backchargeTotal > 0 ? <> · <MoneyText text={money(row.backchargeTotal)} /> backcharged</> : null}
                </td>
              </tr>
              )
              const docsRow =
                expandedPersonId === row.personId ? (
                  <tr key={`${row.personId}-docs`}>
                    <td colSpan={6} style={{ padding: '0 0.6rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
                      {renderDocsPanel(row.personId)}
                    </td>
                  </tr>
                ) : null
              const owedRow =
                owedOpen && !narrow ? (
                  <tr key={`${row.personId}-owed`}>
                    <td colSpan={6} style={{ padding: '0 0.6rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
                      {owedReady ? renderOwedBlock(row.personId, row.name, fig.team ? null : row.balanceDue) : <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading the sheets…</p>}
                    </td>
                  </tr>
                ) : null
              return [sectionRow, tr, owedRow, docsRow].filter((r): r is JSX.Element => r != null)
            })}
            {benchFilter !== 'bench' && shownRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '0.8rem 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {benchFilter === 'owed' && !subSearch.trim() ? 'Nothing waiting on a sub. Every sheet is paid.' : 'No sub matches. Clear the search or pick another chip.'}
                </td>
              </tr>
            ) : null}
            {benchFilter === 'bench' && benchRows.bench.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '0.8rem 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Nobody is on the bench. Bench… on an active row sets a sub aside without archiving them.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      )}

      {teamRule === 'owed' && teamWithoutRow.length > 0 ? (
        <div data-testid="subs-team-sub-labor" style={{ marginTop: '1rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.9rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Teammates paid as sub labor</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.1rem 0 0.4rem' }}>They are on the team roster, not this one. A sheet that names one of them and no sub is owed to them.</div>
          {teamWithoutRow.map((p) => {
            const v = owedView(p, 'open')
            const isOpen = owedOpenKey === p.key
            return (
              <div key={p.key} style={{ borderTop: '1px solid var(--border)', padding: '0.4rem 0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.6rem', fontSize: '0.875rem' }}>
                  <b>{p.name}</b>
                  <span style={{ fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)' }}>{sheetOwedToChip('team')}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.sheets.length} {p.sheets.length === 1 ? 'sheet' : 'sheets'}</span>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOwedOpenKey((prev) => (prev === p.key ? null : p.key))} style={{ marginLeft: 'auto', font: 'inherit', fontWeight: 700, fontVariantNumeric: 'tabular-nums', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: v.open > 0 ? 'var(--text-link)' : 'var(--text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                    {v.open > 0 ? <MoneyText text={owedMoney(v.open)} /> : WE_OWE_NOTHING} {isOpen ? '▾' : '▸'}
                  </button>
                </div>
                {isOpen && !narrow && p.personId ? renderOwedBlock(p.personId, p.name, null) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {rideAlongOpen ? (
        <RideAlongCleanUpWindow
          cleanUp={rideAlongs}
          onDone={() => {
            void ledger.loadLaborJobs()
            void load()
          }}
          onOpenSheet={openSheetOnPay}
          onClose={() => setRideAlongOpen(false)}
        />
      ) : null}

      {(() => {
        const g = assignPickerKey ? actionableGroups.find((x) => x.key === assignPickerKey) : null
        return g ? <WhoseSheetWindow group={g} roster={roster} suggestion={suggestionByGroup.get(g.key) ?? null} saving={assignSavingKey === g.key} onAssign={(person) => void assignGroup(g, person)} onClose={() => setAssignPickerKey(null)} /> : null
      })()}

      {phoneOpen ? (
        <ScheduleSheet title={`What we owe ${phoneOpen.row.name}`} onClose={() => setOwedOpenKey(null)}>
          {renderOwedBlock(phoneOpen.row.personId, phoneOpen.row.name, figureFor(phoneOpen.row).team ? null : phoneOpen.row.balanceDue)}
        </ScheduleSheet>
      ) : phoneOpenTeam?.personId ? (
        <ScheduleSheet title={`What we owe ${phoneOpenTeam.name}`} onClose={() => setOwedOpenKey(null)}>
          {renderOwedBlock(phoneOpenTeam.personId, phoneOpenTeam.name, null)}
        </ScheduleSheet>
      ) : null}

      {papers ? <SubPapersWindow open={papers.open} subKey={papers.key} name={papers.name} laborJobs={ledger.laborJobs} assigneesByJobId={ledger.laborJobAssigneesByJobId} namesByJobId={ledger.laborJobNamesByJobId} roster={owed.roster} rule={teamRule} onClose={() => setPapers(null)} /> : null}

      <SubLaborPaymentModals
        ref={paymentModalsRef}
        recordLaborJobPayment={async (...a) => {
          await ledger.recordLaborJobPayment(...a)
          await load()
        }}
        recordLaborJobBackcharge={async (...a) => {
          await ledger.recordLaborJobBackcharge(...a)
          await load()
        }}
        deleteLaborJobPayment={ledger.deleteLaborJobPayment}
        updateLaborJobPayment={ledger.updateLaborJobPayment}
        recordSubSending={async (input) => {
          const r = await ledger.recordSubSending(input)
          await load()
          return r
        }}
        applySubCredit={async (...a) => {
          const r = await ledger.applySubCredit(...a)
          await load()
          return r
        }}
        laborJobs={ledger.laborJobs}
        laborJobAssigneesByJobId={ledger.laborJobAssigneesByJobId}
        laborJobNamesByJobId={ledger.laborJobNamesByJobId}
        subCreditByPersonId={ledger.subCreditByPersonId}
      />
    </div>
  )
}
