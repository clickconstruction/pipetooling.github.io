import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { relativeTimeFrom } from '../../lib/twinConsoleDisplay'
import { groupStandingRulings, legacyMultiDecisionNote, type TwinQuestionRow } from '../../lib/bids/standingRulings'
import { alreadySplitRows, buildSplitInserts, draftProblems, splitLegacyAsk, splitMissionTag, splitRetirementAnswer, type LegacyDecisionDraft } from '../../lib/bids/legacyAskMemo'
import { TwinQuestionText } from './TwinQuestionText'
import { useTwinQuestionBidRefs } from '../../hooks/useTwinQuestionBidRefs'
import { BTN, BTN_PRIMARY, CARD, CARD_TITLE, CHIP, MUTED, STEP_REF, TWIN_VIOLET } from './twinConsoleStyles'

// twin_questions predates the generated types (BidsAuditsTab pattern) — untyped, fail-soft.
const db = supabase as unknown as SupabaseClient

type TwinName = { id: string; name: string | null; email: string }

const INPUT: React.CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 5, width: '100%', boxSizing: 'border-box', background: 'var(--surface)', color: 'inherit' }
const LABEL: React.CSSProperties = { fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }

/**
 * The owner memo (v2.3232): robot asks written before the one-decision rule
 * (v2.3210) — several decisions in one, no taps — pulled off the estimator's
 * Standing rulings panel and set here for the owner. Each memo carries the
 * robot's full text and an editable split into one-decision drafts (the
 * numbered parts, an "Also confirm" as its own, "either A or B" as two taps).
 * **Post** inserts them as the robot's own open questions — so they land on
 * Standing rulings with buttons — and retires the original with a note saying
 * where the decisions went. **Dismiss** closes it; nothing re-asks on its own.
 */
export function TwinOwnerMemoCard() {
  const { showToast } = useToastContext()
  const [questions, setQuestions] = useState<TwinQuestionRow[]>([])
  const [twins, setTwins] = useState<TwinName[]>([])
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, LegacyDecisionDraft[]>>({})
  const [attempted, setAttempted] = useState<Record<string, boolean>>({})
  const refs = useTwinQuestionBidRefs(questions)

  const load = useCallback(async () => {
    try {
      const [q, t] = await Promise.all([
        db.from('twin_questions').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(200),
        db.from('users').select('id, name, email').eq('is_digital_twin', true).order('email'),
      ])
      if (q.error) {
        setAvailable(false)
        return
      }
      const rows = ((q.data as TwinQuestionRow[] | null) ?? []).filter(Boolean)
      setQuestions(rows)
      setTwins((t.data as TwinName[] | null) ?? [])
      setDrafts((prev) => {
        const next = { ...prev }
        for (const r of rows) if (!next[r.id]) next[r.id] = splitLegacyAsk(r.question).decisions
        return next
      })
    } catch {
      setAvailable(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const legacy = groupStandingRulings(questions, { audience: 'estimator' }).legacyAsks
  if (!available || legacy.length === 0) return null

  const twinName = (id: string) => {
    const t = twins.find((x) => x.id === id)
    return t?.name ?? t?.email ?? 'Robot'
  }
  const setDraft = (qid: string, i: number, patch: Partial<LegacyDecisionDraft>) =>
    setDrafts((p) => ({ ...p, [qid]: (p[qid] ?? []).map((d, j) => (j === i ? { ...d, ...patch } : d)) }))
  const removeDraft = (qid: string, i: number) => setDrafts((p) => ({ ...p, [qid]: (p[qid] ?? []).filter((_, j) => j !== i) }))
  const addDraft = (qid: string) =>
    setDrafts((p) => ({ ...p, [qid]: [...(p[qid] ?? []), { heading: null, question: '', choices: ['Yes', 'No'], recommended: null, topic: '' }] }))

  async function post(q: TwinQuestionRow) {
    const list = drafts[q.id] ?? []
    setAttempted((p) => ({ ...p, [q.id]: true }))
    if (list.length === 0 || list.some((d) => draftProblems(d).length > 0)) {
      showToast('Fix the flagged decisions first — each must be one question with 2–4 short taps.', 'error')
      return
    }
    setBusy(q.id)
    try {
      // Safe to retry (v2.3236): an earlier Post may have written its rows and then lost
      // the session before retiring the original. Find them by the mission stamp and
      // finish the retirement instead of posting twice.
      const prior = await db.from('twin_questions').select('id, mission').ilike('mission', `%${splitMissionTag(q.id)}%`)
      if (prior.error) throw new Error(prior.error.message)
      const existing = alreadySplitRows((prior.data ?? []) as Array<{ id: string; mission: string | null }>, q.id)
      let count = existing.length
      if (count === 0) {
        const rows = buildSplitInserts({ id: q.id, twin_user_id: q.twin_user_id, about_bid_id: q.about_bid_id, mission: q.mission }, list)
        const ins = await db.from('twin_questions').insert(rows).select('id')
        if (ins.error) throw new Error(ins.error.message)
        count = rows.length
      }
      const { data: me } = await supabase.auth.getUser()
      const ret = await db
        .from('twin_questions')
        .update({ status: 'dismissed', answer: splitRetirementAnswer(count), answered_by: me.user?.id ?? null, answered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', q.id)
        .eq('status', 'open')
        .select('id')
      if (ret.error) throw new Error(`Posted, but couldn't retire the original: ${ret.error.message}. Press Post again — it only retires now.`)
      showToast(
        existing.length > 0
          ? `Found ${count} question${count === 1 ? '' : 's'} already posted from this ask — retired the original.`
          : `Posted ${count} one-tap question${count === 1 ? '' : 's'} on Standing rulings and retired the original.`,
        'success',
      )
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function dismiss(q: TwinQuestionRow) {
    setBusy(q.id)
    try {
      const { error } = await db.from('twin_questions').update({ status: 'dismissed', updated_at: new Date().toISOString() }).eq('id', q.id).eq('status', 'open').select('id')
      if (error) throw new Error(error.message)
      showToast('Dismissed. Nothing re-asks on its own — a robot asks again only when a run needs that decision.', 'success')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h4 style={{ ...CARD_TITLE, margin: 0 }}>
          <span style={STEP_REF}>M</span>Owner memo · {legacy.length}
        </h4>
        <span style={MUTED}>asks written before the one-decision rule — split each into taps for the estimator, or dismiss it</span>
      </div>
      {legacy.map((q) => {
        const split = splitLegacyAsk(q.question)
        const list = drafts[q.id] ?? split.decisions
        const isBusy = busy === q.id
        return (
          <div key={q.id} data-testid="owner-memo" style={{ borderTop: '1px solid var(--border)', padding: '0.55rem 0', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <strong>{twinName(q.twin_user_id)}</strong>
              <span style={{ ...CHIP, background: 'var(--bg-violet-100)', color: TWIN_VIOLET }}>PRE-RULE ASK</span>
              {q.mission ? <span style={MUTED}>{q.mission}</span> : null}
              <span style={{ ...MUTED, marginLeft: 'auto' }}>{relativeTimeFrom(q.created_at, Date.now())}</span>
            </div>
            <div style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap', color: 'var(--text-700)' }}>
              <TwinQuestionText text={q.question} bidIdByNumber={refs.bidIdByNumber} aboutBidId={q.about_bid_id} aboutBidNumber={q.about_bid_id ? refs.bidNumberById[q.about_bid_id] : null} sourceByBidId={refs.sourceByBidId} />
            </div>
            <div style={{ ...MUTED, color: 'var(--text-amber-800)', marginBottom: '0.45rem' }}>⚠ {legacyMultiDecisionNote(q)}</div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {list.map((d, i) => {
                const problems = attempted[q.id] ? draftProblems(d) : []
                return (
                  <div key={i} style={{ border: `1px solid ${problems.length ? 'var(--text-amber-800)' : 'var(--border)'}`, borderRadius: 8, padding: '0.5rem 0.65rem', background: 'var(--bg-subtle)', display: 'grid', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ ...CHIP, background: 'var(--bg-violet-100)', color: TWIN_VIOLET }}>{i + 1}</span>
                      <span style={{ fontWeight: 600 }}>{d.heading ?? 'Decision'}</span>
                      <button type="button" onClick={() => removeDraft(q.id, i)} disabled={isBusy} style={{ ...BTN, marginLeft: 'auto', padding: '0.1rem 0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }} aria-label={`Remove decision ${i + 1}`}>
                        remove
                      </button>
                    </div>
                    <label style={{ display: 'grid', gap: '0.15rem' }}>
                      <span style={LABEL}>The question — one decision, under 320 characters</span>
                      <textarea value={d.question} onChange={(e) => setDraft(q.id, i, { question: e.target.value })} rows={2} style={{ ...INPUT, resize: 'vertical' }} aria-label={`Decision ${i + 1} question`} />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 12rem) minmax(0, 10rem)', gap: '0.4rem' }}>
                      <label style={{ display: 'grid', gap: '0.15rem' }}>
                        <span style={LABEL}>Taps · comma-separated, 2–4, short</span>
                        <input
                          value={d.choices.join(', ')}
                          onChange={(e) => setDraft(q.id, i, { choices: e.target.value.split(',').map((c) => c.trim()).filter(Boolean) })}
                          style={INPUT}
                          aria-label={`Decision ${i + 1} taps`}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: '0.15rem' }}>
                        <span style={LABEL}>Robot's pick</span>
                        <select value={d.recommended ?? ''} onChange={(e) => setDraft(q.id, i, { recommended: e.target.value || null })} style={INPUT} aria-label={`Decision ${i + 1} recommended`}>
                          <option value="">none</option>
                          {d.choices.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: '0.15rem' }}>
                        <span style={LABEL}>Topic key</span>
                        <input value={d.topic} onChange={(e) => setDraft(q.id, i, { topic: e.target.value })} style={INPUT} aria-label={`Decision ${i + 1} topic`} />
                      </label>
                    </div>
                    {problems.length ? <div style={{ fontSize: '0.74rem', color: 'var(--text-amber-800)' }}>{problems.join(' · ')}</div> : null}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
              <button type="button" style={BTN_PRIMARY} disabled={isBusy || list.length === 0} onClick={() => void post(q)}>
                {isBusy ? 'Posting…' : `Post ${list.length} as one-tap question${list.length === 1 ? '' : 's'}`}
              </button>
              <button type="button" style={BTN} disabled={isBusy} onClick={() => addDraft(q.id)}>
                + Add a decision
              </button>
              <button type="button" style={{ ...BTN, color: 'var(--text-muted)' }} disabled={isBusy} title="Close it without an answer. Nothing re-asks on its own." onClick={() => void dismiss(q)}>
                Dismiss
              </button>
              <span style={MUTED}>Posting puts them on Bids → Audits → Standing rulings as the robot's own questions and retires this one.</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
