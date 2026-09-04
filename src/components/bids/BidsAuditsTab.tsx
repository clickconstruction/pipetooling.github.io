import { useCallback, useEffect, useState } from 'react'
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
  type AuditDigestOutcome,
  type BidAuditRow,
  type BidAuditNoteRow,
} from '../../lib/bids/bidAudits'
import {
  diffTakeoffs,
  rollupSystems,
  buildVerdictDraft,
  entrySection,
  type AuditVerdict,
  type DiffEntry,
} from '../../lib/bids/takeoffDiff'

/**
 * The Audits tab, cockpit v2 (v2.2553): judge the differences, coach the robot.
 * The twin's rows and the reference bid's rows are name-matched into a true diff
 * (missed / added / quantity gaps), each difference takes a one-tap verdict that
 * posts a tagged note the digest can triage mechanically, the card opens with the
 * robot's own self-assessment, and a coaching strip shows what past notes became.
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
type RefInfo = { refId: string; refNumber: string | null; refValue: number | null; refSent: boolean; refVersionId: string | null }
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
  bucket: 'missed' | 'added' | 'gaps'
  tag: string
  tagBg: string
  tagFg: string
  blurb: string
}> = [
  { bucket: 'missed', tag: 'ROBOT MISSED', tagBg: 'var(--bg-red-100)', tagFg: 'var(--text-red-600)', blurb: 'rows we carry that it doesn’t — the dangerous kind' },
  { bucket: 'added', tag: 'ROBOT ADDED', tagBg: 'var(--bg-amber-tint)', tagFg: 'var(--text-amber-800)', blurb: 'rows it carries that we don’t — overreach, or something we missed?' },
  { bucket: 'gaps', tag: 'QUANTITY GAPS', tagBg: 'var(--bg-blue-tint, var(--bg-muted))', tagFg: 'var(--text-blue-700, var(--text-700))', blurb: 'same row, different number' },
]

export function BidsAuditsTab({ authUser, myRole }: { authUser: User | null; myRole: string | null }) {
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
  // Cockpit: one card open at a time; the rest collapse to triage rows.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // twin bid_id -> its reference (comparison + diff; sealed while the ref is unsent).
  const [refByBidId, setRefByBidId] = useState<Record<string, RefInfo>>({})
  // Priced active-version rows per bid (twin AND reference) for the diff, lazy per card.
  const [pricedRowsByBid, setPricedRowsByBid] = useState<Record<string, PricedRow[]>>({})
  // Verdict drafts open for editing + verdicts already posted this session.
  const [verdictDraft, setVerdictDraft] = useState<Record<string, { verdict: AuditVerdict; text: string }>>({})
  const [verdictPosted, setVerdictPosted] = useState<Record<string, AuditVerdict>>({})
  // Fallback judge list (no reference rows to diff against): local 👍 acks / 🚩 flags.
  const [rowJudgments, setRowJudgments] = useState<Record<string, 'ok' | 'flagged'>>({})
  const [composerSection, setComposerSection] = useState<Record<string, AuditSection>>({})

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
          const shadowRuns = ((await auditDb.rpc('list_shadow_runs')).data ?? []) as Array<{ shadow_bid_number: string | null; reference_bid_number: string | null; reference_sent_at: string | null }>
          const pairing = pairTwinReferences(twins, shadowRuns)
          const refIds = [...new Set([...pairing.values()].map((k) => k.refId).filter((x): x is string => !!x))]
          const refNumbers = [...new Set([...pairing.values()].filter((k) => !k.refId).map((k) => k.refNumber).filter((x): x is string => !!x))]
          type RefRow = { id: string; bid_number: string | null; bid_value: number | string | null; bid_date_sent: string | null; selected_bid_version_id: string | null }
          const REF_COLS = 'id, bid_number, bid_value, bid_date_sent, selected_bid_version_id'
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
              refVersionId: r.selected_bid_version_id,
            }
          }
          setRefByBidId(out)
        } catch {
          /* strip is optional context — never block the tab */
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

  // Auto-expand the first workable pending card — never a sealed shadow. Re-runs
  // when the refs land so a briefly-expanded sealed card snaps shut.
  useEffect(() => {
    setExpandedId((cur) => {
      const current = audits.find((a) => a.id === cur)
      if (current && !isSealed(current)) return cur
      return audits.find((a) => a.status === 'pending' && !isSealed(a) && !isUnpricedAudit(draftByAudit[a.id]))?.id ?? null
    })
  }, [audits, isSealed, draftByAudit])

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
          const rows = ((await auditDb.from('bids_count_rows').select('id, fixture, count, bid_version_id').eq('bid_id', t.bidId)).data ?? []) as Array<{ id: string; fixture: string; count: number; bid_version_id: string | null }>
          const assigns = ((await auditDb.from('bid_pricing_assignments').select('count_row_id, price_book_entry_id, unit_price_override').eq('bid_id', t.bidId)).data ?? []) as Array<{ count_row_id: string; price_book_entry_id: string | null; unit_price_override: number | null }>
          const entryIds = [...new Set(assigns.map((a) => a.price_book_entry_id).filter((x): x is string => !!x))]
          const entries = entryIds.length ? (((await auditDb.from('price_book_entries').select('id, total_price').in('id', entryIds)).data ?? []) as Array<{ id: string; total_price: number | null }>) : []
          const priceById = new Map(entries.map((e) => [e.id, e.total_price ?? 0]))
          const byRow = new Map(assigns.map((a) => [a.count_row_id, a]))
          const priced = rows
            .filter((r) => (t.version ? r.bid_version_id === t.version : r.bid_version_id == null))
            .map((r) => {
              const a = byRow.get(r.id)
              const unit = a ? (a.unit_price_override ?? (a.price_book_entry_id ? (priceById.get(a.price_book_entry_id) ?? 0) : 0)) : 0
              return { id: r.id, name: r.fixture, count: Number(r.count), ext: Number(r.count) * Number(unit) }
            })
            .sort((a, b) => b.ext - a.ext)
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
  const tapVerdict = (audit: AuditWithBid, entry: DiffEntry, verdict: AuditVerdict) => {
    const stateKey = `${audit.id}:${entry.key}`
    if (verdictPosted[stateKey]) return
    if (verdict === 'ok') {
      setVerdictPosted((p) => ({ ...p, [stateKey]: 'ok' }))
      void insertNote(audit, entrySection(entry.label), 'note', buildVerdictDraft('ok', entry), null, `verdict:${stateKey}`)
      return
    }
    setVerdictDraft((p) => {
      if (p[stateKey]?.verdict === verdict) {
        const { [stateKey]: _drop, ...rest } = p
        return rest
      }
      return { ...p, [stateKey]: { verdict, text: buildVerdictDraft(verdict, entry) } }
    })
  }
  const postVerdictDraft = async (audit: AuditWithBid, entry: DiffEntry) => {
    const stateKey = `${audit.id}:${entry.key}`
    const draft = verdictDraft[stateKey]
    if (!draft) return
    setVerdictPosted((p) => ({ ...p, [stateKey]: draft.verdict }))
    setVerdictDraft((p) => {
      const { [stateKey]: _drop, ...rest } = p
      return rest
    })
    await insertNote(audit, entrySection(entry.label), 'note', draft.text, null, `verdict:${stateKey}`)
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
    const next = audits.find((a) => a.id !== audit.id && a.status === 'pending' && !isSealed(a))
    setExpandedId(next?.id ?? null)
  }
  const reopenAudit = (audit: AuditWithBid) => setAuditStatus(audit, 'reopen')

  const visible = audits.filter((a) => a.status !== 'digested' || showDigested)
  const digestedCount = audits.filter((a) => a.status === 'digested').length

  // Coaching record: what the team's past notes became, and the recent error runs.
  const allNotes = Object.values(notesByAudit).flat()
  const coachingNotes = allNotes.filter((n) => n.kind === 'note' || n.kind === 'answer').length
  const receiptCounts: Partial<Record<AuditDigestOutcome, number>> = {}
  for (const n of allNotes) {
    if (n.kind === 'receipt' && n.digest_outcome) receiptCounts[n.digest_outcome] = (receiptCounts[n.digest_outcome] ?? 0) + 1
  }
  const recentDeltas = audits
    .map((a) => {
      const ref = refByBidId[a.bid_id]
      const draft = draftByAudit[a.id]
      if (!ref?.refValue || !draft || isUnpricedAudit(draft)) return null
      return { num: a.bids?.bid_number, pct: ((draft.total - ref.refValue) / ref.refValue) * 100 }
    })
    .filter((x): x is { num: string | null; pct: number } => !!x)
    .slice(0, 5)

  return (
    <div>
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
      {coachingNotes > 0 || Object.keys(receiptCounts).length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', padding: '0.5rem 0.9rem', marginBottom: '1rem', fontSize: '0.8125rem' }}>
          <span>
            👩‍🏫 <strong>Coaching record:</strong> {coachingNotes} note{coachingNotes === 1 ? '' : 's'}
            {Object.keys(receiptCounts).length > 0 ? (
              <>
                {' '}→{' '}
                {(Object.entries(receiptCounts) as Array<[AuditDigestOutcome, number]>)
                  .map(([outcome, count]) => `${count} ${AUDIT_DIGEST_OUTCOME_LABELS[outcome]}`)
                  .join(' · ')}
              </>
            ) : null}
          </span>
          {recentDeltas.length > 0 ? (
            <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', marginLeft: 'auto' }}>
              <span style={{ color: 'var(--text-muted)' }}>recent runs:</span>
              {recentDeltas.map((d, i) => (
                <span key={i} title={d.num ? `b${d.num}` : undefined} style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: Math.abs(d.pct) <= 8 ? 'var(--text-emerald-800)' : 'var(--text-red-600)' }}>
                  {d.pct > 0 ? '+' : ''}{d.pct.toFixed(1)}%
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading audits…</div>
      ) : audits.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No audits yet — the robot opens one here whenever it finishes a draft bid.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {visible.map((audit) => {
            const threaded = threadAuditNotes(notesByAudit[audit.id] ?? [])
            const openQ = openQuestionCount(threaded)
            const draft = draftByAudit[audit.id]
            // No PT count rows: the robot is still working — never "draft $0 · −100%".
            const unpriced = isUnpricedAudit(draft)
            const chip = unpriced && audit.status === 'pending' ? UNPRICED_CHIP : STATUS_CHIP[audit.status]
            const bidLabel = `b${audit.bids?.bid_number ?? '?'} · ${audit.bids?.project_name ?? 'Unknown project'}`
            const ref = refByBidId[audit.bid_id]
            const deltaPct = ref?.refValue && draft && !unpriced ? ((draft.total - ref.refValue) / ref.refValue) * 100 : null
            const feedbackCount = (notesByAudit[audit.id] ?? []).filter((n) => n.kind === 'note' || n.kind === 'answer').length
            // Sealed shadow: hold the whole audit — reviewing the robot's takeoff
            // before our own bid goes out could anchor the estimator's number.
            if (audit.status === 'pending' && isSealed(audit)) {
              return (
                <div key={audit.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center', border: '1px dashed var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', padding: '0.6rem 0.9rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600 }}>{bidLabel}</span>
                  <span>
                    🔒 opens after we send {ref?.refNumber ? `b${ref.refNumber}` : 'our bid'} — seeing the robot&apos;s takeoff early could anchor our own number
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>{formatAuditRequestedStamp(audit.requested_at)}</span>
                </div>
              )
            }
            const deltaNode = deltaPct != null ? (
              <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: '0.8125rem', color: Math.abs(deltaPct) <= 8 ? 'var(--text-emerald-800)' : 'var(--text-red-600)' }}>
                {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}% vs ours
              </span>
            ) : null
            if (audit.id !== expandedId) {
              return (
                <button
                  key={audit.id}
                  type="button"
                  onClick={() => setExpandedId(audit.id)}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.6rem 0.9rem', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', width: '100%' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{bidLabel}</span>
                  <span style={{ padding: '0.1rem 0.55rem', borderRadius: 999, background: chip.bg, color: chip.fg, fontSize: '0.7rem' }}>{chip.label}</span>
                  {unpriced ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>no counts in PipeTooling yet</span>
                  ) : draft ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>draft ${Math.round(draft.total).toLocaleString()}</span>
                  ) : null}
                  {deltaNode}
                  {audit.status === 'pending' && openQ > 0 ? (
                    <span style={{ color: 'var(--text-amber-800)', fontSize: '0.78rem' }}>{openQ} question{openQ === 1 ? '' : 's'}</span>
                  ) : null}
                  {feedbackCount > 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{feedbackCount} note{feedbackCount === 1 ? '' : 's'}</span> : null}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{formatAuditRequestedStamp(audit.requested_at)}</span>
                </button>
              )
            }
            const robotRows = pricedRowsByBid[audit.bid_id]
            const ourRows = ref?.refSent ? pricedRowsByBid[ref.refId] : undefined
            const diff = robotRows?.length && ourRows?.length ? diffTakeoffs(robotRows, ourRows) : null
            const rollup = robotRows?.length && ourRows?.length ? rollupSystems(robotRows, ourRows) : null
            const cardComposerKey = `${audit.id}:card`
            const cardSection = composerSection[audit.id] ?? 'general'
            return (
              <div key={audit.id} style={{ border: '2px solid #3b82f6', borderRadius: 8, background: 'var(--surface)', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600 }}>{bidLabel}</span>
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
                {audit.self_assessment ? (
                  <div style={{ borderLeft: '3px solid #7c3aed', background: 'var(--bg-subtle)', borderRadius: '0 8px 8px 0', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 700, color: '#7c3aed' }}>🤖 Where I&apos;m least sure:</span> {audit.self_assessment}
                  </div>
                ) : null}

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

                {/* System scoreboard: where the money diverges, before any row. */}
                {rollup && rollup.length > 0 ? (
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

                {/* The diff: judge each difference with one tap. */}
                {diff ? (
                  <div style={{ marginBottom: '1rem' }}>
                    {DIFF_BUCKETS.map(({ bucket, tag, tagBg, tagFg, blurb }) => {
                      const entries = diff[bucket]
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
                            {shown.map((entry) => {
                              const stateKey = `${audit.id}:${entry.key}`
                              const posted = verdictPosted[stateKey]
                              const open = verdictDraft[stateKey]
                              return (
                                <div key={entry.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                                  <span>{entry.label}</span>
                                  {bucket === 'gaps' ? (
                                    <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>robot ×{fmtQty(entry.robotCount)} · ours ×{fmtQty(entry.ourCount)}</span>
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
                                            onClick={() => tapVerdict(audit, entry, verdict)}
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
                                          if (e.key === 'Enter') void postVerdictDraft(audit, entry)
                                        }}
                                        style={{ flex: 1, padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box' }}
                                      />
                                      <button
                                        type="button"
                                        disabled={busy === `verdict:${stateKey}` || !open.text.trim()}
                                        onClick={() => void postVerdictDraft(audit, entry)}
                                        style={{ padding: '0.3rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                      >
                                        Post
                                      </button>
                                    </span>
                                  ) : null}
                                </div>
                              )
                            })}
                            {hidden > 0 ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.1rem 0.65rem' }}>
                                + {hidden} smaller under ${DIFF_IMPACT_FLOOR.toLocaleString()}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                    {diff.matchedOkCount > 0 ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-emerald-800)' }}>
                        ✓ {diff.matchedOkCount} row{diff.matchedOkCount === 1 ? '' : 's'} match within 15% — nothing to judge there
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
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>The robot&apos;s questions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {threaded.questions.map(({ question, answer }) => {
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
                              {n.author?.name ?? 'staff'} · {n.created_at.slice(0, 10)}
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
                      Finish audit
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
          })}
          {digestedCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowDigested((v) => !v)}
              style={{ alignSelf: 'flex-start', padding: '0.35rem 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8125rem' }}
            >
              {showDigested ? 'Hide' : 'Show'} digested audits ({digestedCount})
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
