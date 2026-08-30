import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import {
  AUDIT_SECTION_LABELS,
  AUDIT_DIGEST_OUTCOME_LABELS,
  threadAuditNotes,
  openQuestionCount,
  computeAuditDraftTotal,
  sortAuditsForTab,
  type AuditSection,
  type BidAuditRow,
  type BidAuditNoteRow,
} from '../../lib/bids/bidAudits'

/**
 * The Audits tab (v2.2517, FEEDBACK_LOOP v2): the human side of the robot feedback
 * loop. Each card is one twin bid awaiting audit — quick links open the CountTooling
 * takeoff (view link) and the PipeTooling bid in NEW tabs, the twin's questions take
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

export function BidsAuditsTab({ authUser }: { authUser: User | null }) {
  const { showToast } = useToastContext()
  const [audits, setAudits] = useState<AuditWithBid[]>([])
  const [notesByAudit, setNotesByAudit] = useState<Record<string, BidAuditNoteRow[]>>({})
  const [draftByAudit, setDraftByAudit] = useState<Record<string, DraftSummary>>({})
  const [loading, setLoading] = useState(true)
  const [composer, setComposer] = useState<Record<string, string>>({}) // key: `${auditId}:${section}` or `answer:${questionId}`
  const [busy, setBusy] = useState<string | null>(null)
  const [showDigested, setShowDigested] = useState(false)

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

  const finishAudit = async (audit: AuditWithBid) => {
    setBusy(`finish:${audit.id}`)
    try {
      const { error } = await auditDb
        .from('bid_audits')
        .update({ status: 'done', completed_at: new Date().toISOString(), completed_by: authUser?.id ?? null, updated_at: new Date().toISOString() })
        .eq('id', audit.id)
      if (error) throw new Error(error.message)
      const noteCount = (notesByAudit[audit.id] ?? []).filter((n) => n.kind === 'note' || n.kind === 'answer').length
      await auditDb.from('bids_submission_entries').insert({
        bid_id: audit.bid_id,
        notes: `[audit] finished by ${authUser?.email ?? 'staff'} — ${noteCount} note(s)/answer(s) left for the robot to digest.`,
      })
      showToast('Audit finished — the robot will digest your notes and reply with receipts.', 'success')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  const reopenAudit = async (audit: AuditWithBid) => {
    setBusy(`finish:${audit.id}`)
    try {
      const { error } = await auditDb
        .from('bid_audits')
        .update({ status: 'pending', completed_at: null, completed_by: null, updated_at: new Date().toISOString() })
        .eq('id', audit.id)
      if (error) throw new Error(error.message)
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  const visible = audits.filter((a) => a.status !== 'digested' || showDigested)
  const digestedCount = audits.filter((a) => a.status === 'digested').length

  return (
    <div>
      <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Robot bids waiting on a human audit. Open both links, look things over, answer the robot&apos;s questions, and
        leave your notes here — it learns from every one and replies with a receipt.
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
            return (
              <div key={audit.id} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1rem 1.25rem' }}>
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
                    requested {audit.requested_at.slice(0, 10)}
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
                    Open bid (PipeTooling) ↗
                  </a>
                </div>
                {threaded.questions.length > 0 ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>The robot&apos;s questions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {threaded.questions.map(({ question, answer }) => {
                        const key = `answer:${question.id}`
                        return (
                          <div key={question.id} style={{ padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6 }}>
                            <div style={{ fontSize: '0.875rem' }}>🤖 {question.body}</div>
                            {answer ? (
                              <div style={{ marginTop: '0.4rem', fontSize: '0.875rem', color: 'var(--text-green-800)' }}>✓ {answer.body}</div>
                            ) : audit.status === 'pending' ? (
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
                  {threaded.sections.map(({ section, items }) => {
                    const key = `${audit.id}:${section}`
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
                        {audit.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <textarea
                              value={composer[key] ?? ''}
                              onChange={(e) => setComposer((p) => ({ ...p, [key]: e.target.value }))}
                              placeholder={`Anything off in ${AUDIT_SECTION_LABELS[section].toLowerCase()}? Type it like a text.`}
                              rows={(composer[key] ?? '').includes('\n') ? 3 : 1}
                              style={{ flex: 1, padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
                            />
                            <button
                              type="button"
                              disabled={busy === key || !(composer[key] ?? '').trim()}
                              onClick={() => void insertNote(audit, section, 'note', composer[key] ?? '', null, key)}
                              style={{ padding: '0.4rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', alignSelf: 'flex-start' }}
                            >
                              Add
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  {audit.status === 'pending' ? (
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
