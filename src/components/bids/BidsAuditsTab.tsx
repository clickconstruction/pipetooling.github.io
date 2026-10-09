import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsDigitalTwin } from '../../hooks/useIsDigitalTwin'
import { fetchAllRowsChunkedIn } from '../../lib/supabasePaging'
import {
  AUDIT_SECTION_LABELS,
  AUDIT_DIGEST_OUTCOME_LABELS,
  threadAuditNotes,
  openQuestionCount,
  questionContextLine,
  computeAuditDraftTotal,
  sortAuditsForTab,
  canWriteBidAudit,
  formatAuditRequestedStamp,
  isUnpricedAudit,
  pairTwinReferences,
  type AuditSection,
  type BidAuditRow,
  type BidAuditNoteRow,
} from '../../lib/bids/bidAudits'
import {
  diffTakeoffs,
  diffWaterfall,
  rollupSystems,
  buildVerdictDraft,
  entrySection,
  type AuditVerdict,
  type DiffBucketKey,
  type DiffEntry,
} from '../../lib/bids/takeoffDiff'
import { groupStandingRulings, openCountByAudience, type TwinQuestionRow } from '../../lib/bids/standingRulings'
import { buildRunThrough, questionLine, questionsHeaderLine, sizeTodaySentence, type RunThroughItem } from '../../lib/bids/rulingRunThrough'
import { RulingRunThroughSheet } from './RulingRunThroughSheet'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { twinQuestionAudienceColumnPresent } from '../../../supabase/functions/_shared/twinQuestionAudience'
import { useTwinQuestionBidRefs } from '../../hooks/useTwinQuestionBidRefs'
import { orderPendingByStake, pickOpenAudit } from '../../lib/bids/auditTriage'
import { buildAuditQueue, deltaWord, finishLabel, jobNameFromShell, sealedLine, slateKey, whyLine, type AuditQueueItem } from '../../lib/bids/auditQueue'
import { useParkedAuditSlates } from '../../hooks/useParkedAuditSlates'
import { buildAliasNote, pairAliases, pairLabel, selfAssessmentLead, topDifferences, type AliasPair, type TopDifference } from '../../lib/bids/auditCardShape'
import { buildAxisCards, normalizeBidNumber, type RunScoreRow } from '../../lib/bids/confidenceBoard'
import type { ShadowRunRow } from '../../lib/bids/shadowStory'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { effectiveTwinQuestionKind } from '../../../supabase/functions/_shared/twinQuestionKind'
import { loadPricedTakeoffRows } from '../../lib/bids/loadPricedTakeoffRows'

/**
 * The Audits tab, cockpit v2 (v2.2553): judge the differences, coach the robot.
 * The twin's rows and the reference bid's rows are name-matched into a true diff
 * (missed / added / quantity gaps), each difference takes a one-tap verdict that
 * posts a tagged note the digest can triage mechanically, and the card opens with the
 * robot's own self-assessment. (The coaching strip left in v2.4230: its "recent runs"
 * were the five OLDEST audits, and the Scoreboard already says both of its facts.)
 * Sealed shadows hold completely — before our own bid goes out, even the robot's
 * takeoff rows could anchor the estimator, so those audits show only a 🔒 row.
 * Unpriced audits (v2.2796) — the robot opened the audit before pasting its counts
 * into PipeTooling, so there is nothing to price or diff — show as a "Robot still
 * working" row instead of "draft $0 · −100% vs ours".
 */

// bid_audits reaches src/types/database.ts only with the post-push gen-types run
// (BidRfiQueue pattern); until then this untyped view keeps strict mode honest.
const auditDb = supabase as unknown as SupabaseClient

type AuditWithBid = BidAuditRow & {
  bids: { id: string; bid_number: string | null; project_name: string | null; selected_bid_version_id: string | null } | null
}

type DraftSummary = { total: number; rowCount: number }
type RefInfo = { refId: string; refNumber: string | null; refValue: number | null; refSent: boolean; refSentDate: string | null; refDueDate: string | null; refVersionId: string | null }
type PricedRow = { id: string; name: string; count: number; ext: number }

const STATUS_CHIP: Record<BidAuditRow['status'], { bg: string; fg: string; label: string }> = {
  pending: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', label: 'Awaiting your audit' },
  done: { bg: 'var(--bg-blue-tint, var(--bg-muted))', fg: 'var(--text-blue-700, var(--text-700))', label: 'Waiting on robot digest' },
  digested: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)', label: 'Digested' },
}
const UNPRICED_CHIP = { bg: 'var(--bg-muted)', fg: 'var(--text-muted)', label: 'Robot still working' }

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.45rem 0.9rem',
  background: 'var(--bg-blue-tint)',
  border: '1px solid #3b82f6',
  borderRadius: 4,
  color: 'var(--text-blue-700)',
  textDecoration: 'none',
  fontSize: '0.875rem',
}

const statBoxStyle: React.CSSProperties = {
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.45rem 0.85rem',
}
const statLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const fmtUsd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`

// Diff rows worth a look: over this many dollars apart, or a bucket's top 3.
const DIFF_IMPACT_FLOOR = 1500
const DIFF_BUCKET_CAP = 8

const VERDICT_BUTTONS: Array<{ verdict: AuditVerdict; label: string; onBg: string; onFg: string }> = [
  { verdict: 'teach', label: "✗ Robot's wrong", onBg: 'var(--bg-red-100)', onFg: 'var(--text-red-600)' },
  { verdict: 'record', label: "📋 Our record's off", onBg: 'var(--bg-amber-tint)', onFg: 'var(--text-amber-800)' },
  { verdict: 'ok', label: '✓ Both fine', onBg: 'var(--bg-green-tint)', onFg: 'var(--text-green-800)' },
]

const DIFF_BUCKETS: Array<{
  bucket: 'missed' | 'added' | 'gaps' | 'rates'
  tag: string
  tagBg: string
  tagFg: string
  blurb: string
}> = [
  { bucket: 'missed', tag: 'ROBOT MISSED', tagBg: 'var(--bg-red-100)', tagFg: 'var(--text-red-600)', blurb: 'rows we carry that it doesn’t — the dangerous kind' },
  { bucket: 'added', tag: 'ROBOT ADDED', tagBg: 'var(--bg-amber-tint)', tagFg: 'var(--text-amber-800)', blurb: 'rows it carries that we don’t — overreach, or something we missed?' },
  { bucket: 'gaps', tag: 'QUANTITY GAPS', tagBg: 'var(--bg-blue-tint, var(--bg-muted))', tagFg: 'var(--text-blue-700, var(--text-700))', blurb: 'same row, different number' },
  // v2.2935 — the bucket the 2026-09-05 regression batch showed carries most of
  // the robots' remaining error: quantities agree, the money doesn't (tier
  // rates, uplift overrides, all-in boundaries).
  { bucket: 'rates', tag: 'PRICED DIFFERENTLY', tagBg: 'var(--bg-violet-100, var(--bg-muted))', tagFg: 'var(--text-violet-700, var(--text-700))', blurb: 'same row, same count — different money' },
]

/** Per-unit rate for a rate-gap row: 'robot $140/ft · ours $25/ft'. */
const fmtRate = (ext: number, count: number) => (count > 0 ? `$${(ext / count) % 1 === 0 ? (ext / count).toLocaleString() : (ext / count).toFixed(2)}` : '$0')

const WATERFALL_SEGMENTS: Array<{ key: 'missed' | 'added' | 'gaps' | 'rates' | 'other'; label: string }> = [
  { key: 'missed', label: 'missed' },
  { key: 'added', label: 'added' },
  { key: 'gaps', label: 'counts' },
  { key: 'rates', label: 'rates' },
  { key: 'other', label: 'everything else' },
]

export function BidsAuditsTab({ authUser, myRole, focusAuditId = null }: { authUser: User | null; myRole: string | null; /** v2.3222: open on this card (a Robot Board row's door, the envelope's "Full audit"). */ focusAuditId?: string | null }) {
  const { showToast } = useToastContext()
  const isTwin = useIsDigitalTwin()
  // Mirrors the write RLS: primary/superintendent (and twin sessions) get a clean
  // view-only card instead of raw 42501 errors from Add/Answer/Finish.
  const canWrite = canWriteBidAudit(myRole, isTwin)
  const [audits, setAudits] = useState<AuditWithBid[]>([])
  const [notesByAudit, setNotesByAudit] = useState<Record<string, BidAuditNoteRow[]>>({})
  const [draftByAudit, setDraftByAudit] = useState<Record<string, DraftSummary>>({})
  const [loading, setLoading] = useState(true)
  const [composer, setComposer] = useState<Record<string, string>>({}) // key: `${auditId}:card` or `answer:${questionId}`
  const [busy, setBusy] = useState<string | null>(null)
  const [showDigested, setShowDigested] = useState(false)
  // v2.5016 (the owner's call of 2026-10-09): slates parked with Skip this slate, on this device.
  const { parked: parkedSlates, park: parkSlate, bringBack: bringBackSlate } = useParkedAuditSlates(authUser?.id)
  const [parkedOpen, setParkedOpen] = useState(false)
  // Cockpit: one card open at a time; the rest collapse to triage rows.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // twin bid_id -> its reference (comparison + diff; sealed while the ref is unsent).
  const [refByBidId, setRefByBidId] = useState<Record<string, RefInfo>>({})
  // v2.4230: the references have been read (or the read failed) — the open-card pick waits on it.
  const [refsLoaded, setRefsLoaded] = useState(false)
  // v2.4234 (punch list #63): the runs and scores say each copy's kind of job and its gate state (the why line).
  const [shadowRuns, setShadowRuns] = useState<ShadowRunRow[]>([])
  const [scores, setScores] = useState<RunScoreRow[]>([])
  // v2.4234: two panes from 1151 px; below that a tapped row opens the card as a full-screen panel.
  const twoPanes = useMatchMedia('(min-width: 1151px)')
  // v2.4230: the estimator tapped a row (or a door named one) — the open card holds from then on.
  const [pickedByHand, setPickedByHand] = useState(false)
  // Priced active-version rows per bid (twin AND reference) for the diff, lazy per card.
  const [pricedRowsByBid, setPricedRowsByBid] = useState<Record<string, PricedRow[]>>({})
  // Verdict drafts open for editing + verdicts already posted this session.
  const [verdictDraft, setVerdictDraft] = useState<Record<string, { verdict: AuditVerdict; text: string }>>({})
  const [verdictPosted, setVerdictPosted] = useState<Record<string, AuditVerdict>>({})
  // Fallback judge list (no reference rows to diff against): local 👍 acks / 🚩 flags.
  const [rowJudgments, setRowJudgments] = useState<Record<string, 'ok' | 'flagged'>>({})
  const [composerSection, setComposerSection] = useState<Record<string, AuditSection>>({})
  // Standing rulings (v2.2941, LEARNING_PLAN item 4): the robots' open
  // twin_questions, deduped by topic — one answer fans out to every open copy.
  const [rulingQuestions, setRulingQuestions] = useState<TwinQuestionRow[]>([])
  const [rulingsAvailable, setRulingsAvailable] = useState(false)
  // null = follow the default (open when there are questions, collapsed at 0).
  const [rulingsOpen, setRulingsOpen] = useState<boolean | null>(null)
  // v2.4232 (punch list #63): the run-through sheet — one question at a time — and the index's fold.
  const [runThrough, setRunThrough] = useState<{ start: number } | null>(null)
  const [showAllQuestions, setShowAllQuestions] = useState(false)

  // Sealed shadow: the reference bid hasn't gone out yet, so even the robot's
  // takeoff rows are off-limits (anchoring) — the audit holds until scoring.
  const isSealed = useCallback(
    (a: AuditWithBid) => {
      const ref = refByBidId[a.bid_id]
      return !!ref && !ref.refSent
    },
    [refByBidId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const auditRows = (await withSupabaseRetry(
        () =>
          auditDb
            .from('bid_audits')
            .select('*, bids:bids(id, bid_number, project_name, selected_bid_version_id)')
            .order('requested_at', { ascending: false })
            .limit(50),
        'load bid audits',
      )) as AuditWithBid[] | null
      const list = sortAuditsForTab(auditRows ?? [])
      setAudits(list)
      // Each twin bid's reference (twin_source_bid_id pairing). Seal rule: an
      // unsent reference's value is NEVER shown (shadow anchoring).
      void (async () => {
        try {
          const twinIds = list.map((a) => a.bid_id)
          if (!twinIds.length) return
          const twins = ((await auditDb.from('bids').select('id, bid_number, twin_source_bid_id').in('id', twinIds)).data ?? []) as Array<{ id: string; bid_number: string | null; twin_source_bid_id: string | null }>
          // Shadows opened before v2.2543 stamped the pairing still carry their
          // reference on the run row — without it the seal cannot hold (b418).
          // The staff read is the list_shadow_runs RPC (bid numbers, sealed money
          // NULL); the direct select is RLS-closed. Fail-soft: no runs, stamps only.
          const shadowRuns = ((await auditDb.rpc('list_shadow_runs')).data ?? []) as ShadowRunRow[]
          setShadowRuns(shadowRuns)
          const pairing = pairTwinReferences(twins, shadowRuns)
          const refIds = [...new Set([...pairing.values()].map((k) => k.refId).filter((x): x is string => !!x))]
          const refNumbers = [...new Set([...pairing.values()].filter((k) => !k.refId).map((k) => k.refNumber).filter((x): x is string => !!x))]
          type RefRow = { id: string; bid_number: string | null; bid_value: number | string | null; bid_date_sent: string | null; bid_due_date: string | null; selected_bid_version_id: string | null }
          const REF_COLS = 'id, bid_number, bid_value, bid_date_sent, bid_due_date, selected_bid_version_id'
          const [refsById, refsByNumber] = await Promise.all([
            refIds.length ? auditDb.from('bids').select(REF_COLS).in('id', refIds).then((r) => (r.data ?? []) as RefRow[]) : Promise.resolve([] as RefRow[]),
            refNumbers.length ? auditDb.from('bids').select(REF_COLS).in('bid_number', refNumbers).then((r) => (r.data ?? []) as RefRow[]) : Promise.resolve([] as RefRow[]),
          ])
          const refById = new Map(refsById.map((r) => [r.id, r]))
          const refByNumber = new Map(refsByNumber.filter((r) => r.bid_number).map((r) => [r.bid_number as string, r]))
          const out: Record<string, RefInfo> = {}
          for (const [twinId, key] of pairing) {
            const r = key.refId ? refById.get(key.refId) : key.refNumber ? refByNumber.get(key.refNumber) : undefined
            if (!r) continue
            const sent = !!r.bid_date_sent
            out[twinId] = {
              refId: r.id,
              refNumber: r.bid_number,
              refValue: sent && r.bid_value != null ? Number(r.bid_value) : null,
              refSent: sent,
              refSentDate: r.bid_date_sent,
              refDueDate: r.bid_due_date ?? null,
              refVersionId: r.selected_bid_version_id,
            }
          }
          setRefByBidId(out)
        } catch {
          /* strip is optional context — never block the tab */
        } finally {
          setRefsLoaded(true)
        }
      })()
      const auditIds = list.map((a) => a.id)
      if (auditIds.length) {
        const notes = (await withSupabaseRetry(
          () =>
            auditDb
              .from('bid_audit_notes')
              .select('*, author:users(name)')
              .in('audit_id', auditIds)
              .order('created_at'),
          'load audit notes',
        )) as BidAuditNoteRow[] | null
        const grouped: Record<string, BidAuditNoteRow[]> = {}
        for (const n of notes ?? []) (grouped[n.audit_id] ??= []).push(n)
        setNotesByAudit(grouped)
      } else {
        setNotesByAudit({})
      }
      // Draft totals for open cards only (pending/done); digested cards keep it light.
      const open = list.filter((a) => a.status !== 'digested')
      const bidIds = open.map((a) => a.bid_id)
      if (bidIds.length) {
        // Paged (v2.2796): 15+ open audits × ~60 rows already brushed PostgREST's
        // silent 1,000-row cap — a truncated load would price the newest audits at $0.
        const [rows, assigns] = await Promise.all([
          fetchAllRowsChunkedIn<{ id: string; count: number; bid_version_id: string | null; bid_id: string }, string>(
            bidIds,
            (chunk, from, to) => auditDb.from('bids_count_rows').select('id, count, bid_version_id, bid_id').in('bid_id', chunk).order('id').range(from, to),
            'load audit count rows',
          ),
          fetchAllRowsChunkedIn<{ bid_id: string; count_row_id: string; price_book_entry_id: string | null; unit_price_override: number | null }, string>(
            bidIds,
            (chunk, from, to) =>
              auditDb
                .from('bid_pricing_assignments')
                .select('bid_id, count_row_id, price_book_entry_id, unit_price_override')
                .in('bid_id', chunk)
                .order('count_row_id')
                .range(from, to),
            'load audit pricing',
          ),
        ])
        const entryIds = [...new Set(((assigns ?? []) as Array<{ price_book_entry_id: string | null }>).map((a) => a.price_book_entry_id).filter((x): x is string => !!x))]
        const entries = entryIds.length
          ? ((await withSupabaseRetry(
              () => auditDb.from('price_book_entries').select('id, total_price').in('id', entryIds),
              'load audit prices',
            )) as Array<{ id: string; total_price: number | null }> | null)
          : []
        const priceById = Object.fromEntries((entries ?? []).map((e) => [e.id, e.total_price ?? 0]))
        const summaries: Record<string, DraftSummary> = {}
        for (const a of open) {
          const bidRows = ((rows ?? []) as Array<{ id: string; count: number; bid_version_id: string | null; bid_id: string }>).filter((r) => r.bid_id === a.bid_id)
          const bidAssigns = ((assigns ?? []) as Array<{ bid_id: string; count_row_id: string; price_book_entry_id: string | null; unit_price_override: number | null }>).filter((x) => x.bid_id === a.bid_id)
          summaries[a.id] = computeAuditDraftTotal(bidRows, a.bids?.selected_bid_version_id ?? null, bidAssigns, priceById)
        }
        setDraftByAudit(summaries)
      }
    } catch (e) {
      // Client ships ahead of the migration (BidRfiQueue pattern): a missing table
      // means "no audits provisioned yet", never a broken tab.
      const msg = e instanceof Error ? e.message : String(e)
      if (!/does not exist/i.test(msg)) showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  // Open twin questions for the Standing rulings panel. `topic` ships with the
  // 20260906110000 migration (PR #2684); select('*') simply omits the column
  // until then, so the panel degrades to individual questions, never an error.
  const loadRulings = useCallback(async () => {
    if (!canWrite) return
    try {
      const { data, error } = await auditDb
        .from('twin_questions')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(error.message)
      setRulingQuestions((data ?? []) as TwinQuestionRow[])
      setRulingsAvailable(true)
    } catch {
      // RLS-closed or table missing: the panel just doesn't render.
      setRulingsAvailable(false)
    }
  }, [canWrite])
  useEffect(() => {
    void loadRulings()
  }, [loadRulings])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await auditDb.from('twin_run_scores').select('*').order('scored_at', { ascending: false })
        if (!cancelled) setScores((data ?? []) as RunScoreRow[])
      } catch {
        // the why line just has no kind of job
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // v2.3186 — the estimator's lane only. Machine-side questions (sandbox, the
  // write fence, a file the service account can't read) sit with the operator on
  // the Console (Bids → Robots → Console, v2.3224); the column decides when it exists, else the text.
  const rulingsView = useMemo(() => groupStandingRulings(rulingQuestions, { audience: 'estimator' }), [rulingQuestions])
  const operatorOpen = useMemo(() => openCountByAudience(rulingQuestions).operator, [rulingQuestions])
  // Bouncing a question across needs the column to write to.
  const audienceWritable = useMemo(() => twinQuestionAudienceColumnPresent(rulingQuestions), [rulingQuestions])

  // v2.3174 / v2.3187 — every "b474" in a question links to its bid, and a ZZ
  // shell's question also links the human bid it pairs with ("ours b214"). One
  // hook, shared with the operator-questions card on the Console lens.
  const { bidIdByNumber, bidNumberById, sourceByBidId } = useTwinQuestionBidRefs(rulingQuestions)

  // One submit answers EVERY open question in the ruling's topic (or the one
  // topicless question) — answer + status flip, stamped with who and when.
  // v2.4232: the run-through sheet is the one place that answers; it advances only when
  // the write lands, so each write says whether it did.
  const answerRuling = async (questionIds: string[], draftKey: string, text: string): Promise<boolean> => {
    const body = text.trim()
    if (!body) return false
    setBusy(`ruling:${draftKey}`)
    try {
      const { data: rows, error } = await auditDb
        .from('twin_questions')
        .update({
          status: 'answered',
          answer: body,
          answered_by: authUser?.id ?? null,
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', questionIds)
        .eq('status', 'open')
        .select('id')
      if (error) throw new Error(error.message)
      const n = (rows ?? []).length
      if (n === 0) {
        showToast('Already handled elsewhere — refreshing.', 'error')
        await loadRulings()
        return false
      }
      showToast(
        n > 1
          ? `Ruling saved — ${n} open questions answered at once; every robot pulls it next run.`
          : 'Answer saved — the robot pulls it on its next run.',
        'success',
      )
      await loadRulings()
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
      return false
    } finally {
      setBusy(null)
    }
  }

  // "Not mine" (v2.3186): the robot was talking to the operator — move every
  // open copy to that lane. Dismiss: close it unanswered (status 'dismissed').
  const patchRulingQuestions = async (questionIds: string[], key: string, patch: Record<string, unknown>, done: string): Promise<boolean> => {
    setBusy(`ruling:${key}`)
    try {
      const { data: rows, error } = await auditDb
        .from('twin_questions')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .in('id', questionIds)
        .eq('status', 'open')
        .select('id')
      if (error) throw new Error(error.message)
      const wrote = (rows ?? []).length > 0
      if (!wrote) showToast('Already handled elsewhere — refreshing.', 'error')
      else showToast(done, 'success')
      await loadRulings()
      return wrote
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
      return false
    } finally {
      setBusy(null)
    }
  }
  const bounceToOperator = (questionIds: string[], key: string) =>
    patchRulingQuestions(questionIds, key, { audience: 'operator' }, questionIds.length > 1 ? `Sent ${questionIds.length} questions to the operator's console.` : "Sent to the operator's console.")
  const dismissRulingQuestions = (questionIds: string[], key: string) =>
    patchRulingQuestions(questionIds, key, { status: 'dismissed' }, questionIds.length > 1 ? `Dismissed ${questionIds.length} questions.` : 'Dismissed.')
  const deltaPctFor = useCallback(
    (a: AuditWithBid): number | null => {
      const ref = refByBidId[a.bid_id]
      const draft = draftByAudit[a.id]
      if (!ref?.refValue || !draft || isUnpricedAudit(draft)) return null
      return ((draft.total - ref.refValue) / ref.refValue) * 100
    },
    [refByBidId, draftByAudit],
  )

  // Doctrine-at-stake triage (v2.2941, LEARNING_PLAN item 5): pending cards
  // order by what a verdict unblocks — open questions first, then |delta|,
  // then age — instead of oldest-first. Done/digested keep sortAuditsForTab's
  // order; sealed shadows sort by the same rule but still render locked.
  const triaged = useMemo(
    () =>
      orderPendingByStake(audits, (a) => ({
        openQuestions: openQuestionCount(threadAuditNotes(notesByAudit[a.id] ?? [])),
        deltaPct: deltaPctFor(a),
      })),
    [audits, notesByAudit, deltaPctFor],
  )

  // v2.4230 (punch list #63): the open card is the top of the queue. `pickOpenAudit` waits
  // for the notes, draft totals and references (the signals the order reads), opens the
  // first workable pending card, re-picks as they move, and holds once the estimator picks.
  const focusAppliedRef = useRef<string | null>(null)
  const workable = useCallback(
    (a: AuditWithBid) =>
      !isSealed(a) && !isUnpricedAudit(draftByAudit[a.id]) && !parkedSlates.has(slateKey({ shellName: a.bids?.project_name ?? null, requestedAt: a.requested_at, refSentDate: null }) ?? ''),
    [isSealed, draftByAudit, parkedSlates],
  )
  useEffect(() => {
    // A door from the Robot Board / the envelope names the card to open — once, and it counts as a pick.
    if (focusAuditId && focusAppliedRef.current !== focusAuditId) {
      const wanted = triaged.find((a) => a.id === focusAuditId)
      if (wanted && !isSealed(wanted)) {
        focusAppliedRef.current = focusAuditId
        setPickedByHand(true)
        setExpandedId(wanted.id)
        return
      }
    }
    const next = pickOpenAudit({ triaged, current: expandedId, picked: pickedByHand, ready: !loading && refsLoaded, workable, autoOpen: twoPanes })
    if (next !== expandedId) setExpandedId(next)
  }, [triaged, isSealed, workable, focusAuditId, expandedId, pickedByHand, loading, refsLoaded, twoPanes])
  const openCard = (id: string) => {
    setPickedByHand(true)
    setExpandedId(id)
  }
  // The phone panel's ✕: a pick of nothing, which holds (pickOpenAudit).
  const closeCard = () => {
    setPickedByHand(true)
    setExpandedId(null)
  }

  // Priced active-version rows for the expanded card — the twin's draft AND (once
  // the reference has gone out) the reference bid's rows, so the diff has both sides.
  useEffect(() => {
    const audit = audits.find((a) => a.id === expandedId)
    if (!audit || isSealed(audit)) return
    const ref = refByBidId[audit.bid_id]
    const targets: Array<{ bidId: string; version: string | null }> = [
      { bidId: audit.bid_id, version: audit.bids?.selected_bid_version_id ?? null },
    ]
    if (ref?.refSent) targets.push({ bidId: ref.refId, version: ref.refVersionId })
    const todo = targets.filter((t) => !pricedRowsByBid[t.bidId])
    if (!todo.length) return
    let cancelled = false
    void (async () => {
      try {
        for (const t of todo) {
          // v2.3239: one loader for every reader of a priced takeoff — assignment override, then the
          // Workbench's typed price, then the book entry — so a human reference no longer reads as $0 rows.
          const priced = await loadPricedTakeoffRows(t.bidId, t.version)
          if (cancelled) return
          setPricedRowsByBid((prev) => ({ ...prev, [t.bidId]: priced }))
        }
      } catch {
        /* the diff is optional evidence — the card still works without it */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId, audits, refByBidId])

  const insertNote = async (audit: AuditWithBid, section: AuditSection, kind: 'note' | 'answer', body: string, parentId: string | null, composerKey: string) => {
    if (!body.trim()) return
    setBusy(composerKey)
    try {
      const { error } = await auditDb.from('bid_audit_notes').insert({
        bid_id: audit.bid_id,
        audit_id: audit.id,
        section,
        kind,
        body: body.trim(),
        parent_id: parentId,
        author_id: authUser?.id ?? null,
      })
      if (error) throw new Error(error.message)
      setComposer((p) => ({ ...p, [composerKey]: '' }))
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  // One-tap verdicts: 'ok' posts immediately (the ack IS the signal); teach/record
  // open the drafted note for a quick edit first.
  const tapVerdict = (audit: AuditWithBid, entry: DiffEntry, verdict: AuditVerdict, bucket?: DiffBucketKey) => {
    const stateKey = `${audit.id}:${entry.key}`
    if (verdictPosted[stateKey]) return
    if (verdict === 'ok') {
      setVerdictPosted((p) => ({ ...p, [stateKey]: 'ok' }))
      void insertNote(audit, entrySection(entry.label, bucket), 'note', buildVerdictDraft('ok', entry, bucket), null, `verdict:${stateKey}`)
      return
    }
    setVerdictDraft((p) => {
      if (p[stateKey]?.verdict === verdict) {
        const { [stateKey]: _drop, ...rest } = p
        return rest
      }
      return { ...p, [stateKey]: { verdict, text: buildVerdictDraft(verdict, entry, bucket) } }
    })
  }
  const postVerdictDraft = async (audit: AuditWithBid, entry: DiffEntry, bucket?: DiffBucketKey) => {
    const stateKey = `${audit.id}:${entry.key}`
    const draft = verdictDraft[stateKey]
    if (!draft) return
    setVerdictPosted((p) => ({ ...p, [stateKey]: draft.verdict }))
    setVerdictDraft((p) => {
      const { [stateKey]: _drop, ...rest } = p
      return rest
    })
    await insertNote(audit, entrySection(entry.label, bucket), 'note', draft.text, null, `verdict:${stateKey}`)
  }

  // Finish/reopen go through the audit-finish edge fn (v2.2518): one gesture does the
  // PT side AND flips the twin's CT project review status over the bridge. If the fn
  // isn't reachable (local dev, pre-deploy), fall back to the PT-side-only writes so
  // the tab still works — the agent's digest sweep reconciles the CT lane later.
  const setAuditStatus = async (audit: AuditWithBid, action: 'finish' | 'reopen') => {
    setBusy(`finish:${audit.id}`)
    try {
      let viaFn = false
      try {
        const { data, error } = await supabase.functions.invoke('audit-finish', {
          body: { audit_id: audit.id, action },
        })
        const resp = data as { ok?: boolean; ct_bridge?: string } | null
        if (!error && resp?.ok) {
          viaFn = true
          if (action === 'finish') {
            const ct = resp.ct_bridge === 'ok' ? ' Takeoff marked reviewed in CountTooling too.' : ''
            showToast(`Audit finished — the robot will digest your notes and reply with receipts.${ct}`, 'success')
          }
        }
      } catch {
        // fall through to the direct writes below
      }
      if (!viaFn) {
        const patch = action === 'finish'
          ? { status: 'done', completed_at: new Date().toISOString(), completed_by: authUser?.id ?? null, updated_at: new Date().toISOString() }
          : { status: 'pending', completed_at: null, completed_by: null, updated_at: new Date().toISOString() }
        const { error } = await auditDb.from('bid_audits').update(patch).eq('id', audit.id)
        if (error) throw new Error(error.message)
        if (action === 'finish') {
          const noteCount = (notesByAudit[audit.id] ?? []).filter((n) => n.kind === 'note' || n.kind === 'answer').length
          await auditDb.from('bids_submission_entries').insert({
            bid_id: audit.bid_id,
            notes: `[audit] finished by ${authUser?.email ?? 'staff'} — ${noteCount} note(s)/answer(s) left for the robot to digest.`,
          })
          showToast('Audit finished — the robot will digest your notes and reply with receipts.', 'success')
        }
      }
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(null)
    }
  }
  const finishAudit = async (audit: AuditWithBid) => {
    await setAuditStatus(audit, 'finish')
    // The pick is released: the next card is the top of the queue as the signals now read.
    // v2.4295: on the phone panel "Finish audit → next" IS the tap that opens the next card, so it holds.
    const next = triaged.find((a) => a.id !== audit.id && a.status === 'pending' && workable(a))
    setPickedByHand(!twoPanes && !!next)
    setExpandedId(next?.id ?? null)
  }
  const reopenAudit = (audit: AuditWithBid) => setAuditStatus(audit, 'reopen')

  // v2.4234: the queue — one item per audit in the stake order, named for the job, with the
  // signals the why line reads; the sections around the open card.
  const axisByShellNumber = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of shadowRuns) {
      const n = normalizeBidNumber(r.shadow_bid_number)
      if (n && r.axis) m.set(n, r.axis)
    }
    for (const sc of scores) {
      const n = normalizeBidNumber(sc.twin_bid_number)
      if (n && sc.axis) m.set(n, sc.axis)
    }
    return m
  }, [shadowRuns, scores])
  const gateByAxis = useMemo(() => new Map(buildAxisCards(scores, shadowRuns).map((c) => [c.axis, { streak: c.streak, met: c.chip.tone === 'met' }])), [scores, shadowRuns])
  const plansAskBidIds = useMemo(() => new Set(rulingQuestions.filter((q) => q.status === 'open' && effectiveTwinQuestionKind(q) === 'plans' && q.about_bid_id).map((q) => q.about_bid_id as string)), [rulingQuestions])
  const queueItems = useMemo<AuditQueueItem[]>(
    () =>
      triaged.map((a) => {
        const ref = refByBidId[a.bid_id]
        const shellNumber = normalizeBidNumber(a.bids?.bid_number) ?? null
        const axis = (shellNumber ? axisByShellNumber.get(shellNumber) : undefined) ?? null
        return {
          id: a.id,
          status: a.status,
          requestedAt: a.requested_at,
          shellName: a.bids?.project_name ?? null,
          shellNumber: a.bids?.bid_number ?? null,
          refNumber: ref?.refNumber ?? null,
          refDueDate: ref?.refDueDate ?? null,
          refSentDate: ref?.refSentDate ?? null,
          sealed: a.status === 'pending' && isSealed(a),
          unpriced: isUnpricedAudit(draftByAudit[a.id]),
          openQuestions: openQuestionCount(threadAuditNotes(notesByAudit[a.id] ?? [])),
          notes: (notesByAudit[a.id] ?? []).filter((n) => n.kind === 'note' || n.kind === 'answer').length,
          deltaPct: deltaPctFor(a),
          axis,
          gate: axis ? (gateByAxis.get(axis) ?? null) : null,
          needsFix: plansAskBidIds.has(a.bid_id) || (!!ref && plansAskBidIds.has(ref.refId)),
        }
      }),
    [triaged, refByBidId, isSealed, draftByAudit, notesByAudit, deltaPctFor, axisByShellNumber, gateByAxis, plansAskBidIds],
  )
  const queue = useMemo(() => buildAuditQueue(queueItems, expandedId, parkedSlates), [queueItems, expandedId, parkedSlates])
  const [sealedOpen, setSealedOpen] = useState(false)
  // v2.4261 (punch list #63): the card's folds — the confession, the rest of the differences, the pairs, the system table, the questions — and the alias answers.
  const [cardFolds, setCardFolds] = useState<Record<string, boolean>>({})
  const foldOpen = (key: string) => !!cardFolds[key]
  const toggleFold = (key: string) => setCardFolds((p) => ({ ...p, [key]: !p[key] }))
  // 'posted' — Same item was tapped (the note is on the card); 'two' — No, two things (the rows go back to their buckets).
  const [aliasAnswer, setAliasAnswer] = useState<Record<string, 'posted' | 'two'>>({})

  // Open by default when there is anything to act on or point at (one-tap questions, plans asks, a pre-rule ask waiting for the owner).
  const rulingsExpanded = rulingsOpen ?? (rulingsView.openCount > 0 || rulingsView.plansAsks.length > 0 || rulingsView.legacyAsks.length > 0)
  // v2.4232: the run-through's order over the panel's view, and the sentence that sizes today.
  const runItems = useMemo(() => buildRunThrough(rulingsView, rulingQuestions, todayYmdInAppTz()), [rulingsView, rulingQuestions])
  const workableAudits = triaged.filter((a) => a.status === 'pending' && workable(a)).length
  const sealedAudits = triaged.filter((a) => a.status === 'pending' && isSealed(a)).length
  const todaySentence = sizeTodaySentence({ questions: rulingsView.openCount, audits: workableAudits, sealed: sealedAudits })
  const QUESTION_INDEX_FOLD = 4
  const indexItems = showAllQuestions ? runItems : runItems.slice(0, QUESTION_INDEX_FOLD)

  // v2.4234: the open card, drawn in the right pane (or the phone panel). The row's prelude
  // — threaded notes, the draft, the chip, the reference and the delta — is what the card reads.
  const renderCard = (audit: AuditWithBid) => {
    const threaded = threadAuditNotes(notesByAudit[audit.id] ?? [])
    const openQ = openQuestionCount(threaded)
    const draft = draftByAudit[audit.id]
    const unpriced = isUnpricedAudit(draft)
    const chip = unpriced && audit.status === 'pending' ? UNPRICED_CHIP : STATUS_CHIP[audit.status]
    const bidLabel = `b${audit.bids?.bid_number ?? '?'}`
    const ref = refByBidId[audit.bid_id]
    const deltaPct = ref?.refValue && draft && !unpriced ? ((draft.total - ref.refValue) / ref.refValue) * 100 : null
    const robotRows = pricedRowsByBid[audit.bid_id]
    const ourRows = ref?.refSent ? pricedRowsByBid[ref.refId] : undefined
    const diff = robotRows?.length && ourRows?.length ? diffTakeoffs(robotRows, ourRows) : null
    const rollup = robotRows?.length && ourRows?.length ? rollupSystems(robotRows, ourRows) : null
    // v2.4261: the pairs that look like one item (less the ones the estimator said are two), and the six biggest.
    const pairKey = (p: AliasPair) => `${audit.id}:${p.missed.key}|${p.added.key}`
    const pairs = diff ? pairAliases(diff).filter((p) => aliasAnswer[pairKey(p)] !== 'two') : []
    const top = diff ? topDifferences(diff, pairs) : null
    const topKeys = new Set((top?.rows ?? []).flatMap((r) => (r.kind === 'entry' ? [`${r.bucket}:${r.entry.key}`] : [])))
    const pairedKeys = new Set(pairs.flatMap((p) => [`missed:${p.missed.key}`, `added:${p.added.key}`]))
    const restPairs = (top?.rows ?? []).filter((r): r is Extract<TopDifference, { kind: 'pair' }> => r.kind === 'pair').map((r) => r.pair)
    const foldedPairs = pairs.filter((p) => !restPairs.includes(p))
    const postAlias = (p: AliasPair) => {
      const k = pairKey(p)
      if (aliasAnswer[k]) return
      setAliasAnswer((prev) => ({ ...prev, [k]: 'posted' }))
      void insertNote(audit, 'counts', 'note', buildAliasNote(p), null, `alias:${k}`)
    }
    const splitPair = (p: AliasPair) => setAliasAnswer((prev) => ({ ...prev, [pairKey(p)]: 'two' }))
    const foldBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontSize: '0.78rem' }
    const cardComposerKey = `${audit.id}:card`
    const cardSection = composerSection[audit.id] ?? 'general'
    const renderDiffRow = (entry: DiffEntry, bucket: DiffBucketKey) => {
                      const stateKey = `${audit.id}:${entry.key}`
      const posted = verdictPosted[stateKey]
      const open = verdictDraft[stateKey]
      return (
        <div key={entry.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8125rem', flexWrap: 'wrap' }}>
          <span>{entry.label}</span>
          {bucket === 'gaps' ? (
            <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>robot ×{fmtQty(entry.robotCount)} · ours ×{fmtQty(entry.ourCount)}</span>
          ) : bucket === 'rates' ? (
            <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>
              robot {fmtRate(entry.robotExt, entry.robotCount)}/u · ours {fmtRate(entry.ourExt, entry.ourCount)}/u ×{fmtQty(entry.ourCount)}
            </span>
          ) : (
            <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>×{fmtQty(bucket === 'missed' ? entry.ourCount : entry.robotCount)}</span>
          )}
          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: entry.impact < 0 ? 'var(--text-red-600)' : 'var(--text-amber-800)' }}>
            {entry.impact < 0 ? '−' : '+'}{fmtUsd(entry.impact)}
          </span>
          {audit.status === 'pending' && canWrite ? (
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
              {VERDICT_BUTTONS.map(({ verdict, label, onBg, onFg }) => {
                const on = posted === verdict || open?.verdict === verdict
                return (
                  <button
                    key={verdict}
                    type="button"
                    disabled={!!posted}
                    onClick={() => tapVerdict(audit, entry, verdict, bucket)}
                    style={{ border: `1px solid ${on ? onFg : 'var(--border-strong)'}`, background: on ? onBg : 'var(--surface)', color: on ? onFg : 'var(--text-700)', borderRadius: 6, padding: '0.12rem 0.5rem', cursor: posted ? 'default' : 'pointer', fontSize: '0.75rem', fontWeight: on ? 700 : 400, opacity: posted && posted !== verdict ? 0.4 : 1 }}
                  >
                    {posted === verdict ? `${label} ✓` : label}
                  </button>
                )
              })}
            </span>
          ) : null}
          {open ? (
            <span style={{ width: '100%', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                type="text"
                value={open.text}
                onChange={(e) => setVerdictDraft((p) => ({ ...p, [stateKey]: { ...open, text: e.target.value } }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void postVerdictDraft(audit, entry, bucket)
                }}
                style={{ flex: 1, padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                disabled={busy === `verdict:${stateKey}` || !open.text.trim()}
                onClick={() => void postVerdictDraft(audit, entry, bucket)}
                style={{ padding: '0.3rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                Post
              </button>
            </span>
          ) : null}
        </div>
      )

    }
    // v2.4261: a missed ↔ added pair that looks like one item — one row, two taps.
    const renderPairRow = (p: AliasPair) => {
      const k = pairKey(p)
      const posted = aliasAnswer[k] === 'posted'
      return (
        <div key={`pair:${k}`} data-testid="alias-pair" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.65rem', border: '1px dashed var(--border-strong)', borderRadius: 6, fontSize: '0.8125rem', flexWrap: 'wrap', background: 'var(--bg-subtle)' }}>
          <span>
            {p.missed.label} <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>×{fmtQty(p.missed.ourCount)} missed</span>{' '}
            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--text-red-600)' }}>−{fmtUsd(p.missed.ourExt)}</span>
            <span style={{ color: 'var(--text-muted)' }}> ≈ </span>
            {p.added.label} <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>×{fmtQty(p.added.robotCount)} added</span>{' '}
            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--text-amber-800)' }}>+{fmtUsd(p.added.robotExt)}</span>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>one item, two names?</span>
          {audit.status === 'pending' && canWrite ? (
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
              <button
                type="button"
                disabled={posted}
                onClick={() => postAlias(p)}
                style={{ border: `1px solid ${posted ? 'var(--text-green-800)' : 'var(--border-strong)'}`, background: posted ? 'var(--bg-green-tint)' : 'var(--surface)', color: posted ? 'var(--text-green-800)' : 'var(--text-700)', borderRadius: 6, padding: '0.12rem 0.5rem', cursor: posted ? 'default' : 'pointer', fontSize: '0.75rem', fontWeight: posted ? 700 : 400 }}
              >
                {posted ? 'Same item — teach the name ✓' : 'Same item — teach the name'}
              </button>
              {!posted ? (
                <button type="button" onClick={() => splitPair(p)} style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 6, padding: '0.12rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                  No, two things
                </button>
              ) : null}
            </span>
          ) : null}
        </div>
      )
    }
    return (
      <div key={audit.id} data-testid="audit-card" style={{ border: twoPanes ? '2px solid #3b82f6' : 'none', borderRadius: twoPanes ? 8 : 0, background: 'var(--surface)', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontWeight: 600 }}>{jobNameFromShell(audit.bids?.project_name)}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>robot's copy {bidLabel}{ref?.refNumber ? ` · ours b${ref.refNumber}` : ''}</span>
          {!twoPanes ? (
            <button type="button" onClick={closeCard} aria-label="Close" title="Back to the queue" style={{ marginLeft: 'auto', order: 9, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '0.2rem 0.55rem', cursor: 'pointer', font: 'inherit', color: 'var(--text-muted)' }}>✕</button>
          ) : null}
          <span style={{ padding: '0.15rem 0.6rem', borderRadius: 999, background: chip.bg, color: chip.fg, fontSize: '0.75rem' }}>{chip.label}</span>
          {unpriced ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>no counts in PipeTooling yet</span>
          ) : draft ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              draft ${Math.round(draft.total).toLocaleString()} · {draft.rowCount} rows
            </span>
          ) : null}
          {audit.status === 'pending' && openQ > 0 ? (
            <span style={{ color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>{openQ} unanswered question{openQ === 1 ? '' : 's'}</span>
          ) : null}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            {formatAuditRequestedStamp(audit.requested_at)}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {audit.ct_view_url ? (
            <a href={audit.ct_view_url} target="_blank" rel="noreferrer" style={linkBtnStyle}>
              Open takeoff (CountTooling) ↗
            </a>
          ) : (
            <span style={{ ...linkBtnStyle, opacity: 0.5, cursor: 'default' }}>Takeoff link pending</span>
          )}
          <a href={`/bids?tab=counts&bidId=${audit.bid_id}`} target="_blank" rel="noreferrer" style={linkBtnStyle}>
            Open bid (ClickTooling) ↗
          </a>
        </div>

        {/* The robot confesses first: check its suspicions, don't hunt. */}
        {audit.self_assessment ? (() => {
          // v2.4261: two sentences; the rest a tap away.
          const { lead, restWords } = selfAssessmentLead(audit.self_assessment)
          const open = foldOpen(`${audit.id}:least-sure`)
          return (
            <div style={{ borderLeft: '3px solid #7c3aed', background: 'var(--bg-subtle)', borderRadius: '0 8px 8px 0', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <span style={{ fontWeight: 700, color: '#7c3aed' }}>🤖 Where I&apos;m least sure:</span> {open || restWords === 0 ? audit.self_assessment : lead}
              {restWords > 0 ? (
                <>
                  {' '}
                  <button type="button" onClick={() => toggleFold(`${audit.id}:least-sure`)} style={foldBtn}>
                    {open ? 'fold it ▴' : `read the rest (about ${restWords} more words) ▸`}
                  </button>
                </>
              ) : null}
            </div>
          )
        })() : null}

        {unpriced ? (
          <div style={{ border: '1px dashed var(--border)', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            🛠 The robot hasn&apos;t pasted its takeoff into this bid&apos;s Counts tab yet, so there is no draft to price or compare.
            Its questions are still worth answering; hold the verdicts until the rows land.
          </div>
        ) : null}
        {/* Comparison strip: the evidence comes to the card. */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span style={statBoxStyle}>
            <span style={statLabelStyle}>Robot draft</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{draft && !unpriced ? `$${Math.round(draft.total).toLocaleString()}` : '—'}</span>
            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{draft && !unpriced ? `${draft.rowCount} rows` : unpriced ? 'no rows yet' : ''}</span>
          </span>
          <span style={statBoxStyle}>
            <span style={statLabelStyle}>
              Ours{ref?.refNumber ? ` (b${ref.refNumber})` : ''}
            </span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
              {ref?.refValue != null ? `$${Math.round(ref.refValue).toLocaleString()}` : '—'}
            </span>
          </span>
          {deltaPct != null ? (
            <span style={statBoxStyle}>
              <span style={statLabelStyle}>Delta</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: Math.abs(deltaPct) <= 8 ? 'var(--text-emerald-800)' : 'var(--text-red-600)' }}>
                {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
              </span>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{deltaPct > 0 ? 'robot over' : 'robot under'}</span>
            </span>
          ) : null}
        </div>

        {/* Delta waterfall (v2.2935): the headline decomposed into named
            dollars that sum back to it — scope, counts, rates, and the
            remainder the row diff cannot see (letter uplift, in-tolerance
            drift). Rates was the invisible bucket until now. */}
        {diff && draft && !unpriced && ref?.refValue != null ? (() => {
          const wf = diffWaterfall(diff, draft.total, ref.refValue)
          const segs = WATERFALL_SEGMENTS.filter((s) => Math.abs(wf[s.key]) >= 1)
          if (!segs.length) return null
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem', fontSize: '0.75rem' }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.65rem' }}>Where the delta lives</span>
              {segs.map((s, i) => (
                <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {i > 0 ? <span style={{ color: 'var(--text-muted)' }}>·</span> : null}
                  <span style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0.1rem 0.55rem', background: 'var(--bg-subtle)' }}>
                    {s.label}{' '}
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: wf[s.key] < 0 ? 'var(--text-red-600)' : 'var(--text-amber-800)' }}>
                      {wf[s.key] < 0 ? '−' : '+'}{fmtUsd(wf[s.key])}
                    </span>
                  </span>
                </span>
              ))}
              <span style={{ color: 'var(--text-muted)' }}>=</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
                {wf.delta < 0 ? '−' : '+'}{fmtUsd(wf.delta)} vs ours
              </span>
            </div>
          )
        })() : null}

        {/* The diff: judge each difference with one tap — the six biggest first (v2.4261), the rest under the fold. */}
        {diff && top ? (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.35rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>The {top.rows.length === 1 ? 'biggest difference' : `${top.rows.length} biggest differences`}</span>
              <span style={{ textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>judge these first{top.hidden > 0 ? `; the other ${top.hidden} ${top.hidden === 1 ? 'is' : 'are'} under the fold` : ''}</span>
            </div>
            <div data-testid="top-differences" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
              {top.rows.map((r) => (r.kind === 'entry' ? renderDiffRow(r.entry, r.bucket) : renderPairRow(r.pair)))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.75rem', alignItems: 'baseline', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {top.hidden > 0 ? (
                <button type="button" onClick={() => toggleFold(`${audit.id}:rest`)} style={foldBtn}>{top.hidden} more difference{top.hidden === 1 ? '' : 's'} {foldOpen(`${audit.id}:rest`) ? '▴' : '▸'}</button>
              ) : null}
              {foldedPairs.length > 0 ? (
                <button type="button" onClick={() => toggleFold(`${audit.id}:pairs`)} style={foldBtn}>
                  {foldedPairs.length} more pair{foldedPairs.length === 1 ? '' : 's'} that look like one item: {foldedPairs.map(pairLabel).join(' · ')} {foldOpen(`${audit.id}:pairs`) ? '▴' : '▸'}
                </button>
              ) : null}
              {rollup && rollup.length > 0 ? (
                <button type="button" onClick={() => toggleFold(`${audit.id}:systems`)} style={foldBtn}>
                  the system table: {rollup.map((row) => `${row.label.toLowerCase()} ${row.ours > 0 ? `${(row.robot / row.ours).toFixed(2)}×` : '—'}`).join(' · ')} {foldOpen(`${audit.id}:systems`) ? '▴' : '▸'}
                </button>
              ) : null}
            </div>
            {foldOpen(`${audit.id}:pairs`) && foldedPairs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>{foldedPairs.map((p) => renderPairRow(p))}</div>
            ) : null}
            {foldOpen(`${audit.id}:systems`) && rollup && rollup.length > 0 ? (
          <div style={{ marginBottom: '1rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  {['System', 'Robot', 'Ours', 'Ratio'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'System' ? 'left' : 'right', fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.2rem 0.5rem', borderBottom: '2px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rollup.map((row) => {
                  const ratio = row.ours > 0 ? row.robot / row.ours : null
                  const ratioOk = ratio != null && ratio >= 0.85 && ratio <= 1.15
                  return (
                    <tr key={row.label}>
                      <td style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)' }}>{row.label} ({row.unit})</td>
                      <td style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{fmtQty(row.robot)}</td>
                      <td style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{fmtQty(row.ours)}</td>
                      <td style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: ratio == null ? 'var(--text-muted)' : ratioOk ? 'var(--text-emerald-800)' : 'var(--text-red-600)' }}>
                        {ratio == null ? '—' : `${ratio.toFixed(2)}×`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
            ) : null}
            {foldOpen(`${audit.id}:rest`) ? DIFF_BUCKETS.map(({ bucket, tag, tagBg, tagFg, blurb }) => {
              // The buckets as they were, less the six above and the rows a pair stands for.
              const entries = diff[bucket].filter((e) => !topKeys.has(`${bucket}:${e.key}`) && !pairedKeys.has(`${bucket}:${e.key}`))
              if (!entries.length) return null
              const shown = entries.filter((e, i) => Math.abs(e.impact) >= DIFF_IMPACT_FLOOR || i < 3).slice(0, DIFF_BUCKET_CAP)
              const hidden = entries.length - shown.length
              return (
                <div key={bucket} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    <span style={{ background: tagBg, color: tagFg, borderRadius: 4, padding: '0.05rem 0.45rem', letterSpacing: '0.04em' }}>{tag} · {entries.length}</span>
                    <span style={{ textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>{blurb}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {shown.map((entry) => renderDiffRow(entry, bucket))}
                    {hidden > 0 ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.1rem 0.65rem' }}>
                        + {hidden} smaller under ${DIFF_IMPACT_FLOOR.toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            }) : null}
            {diff.matchedOkCount > 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-emerald-800)' }}>
                ✓ {diff.matchedOkCount} row{diff.matchedOkCount === 1 ? '' : 's'} match within 15% on count and rate — nothing to judge there
              </div>
            ) : null}
          </div>
        ) : audit.status === 'pending' && robotRows && robotRows.length > 0 ? (
          /* No reference rows to diff against — fall back to judging the robot's biggest rows. */
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Biggest rows — tap to judge (a flag drafts the note for you)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {robotRows.slice(0, 8).map((row) => {
                const judged = rowJudgments[row.id]
                return (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                    <span>{row.name}</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>×{fmtQty(row.count)}</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>${Math.round(row.ext).toLocaleString()}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        disabled={!canWrite}
                        onClick={() => {
                          setRowJudgments((prev) => ({ ...prev, [row.id]: 'flagged' }))
                          setComposerSection((prev) => ({ ...prev, [audit.id]: entrySection(row.name) }))
                          setComposer((prev) => ({ ...prev, [cardComposerKey]: `${row.name} — robot has ×${row.count} ($${Math.round(row.ext).toLocaleString()}): ` }))
                        }}
                        style={{ border: `1px solid ${judged === 'flagged' ? 'var(--text-red-600)' : 'var(--border-strong)'}`, background: judged === 'flagged' ? 'var(--bg-red-100)' : 'var(--surface)', borderRadius: 6, padding: '0.15rem 0.6rem', cursor: 'pointer', fontSize: '0.8125rem' }}
                      >
                        🚩
                      </button>
                      <button
                        type="button"
                        onClick={() => setRowJudgments((prev) => ({ ...prev, [row.id]: prev[row.id] === 'ok' ? undefined as never : 'ok' }))}
                        style={{ border: `1px solid ${judged === 'ok' ? 'var(--text-emerald-800)' : 'var(--border-strong)'}`, background: judged === 'ok' ? 'var(--bg-green-tint)' : 'var(--surface)', borderRadius: 6, padding: '0.15rem 0.6rem', cursor: 'pointer', fontSize: '0.8125rem' }}
                      >
                        👍
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
        {threaded.questions.length > 0 ? (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Its {threaded.questions.length === 1 ? 'question' : `${threaded.questions.length} questions`}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>the ones about this bid; a job-wide question goes to the run-through above</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(foldOpen(`${audit.id}:questions`) ? threaded.questions : threaded.questions.slice(0, 1)).map(({ question, answer }) => {
                const key = `answer:${question.id}`
                const contextLine = questionContextLine(question)
                return (
                  <div key={question.id} style={{ padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.875rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          marginRight: '0.5rem',
                          padding: '0.05rem 0.45rem',
                          borderRadius: 9999,
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          verticalAlign: 'middle',
                        }}
                      >
                        {AUDIT_SECTION_LABELS[question.section]}
                      </span>
                      🤖 {question.body}
                    </div>
                    {contextLine ? (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {contextLine}
                      </div>
                    ) : null}
                    {answer ? (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.875rem', color: 'var(--text-green-800)' }}>✓ {answer.body}</div>
                    ) : audit.status === 'pending' && canWrite ? (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input
                          type="text"
                          value={composer[key] ?? ''}
                          onChange={(e) => setComposer((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder="Type your answer…"
                          style={{ flex: 1, padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                        />
                        <button
                          type="button"
                          disabled={busy === key || !(composer[key] ?? '').trim()}
                          onClick={() => void insertNote(audit, question.section, 'answer', composer[key] ?? '', question.id, key)}
                          style={{ padding: '0.4rem 0.9rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Answer
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Unanswered</div>
                    )}
                  </div>
                )
              })}
              {threaded.questions.length > 1 ? (
                <button type="button" onClick={() => toggleFold(`${audit.id}:questions`)} style={{ ...foldBtn, alignSelf: 'flex-start' }}>
                  {foldOpen(`${audit.id}:questions`) ? 'fewer questions ▴' : `${threaded.questions.length - 1} more question${threaded.questions.length === 2 ? '' : 's'} ▸`}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {threaded.sections.filter(({ items }) => items.length > 0).map(({ section, items }) => {
            return (
              <div key={section}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-700)', marginBottom: '0.35rem' }}>
                  {AUDIT_SECTION_LABELS[section]}
                </div>
                {items.map(({ note: n, receipt }) => (
                  <div key={n.id} style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.875rem' }}>{n.body}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {n.author?.name ?? 'staff'} · {calendarYmdInAppTzFromIso(n.created_at)}
                    </div>
                    {receipt ? (
                      <div style={{ marginTop: '0.4rem', paddingLeft: '0.75rem', borderLeft: '2px solid var(--bg-green-tint, var(--border))', fontSize: '0.8125rem', color: 'var(--text-green-800)' }}>
                        🤖 → {receipt.body}
                        {receipt.digest_outcome ? (
                          <span style={{ marginLeft: '0.4rem', color: 'var(--text-muted)' }}>({AUDIT_DIGEST_OUTCOME_LABELS[receipt.digest_outcome]})</span>
                        ) : null}
                      </div>
                    ) : audit.status !== 'pending' ? (
                      <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Awaiting robot receipt…</div>
                    ) : null}
                  </div>
                ))}

              </div>
            )
          })}
        </div>
        {audit.status === 'pending' && canWrite ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.9rem' }}>
            {(['general', 'counts', 'footage', 'pricing', 'scope'] as AuditSection[]).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setComposerSection((prev) => ({ ...prev, [audit.id]: sec }))}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: cardSection === sec ? '#3b82f6' : 'var(--border)',
                  background: cardSection === sec ? '#3b82f6' : 'var(--surface)',
                  color: cardSection === sec ? 'white' : 'var(--text-muted)',
                  borderRadius: 999,
                  padding: '0.15rem 0.65rem',
                  cursor: 'pointer',
                }}
              >
                {AUDIT_SECTION_LABELS[sec]}
              </button>
            ))}
            <textarea
              value={composer[cardComposerKey] ?? ''}
              onChange={(e) => setComposer((p) => ({ ...p, [cardComposerKey]: e.target.value }))}
              placeholder="Anything off? One box — pick a section chip if it fits."
              rows={(composer[cardComposerKey] ?? '').includes('\n') ? 3 : 1}
              style={{ flex: '1 1 260px', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <button
              type="button"
              disabled={busy === cardComposerKey || !(composer[cardComposerKey] ?? '').trim()}
              onClick={() => void insertNote(audit, cardSection, 'note', composer[cardComposerKey] ?? '', null, cardComposerKey)}
              style={{ padding: '0.4rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Add note
            </button>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          {!canWrite ? null : audit.status === 'pending' ? (
            <button
              type="button"
              disabled={busy === `finish:${audit.id}`}
              onClick={() => void finishAudit(audit)}
              style={{ padding: '0.5rem 1.25rem', background: 'var(--bg-green-tint)', border: '1px solid var(--text-green-800)', borderRadius: 4, color: 'var(--text-green-800)', cursor: 'pointer', fontWeight: 500 }}
            >
              {finishLabel(queue)}
            </button>
          ) : audit.status === 'done' ? (
            <button
              type="button"
              disabled={busy === `finish:${audit.id}`}
              onClick={() => void reopenAudit(audit)}
              style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-700)', cursor: 'pointer' }}
            >
              Reopen
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* v2.4232 (punch list #63): one sentence sizes today, one button runs the questions. */}
      {canWrite && rulingsAvailable ? (
        <div data-testid="audits-today" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.95rem' }}>{todaySentence}</span>
          {runItems.length > 0 ? (
            <button
              type="button"
              onClick={() => setRunThrough({ start: 0 })}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Answer the {rulingsView.openCount} question{rulingsView.openCount === 1 ? '' : 's'}
            </button>
          ) : null}
        </div>
      ) : null}
      {runThrough ? (
        <RulingRunThroughSheet
          items={runItems}
          startIndex={runThrough.start}
          bidIdByNumber={bidIdByNumber}
          bidNumberById={bidNumberById}
          sourceByBidId={sourceByBidId}
          audienceWritable={audienceWritable}
          busy={busy?.startsWith('ruling:') ?? false}
          onAnswer={(item: RunThroughItem, text: string) => answerRuling(item.questionIds, item.key, text)}
          onNotMine={(item: RunThroughItem) => bounceToOperator(item.questionIds, item.key)}
          onDismiss={(item: RunThroughItem) => dismissRulingQuestions(item.questionIds, item.key)}
          onClose={() => setRunThrough(null)}
        />
      ) : null}
      {/* The questions panel (the standing rulings, v2.2941): the robots' open questions,
          deduped by doctrine topic — one line per question since v2.4232; the sheet answers. */}
      {canWrite && rulingsAvailable ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setRulingsOpen(!rulingsExpanded)}
            title="The standing rulings — every question the robots have parked while working, from every bid; one answer lands on every open copy"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.6rem 0.9rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', flexWrap: 'wrap' }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Questions · {rulingsView.openCount}</span>
            {questionsHeaderLine(runItems) ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>· {questionsHeaderLine(runItems)}</span> : null}
            {rulingsView.legacyAsks.length > 0 ? (
              <span style={{ color: 'var(--text-amber-800)', fontSize: '0.78rem' }}>· {rulingsView.legacyAsks.length} for the owner</span>
            ) : null}
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{rulingsExpanded ? '▾' : '▸'}</span>
          </button>
          {rulingsExpanded ? (
            <div style={{ padding: '0 0.9rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {rulingsView.openCount === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No open questions for an estimator — every robot has its answer.</div>
              ) : null}
              {indexItems.map((item, i) => (
                <button
                  key={item.key}
                  type="button"
                  data-testid="question-line"
                  onClick={() => setRunThrough({ start: i })}
                  title="Open the run-through at this question"
                  style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', fontSize: '0.8125rem', flexWrap: 'wrap' }}
                >
                  {item.label ? (
                    <span style={{ display: 'inline-block', padding: '0.05rem 0.45rem', borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-700)', fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  ) : null}
                  {item.aboutBidIds.length > 1 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{item.aboutBidIds.length} bids</span> : null}
                  <span style={{ flex: '1 1 260px' }}>{questionLine(item.newest.question)}</span>
                  <span style={{ color: item.choices?.some((c) => c.recommended) ? 'var(--text-blue-700, var(--text-700))' : 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const star = item.choices?.find((c) => c.recommended)
                      return star ? `★ ${star.label}` : 'no pick'
                    })()}
                  </span>
                </button>
              ))}
              {runItems.length > QUESTION_INDEX_FOLD ? (
                <button type="button" onClick={() => setShowAllQuestions((v) => !v)} style={{ alignSelf: 'flex-start', padding: '0.25rem 0.6rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>
                  {showAllQuestions ? 'Show fewer' : `Show all ${runItems.length}`}
                </button>
              ) : null}
              {rulingsView.plansAsks.length > 0 ? (() => {
                // v2.3212: plans asks are tasks on one bid each — the robot needs a
                // different plan set. They live on that bid's robot needs sheet; here
                // is only the pointer, one link per HUMAN bid (a shell's ask maps to
                // its source through the same pairing the "ours b214" links use).
                const targets = new Map<string, { id: string; number: string | null }>()
                for (const q of rulingsView.plansAsks) {
                  if (!q.about_bid_id) continue
                  const src = sourceByBidId[q.about_bid_id]
                  const id = src?.id ?? q.about_bid_id
                  if (!targets.has(id)) targets.set(id, { id, number: src?.number ?? bidNumberById[id] ?? null })
                }
                const list = [...targets.values()]
                return (
                  <div data-testid="rulings-plans-asks" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Also: {list.length === 1 ? 'one bid needs' : `${list.length} bids need`} a different plan set — that is a fix on the bid, not a question:{' '}
                    {list.map((t, i) => (
                      <span key={t.id}>
                        {i > 0 ? ' · ' : ''}
                        <a
                          href={`/bids?tab=bid-board&bidId=${encodeURIComponent(t.id)}&robot=needs`}
                          target="_blank"
                          rel="noreferrer"
                          title="Opens the bid's robot needs sheet on the Bid Board — Edit bid, Copy intake address, and the robot's taps"
                          aria-label={`Fix the plan set on ${t.number ? `b${t.number}` : 'this bid'}`}
                          style={{ color: 'var(--text-link)', fontWeight: 600 }}
                        >
                          {t.number ? `b${t.number}` : 'open bid'}
                        </a>
                      </span>
                    ))}
                  </div>
                )
              })() : null}
              {rulingsView.legacyAsks.length > 0 ? (
                // v2.3232: an ask written before the one-decision rule is the owner's to split
                // into taps (or dismiss) on the Console — the panel only says it is waiting.
                <div data-testid="rulings-legacy-asks" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  🧾 {rulingsView.legacyAsks.length === 1 ? 'One ask' : `${rulingsView.legacyAsks.length} asks`} written before the one-decision rule
                  {rulingsView.legacyAsks.length === 1 ? ' waits' : ' wait'} for the owner to split into taps —{' '}
                  {myRole === 'dev' ? (
                    <a href="/bids?tab=robot-console" style={{ color: 'var(--text-link)' }}>
                      Robots → Console
                    </a>
                  ) : (
                    <span>on the robots' Console</span>
                  )}
                </div>
              ) : null}
              {myRole === 'dev' && operatorOpen > 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  🛠 {operatorOpen} robot problem{operatorOpen === 1 ? '' : 's'} for the operator —{' '}
                  <a href="/bids?tab=robot-console" style={{ color: 'var(--text-link)' }}>
                    Robots → Console
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        {canWrite ? (
          <>
            Robot bids waiting on a human audit. The card shows where the robot and our bid differ — judge each
            difference with one tap, answer its questions, and it learns from every verdict.
          </>
        ) : (
          <>Robot bids and their audit trail — view only for your role.</>
        )}
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading audits…</div>
      ) : audits.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No audits yet — the robot opens one here whenever it finishes a draft bid.</div>
      ) : (
        <div style={twoPanes ? { display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) minmax(0, 3fr)', gap: '1rem', alignItems: 'start' } : undefined}>
          {/* v2.4234: the queue — Now · Up next · Opens when you send · Digesting · Digested. */}
          <div data-testid="audit-queue" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(() => {
              const sectionHead = (title: string, count: string, caption?: string | null) => (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  <span>{title}</span>
                  <span style={{ fontWeight: 500 }}>{count}</span>
                  {caption ? <span style={{ textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>· {caption}</span> : null}
                </div>
              )
              const row = (item: AuditQueueItem, opts?: { sealed?: boolean }) => {
                const open = item.id === expandedId
                const delta = deltaWord(item.deltaPct)
                const chip = item.status === 'done' ? STATUS_CHIP.done : item.status === 'digested' ? STATUS_CHIP.digested : null
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid="audit-row"
                    aria-current={open ? 'true' : undefined}
                    onClick={() => openCard(item.id)}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.55rem', alignItems: 'baseline', width: '100%', border: `1px ${opts?.sealed ? 'dashed' : 'solid'} ${open ? '#3b82f6' : 'var(--border)'}`, borderRadius: 8, background: open ? 'var(--bg-blue-tint, var(--bg-subtle))' : opts?.sealed ? 'var(--bg-subtle)' : 'var(--surface)', padding: '0.5rem 0.75rem', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{jobNameFromShell(item.shellName)}</span>
                    {delta ? (
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: '0.8125rem', color: Math.abs(item.deltaPct ?? 0) <= 8 ? 'var(--text-emerald-800)' : 'var(--text-red-600)' }}>{delta}</span>
                    ) : null}
                    {chip ? <span style={{ padding: '0.05rem 0.5rem', borderRadius: 999, background: chip.bg, color: chip.fg, fontSize: '0.68rem' }}>{chip.label}</span> : null}
                    <span style={{ width: '100%', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {opts?.sealed ? `🔒 ${sealedLine(item)}` : whyLine(item)}
                    </span>
                  </button>
                )
              }
              return (
                <>
                  {queue.now ? (
                    <div data-testid="queue-now">
                      {sectionHead('Now', queue.nowPosition != null ? `${queue.nowPosition} of ${queue.workableCount}` : '', pickedByHand ? 'you picked it' : null)}
                      {row(queue.now)}
                    </div>
                  ) : null}
                  {queue.upNext.length > 0 ? (
                    <div data-testid="queue-up-next">
                      {sectionHead('Up next', String(queue.upNext.length), 'by what your verdict unblocks')}
                      {queue.upNextSlates.length > 0 ? (
                        <div data-testid="queue-slates" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem', alignItems: 'baseline', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                          {queue.upNextSlates.map((sl) => (
                            <span key={sl.key} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'baseline' }}>
                              <span>{sl.key} · {sl.count}</span>
                              <button type="button" aria-label={`Skip the ${sl.key} slate`} onClick={() => parkSlate(sl.key)} style={{ ...linkBtnStyle, fontSize: 'inherit' }}>Skip this slate</button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>{queue.upNext.map((i) => row(i))}</div>
                    </div>
                  ) : queue.now == null && queue.workableCount === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{queue.parked.length > 0 ? 'Nothing waiting on a verdict outside the parked slates.' : 'Nothing waiting on a verdict.'}</div>
                  ) : null}
                  {queue.sealed.length > 0 ? (
                    <div data-testid="queue-sealed">
                      <button type="button" onClick={() => setSealedOpen((v) => !v)} aria-expanded={sealedOpen} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left', width: '100%' }}>
                        {sectionHead('Opens when you send', `${queue.sealed.length} ${sealedOpen ? '▾' : '▸'}`, sealedOpen ? null : queue.sealed.slice(0, 4).map((i) => jobNameFromShell(i.shellName)).join(' · ') + (queue.sealed.length > 4 ? ' · …' : ''))}
                      </button>
                      {sealedOpen ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>{queue.sealed.map((i) => row(i, { sealed: true }))}</div> : null}
                    </div>
                  ) : null}
                  {queue.parked.length > 0 ? (
                    <div data-testid="queue-parked">
                      <button type="button" onClick={() => setParkedOpen((v) => !v)} aria-expanded={parkedOpen} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left', width: '100%' }}>
                        {sectionHead('Parked', `${queue.parked.reduce((n, sl) => n + sl.items.length, 0)} ${parkedOpen ? '▾' : '▸'}`, parkedOpen ? null : queue.parked.map((sl) => sl.key).join(' · '))}
                      </button>
                      {parkedOpen
                        ? queue.parked.map((sl) => (
                            <div key={sl.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>{sl.key} · {sl.items.length} audit{sl.items.length === 1 ? '' : 's'}</span>
                                <button type="button" aria-label={`Bring the ${sl.key} slate back`} onClick={() => bringBackSlate(sl.key)} style={{ ...linkBtnStyle, fontSize: 'inherit' }}>Bring it back</button>
                              </div>
                              {sl.items.map((i) => row(i))}
                            </div>
                          ))
                        : null}
                    </div>
                  ) : null}
                  {queue.digesting.length > 0 ? (
                    <div data-testid="queue-digesting">
                      {sectionHead('Digesting', String(queue.digesting.length), 'waiting on the robot\u2019s receipts')}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>{queue.digesting.map((i) => row(i))}</div>
                    </div>
                  ) : null}
                  {queue.digested.length > 0 ? (
                    <div data-testid="queue-digested">
                      <button type="button" onClick={() => setShowDigested((v) => !v)} aria-expanded={showDigested} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left', width: '100%' }}>
                        {sectionHead('Digested', `${queue.digested.length} ${showDigested ? '▾' : '▸'}`, showDigested ? null : 'show')}
                      </button>
                      {showDigested ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>{queue.digested.map((i) => row(i))}</div> : null}
                    </div>
                  ) : null}
                </>
              )
            })()}
          </div>
          {/* The open card: the right pane, sticky at the top; a full-screen panel below 1151 px. */}
          {(() => {
            const audit = expandedId ? audits.find((a) => a.id === expandedId) : undefined
            if (!audit || isSealed(audit)) return twoPanes ? <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem' }}>Tap a row to open its card.</div> : null
            return twoPanes ? (
              <div style={{ position: 'sticky', top: '0.5rem', maxHeight: 'calc(100vh - 1rem)', overflowY: 'auto' }}>{renderCard(audit)}</div>
            ) : (
              <div role="dialog" aria-modal aria-label={jobNameFromShell(audit.bids?.project_name)} style={{ position: 'fixed', inset: 0, background: 'var(--surface)', zIndex: 1004, overflowY: 'auto', paddingTop: 'var(--app-top-chrome, 0px)' }}>{renderCard(audit)}</div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
