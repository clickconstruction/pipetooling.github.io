import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsDigitalTwin } from '../../hooks/useIsDigitalTwin'
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
  type AuditSection,
  type BidAuditRow,
  type BidAuditNoteRow,
} from '../../lib/bids/bidAudits'

/**
 * The Audits tab (v2.2517, FEEDBACK_LOOP v2): the human side of the robot feedback
 * loop. Each card is one twin bid awaiting audit — quick links open the CountTooling
 * takeoff (view link) and the ClickTooling bid in NEW tabs, the twin's questions take
 * inline answers, and sectioned note boxes (counts / footage / pricing / scope /
 * general) collect the auditor's feedback right here. Finish audit closes the card;
 * the agent later digests every note, posts a receipt reply underneath, and the card
 * moves to Digested. Only a person can finish an audit (twin-lane RLS).
 */

// bid_audits reaches src/types/database.ts only with the post-push gen-types run
// (BidRfiQueue pattern); until then this untyped view keeps strict mode honest.
const auditDb = supabase as unknown as SupabaseClient

type AuditWithBid = BidAuditRow & {
  bids: { id: string; bid_number: string | null; project_name: string | null; selected_bid_version_id: string | null } | null
}

type DraftSummary = { total: number; rowCount: number }

const STATUS_CHIP: Record<BidAuditRow['status'], { bg: string; fg: string; label: string }> = {
  pending: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', label: 'Awaiting your audit' },
  done: { bg: 'var(--bg-blue-tint, var(--bg-muted))', fg: 'var(--text-blue-700, var(--text-700))', label: 'Waiting on robot digest' },
  digested: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)', label: 'Digested' },
}

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
  const [composer, setComposer] = useState<Record<string, string>>({}) // key: `${auditId}:${section}` or `answer:${questionId}`
  const [busy, setBusy] = useState<string | null>(null)
  const [showDigested, setShowDigested] = useState(false)
  // Cockpit (v2.2548): one card open at a time; the rest collapse to triage rows.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // twin bid_id -> its reference (for the comparison strip; sealed while the ref is unsent).
  const [refByBidId, setRefByBidId] = useState<Record<string, { refNumber: string | null; refValue: number | null; refSent: boolean }>>({})
  // Expanded card's biggest robot rows (lazy) + local 👍 acks / 🚩 flags.
  const [topRowsByBid, setTopRowsByBid] = useState<Record<string, Array<{ id: string; fixture: string; count: number; ext: number }>>>({})
  const [rowJudgments, setRowJudgments] = useState<Record<string, 'ok' | 'flagged'>>({})
  const [composerSection, setComposerSection] = useState<Record<string, AuditSection>>({})

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
      setExpandedId((cur) => cur ?? list.find((a) => a.status === 'pending')?.id ?? null)
      // Comparison strip inputs: each twin bid's reference (twin_source_bid_id pairing).
      // Seal rule: an unsent reference's value is NEVER shown (shadow anchoring).
      void (async () => {
        try {
          const twinIds = list.map((a) => a.bid_id)
          if (!twinIds.length) return
          const twins = ((await auditDb.from('bids').select('id, twin_source_bid_id').in('id', twinIds)).data ?? []) as Array<{ id: string; twin_source_bid_id: string | null }>
          const refIds = [...new Set(twins.map((t) => t.twin_source_bid_id).filter((x): x is string => !!x))]
          const refs = refIds.length
            ? (((await auditDb.from('bids').select('id, bid_number, bid_value, bid_date_sent').in('id', refIds)).data ?? []) as Array<{ id: string; bid_number: string | null; bid_value: number | string | null; bid_date_sent: string | null }>)
            : []
          const refById = new Map(refs.map((r) => [r.id, r]))
          const out: Record<string, { refNumber: string | null; refValue: number | null; refSent: boolean }> = {}
          for (const t of twins) {
            const r = t.twin_source_bid_id ? refById.get(t.twin_source_bid_id) : undefined
            if (!r) continue
            const sent = !!r.bid_date_sent
            out[t.id] = { refNumber: r.bid_number, refValue: sent && r.bid_value != null ? Number(r.bid_value) : null, refSent: sent }
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
        const [rows, assigns] = await Promise.all([
          withSupabaseRetry(
            () => auditDb.from('bids_count_rows').select('id, count, bid_version_id, bid_id').in('bid_id', bidIds),
            'load audit count rows',
          ),
          withSupabaseRetry(
            () =>
              auditDb
                .from('bid_pricing_assignments')
                .select('bid_id, count_row_id, price_book_entry_id, unit_price_override')
                .in('bid_id', bidIds),
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

  // Biggest robot rows for the expanded card — tap to judge (v2.2548).
  useEffect(() => {
    const audit = audits.find((a) => a.id === expandedId)
    if (!audit || topRowsByBid[audit.bid_id]) return
    let cancelled = false
    void (async () => {
      try {
        const rows = ((await auditDb.from('bids_count_rows').select('id, fixture, count, bid_version_id').eq('bid_id', audit.bid_id)).data ?? []) as Array<{ id: string; fixture: string; count: number; bid_version_id: string | null }>
        const assigns = ((await auditDb.from('bid_pricing_assignments').select('count_row_id, price_book_entry_id, unit_price_override').eq('bid_id', audit.bid_id)).data ?? []) as Array<{ count_row_id: string; price_book_entry_id: string | null; unit_price_override: number | null }>
        const entryIds = [...new Set(assigns.map((a) => a.price_book_entry_id).filter((x): x is string => !!x))]
        const entries = entryIds.length ? (((await auditDb.from('price_book_entries').select('id, total_price').in('id', entryIds)).data ?? []) as Array<{ id: string; total_price: number | null }>) : []
        const priceById = new Map(entries.map((e) => [e.id, e.total_price ?? 0]))
        const byRow = new Map(assigns.map((a) => [a.count_row_id, a]))
        const version = audit.bids?.selected_bid_version_id ?? null
        const top = rows
          .filter((r) => (version ? r.bid_version_id === version : r.bid_version_id == null))
          .map((r) => {
            const a = byRow.get(r.id)
            const unit = a ? (a.unit_price_override ?? (a.price_book_entry_id ? (priceById.get(a.price_book_entry_id) ?? 0) : 0)) : 0
            return { id: r.id, fixture: r.fixture, count: Number(r.count), ext: Number(r.count) * Number(unit) }
          })
          .sort((a, b) => b.ext - a.ext)
          .slice(0, 8)
        if (!cancelled) setTopRowsByBid((prev) => ({ ...prev, [audit.bid_id]: top }))
      } catch {
        /* judgment list is optional — the card still works without it */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId, audits])

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
    const next = audits.find((a) => a.id !== audit.id && a.status === 'pending')
    setExpandedId(next?.id ?? null)
  }
  const reopenAudit = (audit: AuditWithBid) => setAuditStatus(audit, 'reopen')

  const visible = audits.filter((a) => a.status !== 'digested' || showDigested)
  const digestedCount = audits.filter((a) => a.status === 'digested').length

  return (
    <div>
      <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        {canWrite ? (
          <>
            Robot bids waiting on a human audit. Open both links, look things over, answer the robot&apos;s questions, and
            leave your notes here — it learns from every one and replies with a receipt.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {visible.map((audit) => {
            const threaded = threadAuditNotes(notesByAudit[audit.id] ?? [])
            const openQ = openQuestionCount(threaded)
            const chip = STATUS_CHIP[audit.status]
            const draft = draftByAudit[audit.id]
            const bidLabel = `b${audit.bids?.bid_number ?? '?'} · ${audit.bids?.project_name ?? 'Unknown project'}`
            const ref = refByBidId[audit.bid_id]
            const deltaPct = ref?.refValue && draft ? ((draft.total - ref.refValue) / ref.refValue) * 100 : null
            const deltaNode = deltaPct != null ? (
              <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: '0.8125rem', color: Math.abs(deltaPct) <= 8 ? 'var(--text-emerald-800)' : 'var(--text-red-600)' }}>
                {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}% vs ours
              </span>
            ) : ref && !ref.refSent ? (
              <span title="The robot's number stays sealed until our bid goes out" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Δ sealed 🔒</span>
            ) : null
            const feedbackCount = (notesByAudit[audit.id] ?? []).filter((n) => n.kind === 'note' || n.kind === 'answer').length
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
                  {draft ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>draft ${Math.round(draft.total).toLocaleString()}</span> : null}
                  {deltaNode}
                  {audit.status === 'pending' && openQ > 0 ? (
                    <span style={{ color: 'var(--text-amber-800)', fontSize: '0.78rem' }}>{openQ} question{openQ === 1 ? '' : 's'}</span>
                  ) : null}
                  {feedbackCount > 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{feedbackCount} note{feedbackCount === 1 ? '' : 's'}</span> : null}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{formatAuditRequestedStamp(audit.requested_at)}</span>
                </button>
              )
            }
            const topRows = topRowsByBid[audit.bid_id]
            const cardComposerKey = `${audit.id}:card`
            const cardSection = composerSection[audit.id] ?? 'general'
            return (
              <div key={audit.id} style={{ border: '2px solid #3b82f6', borderRadius: 8, background: 'var(--surface)', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600 }}>{bidLabel}</span>
                  <span style={{ padding: '0.15rem 0.6rem', borderRadius: 999, background: chip.bg, color: chip.fg, fontSize: '0.75rem' }}>{chip.label}</span>
                  {draft ? (
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

                {/* Comparison strip (v2.2548): the evidence comes to the card. */}
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <span style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.85rem' }}>
                    <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Robot draft</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{draft ? `$${Math.round(draft.total).toLocaleString()}` : '—'}</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{draft ? `${draft.rowCount} rows` : ''}</span>
                  </span>
                  <span style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.85rem' }}>
                    <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Ours{ref?.refNumber ? ` (b${ref.refNumber})` : ''}
                    </span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
                      {ref?.refValue != null ? `$${Math.round(ref.refValue).toLocaleString()}` : ref && !ref.refSent ? 'not sent yet' : '—'}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ref && !ref.refSent ? 'shadow — sealed 🔒' : ''}</span>
                  </span>
                  {deltaPct != null ? (
                    <span style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.85rem' }}>
                      <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Delta</span>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: Math.abs(deltaPct) <= 8 ? 'var(--text-emerald-800)' : 'var(--text-red-600)' }}>
                        {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                      </span>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{deltaPct > 0 ? 'robot over' : 'robot under'}</span>
                    </span>
                  ) : null}
                </div>

                {/* Biggest rows — tap to judge; a flag prefills the composer (v2.2548). */}
                {audit.status === 'pending' && topRows && topRows.length > 0 ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      Biggest rows — tap to judge (a flag drafts the note for you)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {topRows.map((row) => {
                        const judged = rowJudgments[row.id]
                        return (
                          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                            <span>{row.fixture}</span>
                            <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>×{Number.isInteger(row.count) ? row.count : row.count.toFixed(1)}</span>
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>${Math.round(row.ext).toLocaleString()}</span>
                            <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                disabled={!canWrite}
                                onClick={() => {
                                  setRowJudgments((prev) => ({ ...prev, [row.id]: 'flagged' }))
                                  const guess: AuditSection = row.fixture.toLowerCase().startsWith('ft of') ? 'footage' : 'counts'
                                  setComposerSection((prev) => ({ ...prev, [audit.id]: guess }))
                                  setComposer((prev) => ({ ...prev, [cardComposerKey]: `${row.fixture} — robot has ×${row.count} ($${Math.round(row.ext).toLocaleString()}): ` }))
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
