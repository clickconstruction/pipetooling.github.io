import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { loadPricedTakeoffRows, type PricedTakeoffRow } from '../../lib/bids/loadPricedTakeoffRows'
import { diffTakeoffs, diffWaterfall, buildVerdictDraft, entrySection, type AuditVerdict, type DiffBucketKey } from '../../lib/bids/takeoffDiff'
import { pickEnvelopeRows, type EnvelopeRow, type EnvelopeRun } from '../../lib/bids/robotEnvelope'
import { questionContextLine, threadAuditNotes, type BidAuditNoteRow, type BidAuditRow } from '../../lib/bids/bidAudits'
import { orderedChoices, answerFromChoice } from '../../lib/bids/twinQuestionChoices'
import { TwinQuestionChoiceButtons } from './TwinQuestionChoiceButtons'
import type { TwinQuestionRow } from '../../lib/bids/standingRulings'

// bid_audits / twin_questions predate the generated types (BidsAuditsTab pattern).
const db = supabase as unknown as SupabaseClient

type RobotEnvelopeModalProps = {
  /** The human bid just sent; null = closed. */
  bid: BidWithBuilder | null
  /** The scored (or audited) run — the modal never opens without a robot number. */
  run: EnvelopeRun | null
  authUser: User | null
  onClose: () => void
  /** The rest of the audit lives on the Audits lens. */
  onOpenAudits: (auditId: string | null) => void
}

type Loaded = {
  shell: { id: string; bid_number: string | null; selected_bid_version_id: string | null } | null
  audit: BidAuditRow | null
  notes: BidAuditNoteRow[]
  robotRows: PricedTakeoffRow[]
  ourRows: PricedTakeoffRow[]
  questions: TwinQuestionRow[]
}

const BUCKET_WORD: Record<DiffBucketKey, string> = {
  missed: 'robot missed',
  added: 'robot added',
  gaps: 'different count',
  rates: 'priced differently',
}
const VERDICTS: Array<{ verdict: AuditVerdict; label: string; onBg: string; onFg: string }> = [
  { verdict: 'teach', label: "✗ Robot's wrong", onBg: 'var(--bg-red-100)', onFg: 'var(--text-red-600)' },
  { verdict: 'record', label: '📋 Ours is off', onBg: 'var(--bg-amber-tint)', onFg: 'var(--text-amber-800)' },
  { verdict: 'ok', label: '✓ Both fine', onBg: 'var(--bg-green-tint)', onFg: 'var(--text-green-800)' },
]
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const money = (v: number | null | undefined) => (v == null ? '—' : `$${Math.round(v).toLocaleString()}`)
const signed = (n: number) => `${n < 0 ? '−' : '+'}$${Math.round(Math.abs(n)).toLocaleString()}`

const kpi: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', minWidth: 120 }
const kpiLabel: React.CSSProperties = { display: 'block', fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }

/**
 * The robot's envelope, opened at send (v2.3222). Renders only after the bids
 * row saved with value + sent date — the same instant the trigger scored the
 * run — so nothing shown here can move the score. Top-N differences with the
 * cockpit's one-tap verdicts, the robot's questions with their taps, Finish or
 * Later. Whatever is not judged here still waits on the Audits lens.
 */
export function RobotEnvelopeModal({ bid, run, authUser, onClose, onOpenAudits }: RobotEnvelopeModalProps) {
  const { showToast } = useToastContext()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [posted, setPosted] = useState<Record<string, AuditVerdict>>({})
  const [draft, setDraft] = useState<{ key: string; verdict: AuditVerdict; text: string; row: EnvelopeRow } | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [answered, setAnswered] = useState<ReadonlySet<string>>(() => new Set())
  const [freeText, setFreeText] = useState<Record<string, boolean>>({})

  const bidId = bid?.id ?? null
  useEffect(() => {
    if (!bidId || !bid) return
    let cancelled = false
    setLoaded(null)
    setLoadError(null)
    setPosted({})
    setDraft(null)
    setAnswers({})
    setAnswered(new Set())
    void (async () => {
      try {
        // The shell: stamped pairing first, the run's shadow number second (pre-v2.2543 shadows).
        type ShellRow = { id: string; bid_number: string | null; selected_bid_version_id: string | null; twin_source_bid_id: string | null }
        let shellRes = await db.from('bids').select('id, bid_number, selected_bid_version_id, twin_source_bid_id').eq('twin_source_bid_id', bidId).order('created_at', { ascending: false }).limit(1)
        let shell: ShellRow | null = ((shellRes.data ?? []) as ShellRow[])[0] ?? null
        if (!shell && run?.shellNumber) {
          shellRes = await db.from('bids').select('id, bid_number, selected_bid_version_id, twin_source_bid_id').eq('bid_number', run.shellNumber).limit(1)
          shell = ((shellRes.data ?? []) as ShellRow[])[0] ?? null
        }
        const [auditRes, questionsRes] = await Promise.all([
          shell ? db.from('bid_audits').select('*').eq('bid_id', shell.id).order('requested_at', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
          db.from('twin_questions').select('*').eq('status', 'open').in('about_bid_id', [bidId, ...(shell ? [shell.id] : [])]).order('created_at', { ascending: false }).limit(20),
        ])
        const audit = ((auditRes.data ?? []) as BidAuditRow[])[0] ?? null
        const notes = audit ? (((await db.from('bid_audit_notes').select('*, author:users(name)').eq('audit_id', audit.id).order('created_at')).data ?? []) as BidAuditNoteRow[]) : []
        const [robotRows, ourRows] = await Promise.all([
          shell ? loadPricedTakeoffRows(shell.id, shell.selected_bid_version_id) : Promise.resolve([] as PricedTakeoffRow[]),
          loadPricedTakeoffRows(bidId, bid.selected_bid_version_id ?? null),
        ])
        if (cancelled) return
        const questions = ((questionsRes.data ?? []) as TwinQuestionRow[]).filter((q) => (q.audience ?? 'estimator') !== 'operator')
        setLoaded({ shell: shell ? { id: shell.id, bid_number: shell.bid_number, selected_bid_version_id: shell.selected_bid_version_id } : null, audit, notes, robotRows, ourRows, questions })
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId])

  const diff = useMemo(() => (loaded && loaded.robotRows.length && loaded.ourRows.length ? diffTakeoffs(loaded.robotRows, loaded.ourRows) : null), [loaded])
  const robotTotal = run?.robotTotal ?? null
  const ourValue = run?.ourValue ?? (bid?.bid_value != null ? Number(bid.bid_value) : null)
  const deltaPct = run?.deltaPct ?? (robotTotal != null && ourValue ? ((robotTotal - ourValue) / ourValue) * 100 : null)
  const waterfall = diff && robotTotal != null && ourValue != null ? diffWaterfall(diff, robotTotal, ourValue) : null
  const picked = useMemo(() => (diff ? pickEnvelopeRows(diff) : { rows: [], hidden: 0 }), [diff])
  const threaded = useMemo(() => threadAuditNotes(loaded?.notes ?? []), [loaded])
  const openAuditQuestions = threaded.questions.filter((q) => q.answer == null && !answered.has(q.question.id))
  const openTwinQuestions = (loaded?.questions ?? []).filter((q) => !answered.has(q.id))

  if (!bid || !run) return null
  const audit = loaded?.audit ?? null
  const canVerdict = !!audit && audit.status === 'pending'
  const label = `b${bid.bid_number ?? '?'} · ${bid.project_name ?? 'bid'}`

  const insertNote = async (section: 'counts' | 'footage' | 'pricing' | 'scope' | 'general', kind: 'note' | 'answer', body: string, parentId: string | null) => {
    if (!audit) return false
    const { error } = await db.from('bid_audit_notes').insert({ bid_id: audit.bid_id, audit_id: audit.id, section, kind, body: body.trim(), parent_id: parentId, author_id: authUser?.id ?? null })
    if (error) {
      showToast(error.message, 'error')
      return false
    }
    return true
  }

  const tapVerdict = async (row: EnvelopeRow, verdict: AuditVerdict) => {
    const key = row.entry.key
    if (posted[key] || !canVerdict) return
    if (verdict === 'ok') {
      setBusy(key)
      const ok = await insertNote(entrySection(row.entry.label, row.bucket), 'note', buildVerdictDraft('ok', row.entry, row.bucket), null)
      setBusy(null)
      if (ok) setPosted((p) => ({ ...p, [key]: 'ok' }))
      return
    }
    setDraft((cur) => (cur?.key === key && cur.verdict === verdict ? null : { key, verdict, text: buildVerdictDraft(verdict, row.entry, row.bucket), row }))
  }
  const postDraft = async () => {
    if (!draft) return
    setBusy(draft.key)
    const ok = await insertNote(entrySection(draft.row.entry.label, draft.row.bucket), 'note', draft.text, null)
    setBusy(null)
    if (ok) {
      setPosted((p) => ({ ...p, [draft.key]: draft.verdict }))
      setDraft(null)
    }
  }

  const answerAuditQuestion = async (q: BidAuditNoteRow, text: string) => {
    if (!text.trim()) return
    setBusy(`aq:${q.id}`)
    const ok = await insertNote(q.section, 'answer', text, q.id)
    setBusy(null)
    if (ok) setAnswered((p) => new Set([...p, q.id]))
  }
  const answerTwinQuestion = async (q: TwinQuestionRow, text: string) => {
    if (!text.trim()) return
    setBusy(`tq:${q.id}`)
    const { data: rows, error } = await db
      .from('twin_questions')
      .update({ status: 'answered', answer: text.trim(), answered_by: authUser?.id ?? null, answered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', q.id)
      .eq('status', 'open')
      .select('id')
    setBusy(null)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    if ((rows ?? []).length === 0) showToast('Already answered elsewhere.', 'error')
    else setAnswered((p) => new Set([...p, q.id]))
  }

  // Finish goes through the audit-finish edge fn (v2.2518) so CountTooling flips too;
  // local dev / pre-deploy falls back to the PT-side write, as the Audits lens does.
  const finish = async () => {
    if (!audit) return
    setBusy('finish')
    try {
      let viaFn = false
      try {
        const { data, error } = await supabase.functions.invoke('audit-finish', { body: { audit_id: audit.id, action: 'finish' } })
        if (!error && (data as { ok?: boolean } | null)?.ok) viaFn = true
      } catch {
        /* fall through */
      }
      if (!viaFn) {
        const { error } = await db.from('bid_audits').update({ status: 'done', completed_at: new Date().toISOString(), completed_by: authUser?.id ?? null, updated_at: new Date().toISOString() }).eq('id', audit.id)
        if (error) throw new Error(error.message)
        await db.from('bids_submission_entries').insert({ bid_id: audit.bid_id, notes: `[audit] finished at send by ${authUser?.email ?? 'staff'} — ${Object.keys(posted).length} verdict(s) from the envelope.` })
      }
      showToast('Audit finished — the robot digests your verdicts on its next run.', 'success')
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  const verdictCount = Object.keys(posted).length

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="robot-envelope-title"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: '1rem' }}
    >
      <div role="document" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 10, maxWidth: 680, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
          <span aria-hidden style={{ fontSize: '1.1rem' }}>🔒</span>
          <div style={{ minWidth: 0 }}>
            <h2 id="robot-envelope-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>The robot's envelope · {label}</h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Your number is on record and the score is taken — this cannot change it. Three minutes here teaches the robot more than an hour next week.
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
        </div>

        <div style={{ padding: '0.9rem 1.1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={kpi}>
              <span style={kpiLabel}>{run.kind === 'shadow' ? 'Robot locked' : 'Robot draft'}{run.at ? ` · ${run.at.slice(5, 10).replace('-', '/')}` : ''}</span>
              <b style={mono}>{money(robotTotal)}</b>
            </span>
            <span style={kpi}>
              <span style={kpiLabel}>Ours · just now</span>
              <b style={mono}>{money(ourValue)}</b>
            </span>
            <span style={kpi}>
              <span style={kpiLabel}>Delta</span>
              <b style={{ ...mono, color: deltaPct == null ? 'var(--text-muted)' : Math.abs(deltaPct) <= 8 ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
                {deltaPct == null ? '—' : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`}
              </b>
              {run.practice ? <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-amber-800)' }}>practice teacher — shown, not gated</span> : null}
            </span>
          </div>

          {waterfall ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', fontSize: '0.74rem' }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.62rem' }}>Where the delta lives</span>
              {(['missed', 'added', 'gaps', 'rates', 'other'] as const).filter((k) => Math.abs(waterfall[k]) >= 1).map((k) => (
                <span key={k} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0.1rem 0.55rem', background: 'var(--bg-subtle)' }}>
                  {k === 'gaps' ? 'counts' : k === 'rates' ? 'priced differently' : k === 'other' ? 'everything else' : k}{' '}
                  <span style={{ ...mono, fontWeight: 700, color: waterfall[k] < 0 ? 'var(--text-red-600)' : 'var(--text-amber-800)' }}>{signed(waterfall[k])}</span>
                </span>
              ))}
            </div>
          ) : null}

          {loadError ? (
            <p style={{ color: 'var(--text-red-600)', fontSize: '0.85rem', margin: 0 }}>Couldn't open the envelope: {loadError}</p>
          ) : !loaded ? (
            <p role="status" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Opening the envelope…</p>
          ) : (
            <>
              {!audit ? (
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                  The robot hasn't filed its audit for this bid yet, so there is nothing to judge row by row. Its number is above; the card lands on the Audits lens when it files.
                </p>
              ) : !diff ? (
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                  {loaded.robotRows.length === 0 ? "The robot's takeoff rows aren't in PipeTooling yet — only the sealed number can be compared." : 'Our bid has no priced count rows to diff against — the number comparison above is what there is.'}
                </p>
              ) : (
                <div>
                  <div style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.62rem', marginBottom: '0.3rem' }}>
                    The biggest differences · one tap each
                  </div>
                  {picked.rows.map((row) => {
                    const key = row.entry.key
                    const done = posted[key]
                    const isDraft = draft?.key === key
                    return (
                      <div key={key} style={{ borderTop: '1px dashed var(--border)', padding: '0.45rem 0', display: 'grid', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                          <span style={{ flex: 1, minWidth: 180 }}>
                            <b>{row.entry.label}</b>{' '}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                              {BUCKET_WORD[row.bucket]}
                              {row.bucket === 'gaps' || row.bucket === 'rates' ? ` · robot ×${fmtQty(row.entry.robotCount)} · ours ×${fmtQty(row.entry.ourCount)}` : row.bucket === 'missed' ? ` · ours ×${fmtQty(row.entry.ourCount)}` : ` · ×${fmtQty(row.entry.robotCount)}`}
                            </span>
                          </span>
                          <span style={{ ...mono, fontWeight: 600, color: row.impact < 0 ? 'var(--text-red-600)' : 'var(--text-amber-800)' }}>{signed(row.impact)}</span>
                          <span style={{ display: 'inline-flex', gap: 4 }}>
                            {VERDICTS.map((v) => {
                              const on = done === v.verdict || (isDraft && draft?.verdict === v.verdict)
                              return (
                                <button
                                  key={v.verdict}
                                  type="button"
                                  disabled={!!done || busy === key || !canVerdict}
                                  onClick={() => void tapVerdict(row, v.verdict)}
                                  style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 5, padding: '2px 7px', fontSize: '0.7rem', background: on ? v.onBg : 'var(--surface)', color: on ? v.onFg : 'var(--text-700)', cursor: done ? 'default' : 'pointer', opacity: done && !on ? 0.4 : 1 }}
                                >
                                  {v.label}
                                </button>
                              )
                            })}
                          </span>
                        </div>
                        {isDraft ? (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <input value={draft.text} onChange={(e) => setDraft((d) => (d ? { ...d, text: e.target.value } : d))} style={{ flex: 1, padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8rem' }} />
                            <button type="button" onClick={() => void postDraft()} disabled={busy === key} style={{ padding: '0.35rem 0.7rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}>Post</button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: '0.4rem' }}>
                    {picked.hidden > 0 ? `+ ${picked.hidden} smaller — ` : ''}{diff.matchedOkCount} rows match · everything is on the Audits lens
                  </div>
                </div>
              )}

              {openAuditQuestions.length > 0 || openTwinQuestions.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.62rem' }}>The robot asked</div>
                  {openTwinQuestions.map((q) => {
                    const choices = orderedChoices(q)
                    const key = `tq:${q.id}`
                    return (
                      <div key={q.id} style={{ borderLeft: '3px solid #7c3aed', background: 'var(--bg-subtle)', borderRadius: '0 8px 8px 0', padding: '0.5rem 0.75rem', display: 'grid', gap: '0.4rem', fontSize: '0.82rem' }}>
                        <span>🤖 {q.question}</span>
                        {choices && !freeText[key] ? (
                          <TwinQuestionChoiceButtons
                            choices={choices}
                            disabled={busy === key}
                            onPick={(c) => void answerTwinQuestion(q, answerFromChoice(c))}
                            onSomethingElse={() => setFreeText((p) => ({ ...p, [key]: true }))}
                          />
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <input value={answers[key] ?? ''} onChange={(e) => setAnswers((p) => ({ ...p, [key]: e.target.value }))} placeholder="Your answer — the robot reads it next run" style={{ flex: 1, padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8rem' }} />
                            <button type="button" disabled={busy === key} onClick={() => void answerTwinQuestion(q, answers[key] ?? '')} style={{ padding: '0.35rem 0.7rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}>Answer</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {openAuditQuestions.map(({ question: q }) => {
                    const key = `aq:${q.id}`
                    const ctx = questionContextLine(q)
                    return (
                      <div key={q.id} style={{ borderLeft: '3px solid #7c3aed', background: 'var(--bg-subtle)', borderRadius: '0 8px 8px 0', padding: '0.5rem 0.75rem', display: 'grid', gap: '0.4rem', fontSize: '0.82rem' }}>
                        <span>🤖 {q.body}{ctx ? <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ctx}</span> : null}</span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <input value={answers[key] ?? ''} onChange={(e) => setAnswers((p) => ({ ...p, [key]: e.target.value }))} placeholder="Your answer" style={{ flex: 1, padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8rem' }} />
                          <button type="button" disabled={busy === key || !canVerdict} onClick={() => void answerAuditQuestion(q, answers[key] ?? '')} style={{ padding: '0.35rem 0.7rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}>Answer</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
            {audit ? `${verdictCount} verdict${verdictCount === 1 ? '' : 's'} · ${answered.size} answer${answered.size === 1 ? '' : 's'} — saved as you tap` : ''}
          </span>
          {audit ? (
            <button type="button" onClick={() => onOpenAudits(audit.id)} style={{ padding: '0.45rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', cursor: 'pointer', font: 'inherit', fontSize: '0.82rem', color: 'inherit' }}>
              Full audit
            </button>
          ) : null}
          <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.8rem', border: '1px solid transparent', borderRadius: 4, background: 'transparent', cursor: 'pointer', font: 'inherit', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Later
          </button>
          {canVerdict ? (
            <button type="button" onClick={() => void finish()} disabled={busy === 'finish'} style={{ padding: '0.45rem 0.9rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', font: 'inherit', fontSize: '0.82rem' }}>
              {busy === 'finish' ? 'Finishing…' : 'Finish audit'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
