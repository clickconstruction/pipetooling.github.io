import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { relativeTimeFrom } from '../../lib/twinConsoleDisplay'
import { answerFromChoice, orderedChoices } from '../../lib/bids/twinQuestionChoices'
import { TwinQuestionChoiceButtons } from './TwinQuestionChoiceButtons'
import { TwinQuestionText } from './TwinQuestionText'
import { useTwinQuestionBidRefs } from '../../hooks/useTwinQuestionBidRefs'
import { effectiveTwinQuestionAudience, isTwinQuestionAudience, type TwinQuestionAudience } from '../../../supabase/functions/_shared/twinQuestionAudience'
import { BTN, BTN_PRIMARY, CARD, CARD_TITLE, CHIP, MUTED, STEP_REF } from './twinConsoleStyles'

/**
 * The operator lane of the robots' questions (v2.3186), on the Console lens
 * (Bids → 🤖 Robots → Console, v2.3224 — moved from Settings → Digital twins).
 * A robot parks a question here when the MACHINE was in its way: a sandbox, a
 * sign-in, the write fence, a table it can't write, a file the intake account
 * can't read. Judgments about the job are the estimator lane and live on
 * Bids → Audits → Standing rulings; this card only counts them and links there.
 * Answers reach the robot through `get_answers` on its next run; a bid-scoped
 * question can graduate into an RFI draft on that bid (the external lane).
 *
 * Twin tables predate the generated types — untyped client, fail-soft.
 */
export type TwinQuestionRow = {
  id: string
  twin_user_id: string
  about_bid_id: string | null
  mission: string | null
  question: string
  status: 'open' | 'answered' | 'promoted' | 'dismissed'
  answer: string | null
  created_at: string
  /** v2.3186 lane — undefined until migration 20260909045818 lands (then select('*') carries it). */
  audience?: string | null
  /** v2.3210 tap labels + the robot's pick — undefined until migration 20260909233000 lands. */
  choices?: unknown
  recommended?: string | null
}

type TwinName = { id: string; name: string | null; email: string }

const db = supabase as unknown as SupabaseClient
const SHOWN = 12

export function TwinOperatorQuestionsCard() {
  const { showToast } = useToastContext()
  const [questions, setQuestions] = useState<TwinQuestionRow[]>([])
  const [twins, setTwins] = useState<TwinName[]>([])
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
  const [freeText, setFreeText] = useState<Record<string, boolean>>({})
  // Same bid-ref lookup as Standing rulings (v2.3217): numbers in the text link, and a ZZ shell's question links "ours b214" too.
  const questionBidRefs = useTwinQuestionBidRefs(questions)

  const load = useCallback(async () => {
    try {
      const [q, t] = await Promise.all([
        db.from('twin_questions').select('*').order('created_at', { ascending: false }).limit(40),
        db.from('users').select('id, name, email').eq('is_digital_twin', true).order('email'),
      ])
      if (q.error) {
        setAvailable(false)
        return
      }
      setQuestions(((q.data as TwinQuestionRow[] | null) ?? []).filter(Boolean))
      setTwins((t.data as TwinName[] | null) ?? [])
    } catch {
      setAvailable(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function answerQuestion(q: TwinQuestionRow, override?: string) {
    const text = (override ?? answerDrafts[q.id] ?? '').trim()
    if (!text) return
    setBusy(true)
    try {
      const { data: me } = await supabase.auth.getUser()
      const { data: rows, error } = await db
        .from('twin_questions')
        .update({ status: 'answered', answer: text, answered_by: me.user?.id ?? null, answered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', q.id)
        .eq('status', 'open')
        .select('id')
      if (error) throw new Error(error.message)
      if (!rows || rows.length === 0) {
        showToast('Question already handled elsewhere — refreshing.', 'error')
        await load()
        return
      }
      setAnswerDrafts((d) => ({ ...d, [q.id]: '' }))
      setFreeText((d) => ({ ...d, [q.id]: false }))
      showToast('Answer saved — the robot pulls it with get_answers on its next run.', 'success')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** v2.3186: move a question to the other lane — the estimator's panel (Bids → Audits) or this console. */
  async function setAudience(q: TwinQuestionRow, audience: TwinQuestionAudience) {
    setBusy(true)
    try {
      const { data: rows, error } = await db
        .from('twin_questions')
        .update({ audience, updated_at: new Date().toISOString() })
        .eq('id', q.id)
        .eq('status', 'open')
        .select('id')
      if (error) throw new Error(error.message)
      if (!rows || rows.length === 0) {
        await load()
        return
      }
      showToast(audience === 'estimator' ? "Sent to the estimator's Standing rulings panel." : 'Kept on this console — the estimator no longer sees it.', 'success')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function dismiss(q: TwinQuestionRow) {
    setBusy(true)
    try {
      const { error } = await db.from('twin_questions').update({ status: 'dismissed', updated_at: new Date().toISOString() }).eq('id', q.id).eq('status', 'open').select('id')
      if (error) throw new Error(error.message)
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Promote drafts an RFI on the question's bid (source 'manual' — the human owns the wording from here) and links it. */
  async function promote(q: TwinQuestionRow) {
    if (!q.about_bid_id) {
      showToast('This question has no bid — answer it here instead (RFIs live on a bid).', 'error')
      return
    }
    setBusy(true)
    try {
      const { data: me } = await supabase.auth.getUser()
      const { data: rfi, error: e1 } = await db
        .from('bids_rfis')
        .insert({ bid_id: q.about_bid_id, question: q.question, source: 'manual', created_by: me.user?.id ?? null })
        .select('id, rfi_number')
        .single()
      if (e1 || !rfi) throw new Error(e1?.message ?? 'RFI insert failed')
      const { error: e2 } = await db
        .from('twin_questions')
        .update({ status: 'promoted', promoted_rfi_id: rfi.id, updated_at: new Date().toISOString() })
        .eq('id', q.id)
        .eq('status', 'open')
        .select('id')
      if (e2) throw new Error(e2.message)
      showToast(`Promoted to RFI-${rfi.rfi_number} (draft) on the bid's RFI tab.`, 'success')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!available) return null

  const operator = questions.filter((q) => effectiveTwinQuestionAudience(q) === 'operator')
  const openOperator = operator.filter((q) => q.status === 'open').length
  const openEstimator = questions.filter((q) => q.status === 'open' && effectiveTwinQuestionAudience(q) === 'estimator').length
  const shown = [...operator]
    .sort((a, b) => {
      const rank = (q: TwinQuestionRow) => (q.status === 'open' ? 0 : 1)
      return rank(a) - rank(b) || (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)
    })
    .slice(0, SHOWN)
  const twinName = (id: string) => {
    const t = twins.find((x) => x.id === id)
    return t?.name ?? t?.email ?? 'Robot'
  }

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h4 style={{ ...CARD_TITLE, margin: 0 }}>
          <span style={STEP_REF}>Q</span>Operator questions{openOperator > 0 ? ` · ${openOperator} open` : ''}
        </h4>
        <a href="/bids?tab=audits" style={{ ...MUTED, marginLeft: 'auto', color: 'var(--text-link)' }} title="Judgments about the job — the estimator answers those on the Standing rulings panel">
          📐 {openEstimator} estimator question{openEstimator === 1 ? '' : 's'} on Audits → Standing rulings
        </a>
      </div>
      <p style={{ ...MUTED, margin: '0.35rem 0 0' }}>
        The machine was in the robot's way — a sandbox, a sign-in, the write fence, a table it can't write, a file the intake account can't read.
        Answers reach the robot on its next run. <b>Send to estimator</b> moves a question that turns out to be about the job.
      </p>
      {shown.length === 0 ? <p style={{ ...MUTED, marginBottom: 0 }}>Nothing waiting — a blocked robot parks a question here instead of stalling.</p> : null}
      {shown.map((q) => {
        const isOpen = q.status === 'open'
        const laneWritable = 'audience' in q
        return (
          <div key={q.id} style={{ borderTop: '1px solid var(--border)', padding: '0.45rem 0', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <strong>{twinName(q.twin_user_id)}</strong>
              <span
                title={isTwinQuestionAudience(q.audience) ? 'Lane set by the robot or a human' : 'Lane read from the text — the audience column has not landed yet'}
                style={{ ...CHIP, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700, var(--text-700))' }}
              >
                🛠 OPERATOR
              </span>
              {q.mission ? <span style={MUTED}>{q.mission}</span> : null}
              <span style={{ ...CHIP, background: isOpen ? 'var(--bg-amber-tint)' : 'var(--bg-muted)', color: isOpen ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{q.status.toUpperCase()}</span>
              <span style={{ ...MUTED, marginLeft: 'auto' }}>{relativeTimeFrom(q.created_at, Date.now())}</span>
            </div>
            <div style={{ margin: '0.2rem 0', whiteSpace: 'pre-wrap' }}>
              <TwinQuestionText
                text={q.question}
                bidIdByNumber={questionBidRefs.bidIdByNumber}
                aboutBidId={q.about_bid_id}
                aboutBidNumber={q.about_bid_id ? questionBidRefs.bidNumberById[q.about_bid_id] : null}
                sourceByBidId={questionBidRefs.sourceByBidId}
              />
            </div>
            {q.status === 'answered' && q.answer ? <div style={{ ...MUTED, fontStyle: 'italic' }}>→ {q.answer}</div> : null}
            {isOpen ? (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {(() => {
                  const choices = orderedChoices(q)
                  if (choices && !freeText[q.id]) {
                    return (
                      <TwinQuestionChoiceButtons
                        choices={choices}
                        disabled={busy}
                        onPick={(c) => void answerQuestion(q, answerFromChoice(c))}
                        onSomethingElse={() => setFreeText((d) => ({ ...d, [q.id]: true }))}
                      />
                    )
                  }
                  return (
                    <>
                      <input
                        type="text"
                        value={answerDrafts[q.id] ?? ''}
                        onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                        placeholder="Answer the robot…"
                        style={{ flex: 1, minWidth: 180, padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 5, font: 'inherit', fontSize: '0.78rem' }}
                      />
                      <button type="button" style={BTN_PRIMARY} disabled={busy || !(answerDrafts[q.id] ?? '').trim()} onClick={() => void answerQuestion(q)}>
                        Answer
                      </button>
                    </>
                  )
                })()}
                {q.about_bid_id ? (
                  <button type="button" style={BTN} disabled={busy} onClick={() => void promote(q)}>
                    Promote to RFI
                  </button>
                ) : null}
                {laneWritable ? (
                  <button type="button" style={BTN} disabled={busy} title="This is an estimating question after all — put it on the Standing rulings panel" onClick={() => void setAudience(q, 'estimator')}>
                    Send to estimator
                  </button>
                ) : null}
                <button type="button" style={{ ...BTN, color: 'var(--text-muted)' }} disabled={busy} onClick={() => void dismiss(q)}>
                  Dismiss
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
