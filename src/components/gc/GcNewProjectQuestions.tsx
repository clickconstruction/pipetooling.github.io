import { useEffect, useState, type Dispatch, type ReactNode } from 'react'
import {
  answeredNotInSet,
  daysUntil,
  openQuestions,
  partnerById,
  planLabel,
  questionRecipients,
  questionState,
  shortDate,
  type GcAction,
  type GcProject,
  type GcState,
  type PlanQuestion,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'

/**
 * GC mode design spike: questions about the plans. A trade asks (in its portal, or by phone and we
 * type it here), we send it to the architect, we record the answer, and the answer goes to every
 * company on the trade while we bid, or only the company on it once the job is ours. An answered
 * question can ride in the next set of plans (A new set of plans came in offers it).
 */

interface Props {
  state: GcState
  project: GcProject
  dispatch: Dispatch<GcAction>
  onClose: () => void
}

export function GcNewProjectQuestions({ state, project, dispatch, onClose }: Props) {
  const open = openQuestions(project)
  const answered = project.questions.filter((q) => q.answer !== null).sort((a, b) => (b.answeredOn ?? '').localeCompare(a.answeredOn ?? ''))
  const waiting = answeredNotInSet(project).length
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: questions about the plans`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(900px, 100%)',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · questions about the plans</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              A trade asks. We send it to {project.architect}. The answer goes to{' '}
              {project.stage === 'pursuing' ? 'every company bidding the trade.' : 'the company on the trade.'}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto', display: 'grid', gap: '1rem' }}>
          <div>
            {adding ? (
              <AskForm state={state} project={project} dispatch={dispatch} onDone={() => setAdding(false)} />
            ) : (
              <Btn onClick={() => setAdding(true)}>A question came in by phone or email</Btn>
            )}
          </div>

          <section style={{ display: 'grid', gap: '0.5rem' }}>
            <strong>Waiting on an answer ({open.length})</strong>
            {open.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No question is waiting.</span>}
            {open.map((q) => (
              <OpenQuestion key={q.id} state={state} project={project} q={q} dispatch={dispatch} />
            ))}
          </section>

          <section style={{ display: 'grid', gap: '0.5rem' }}>
            <strong>Answered ({answered.length})</strong>
            {waiting > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {waiting} {waiting === 1 ? 'answer is' : 'answers are'} not in a set yet. A new set of plans came in offers to carry them.
              </span>
            )}
            {answered.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing is answered yet.</span>}
            {answered.map((q) => (
              <QuestionCard key={q.id} state={state} project={project} q={q}>
                <div style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-subtle)' }}>
                  <strong>Answer:</strong> {q.answer}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Answered {shortDate(q.answeredOn)}.{' '}
                  {q.answerSentTo === undefined
                    ? ''
                    : q.answerSentTo.length > 0
                      ? `Sent to ${q.answerSentTo.map((x) => partnerById(state, x.partnerId)?.company ?? 'a company').join(', ')}. `
                      : 'Sent to nobody. '}
                  {q.inSetRev !== undefined ? `It went out in ${planLabel(project, q.inSetRev)}.` : 'Not in a set yet.'}
                </span>
              </QuestionCard>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}

function QuestionCard({ state, project, q, children }: { state: GcState; project: GcProject; q: PlanQuestion; children?: ReactNode }) {
  const trade = project.packages.find((p) => p.id === q.packageId)?.trade ?? 'A trade'
  const asker = partnerById(state, q.partnerId)?.company ?? 'A company'
  const st = questionState(q)
  // daysUntil(a, b) is a minus b: the days since it was asked.
  const days = -daysUntil(q.askedOn, state.today)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{trade}</strong>
        <span style={{ color: 'var(--text-muted)' }}>
          {asker} asked {shortDate(q.askedOn)}
          {q.answer === null && days > 0 ? `, ${days} ${days === 1 ? 'day' : 'days'} ago` : ''}
        </span>
        {(q.sheets ?? []).map((s) => (
          <Chip key={s} tone="grey">{s}</Chip>
        ))}
        <span style={{ flex: 1 }} />
        <Chip tone={st === 'answered' ? 'green' : st === 'with the architect' ? 'blue' : 'amber'}>
          {st === 'with the architect' ? `with the architect since ${shortDate(q.sentToArchitectOn ?? null)}` : st}
        </Chip>
      </div>
      <div>{q.text}</div>
      {children}
    </div>
  )
}

function OpenQuestion({ state, project, q, dispatch }: { state: GcState; project: GcProject; q: PlanQuestion; dispatch: Dispatch<GcAction> }) {
  const recipients = questionRecipients(state, project, q)
  const [answer, setAnswer] = useState('')
  const [skipped, setSkipped] = useState<string[]>([])
  const going = recipients.filter((r) => !skipped.includes(r.partner.id))
  return (
    <QuestionCard state={state} project={project} q={q}>
      {!q.sentToArchitectOn && (
        <div>
          <Btn onClick={() => dispatch({ type: 'sendQuestionToArchitect', projectId: project.id, questionId: q.id })}>Send to {project.architect}</Btn>
        </div>
      )}
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={2}
        placeholder="The architect's answer, as they gave it"
        aria-label={`The answer to ${q.text}`}
        style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)' }}>It goes to</span>
        {recipients.length === 0 && <span style={{ color: 'var(--text-muted)' }}>nobody: no company is on the trade.</span>}
        {recipients.map((r) => (
          <label key={r.partner.id} style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!skipped.includes(r.partner.id)}
              onChange={(e) => setSkipped((all) => (e.target.checked ? all.filter((x) => x !== r.partner.id) : [...all, r.partner.id]))}
            />{' '}
            {r.partner.company}
            {r.partner.id === q.partnerId ? ' · asked it' : ''}
          </label>
        ))}
        <span style={{ flex: 1 }} />
        <Btn
          kind="primary"
          disabled={answer.trim() === ''}
          title={answer.trim() === '' ? 'Type the answer first.' : undefined}
          onClick={() => dispatch({ type: 'answerQuestion', projectId: project.id, questionId: q.id, answer: answer.trim(), recipients: going.map((r) => r.partner.id) })}
        >
          Send the answer{going.length > 0 ? ` to ${going.length} ${going.length === 1 ? 'company' : 'companies'}` : ''}
        </Btn>
      </div>
    </QuestionCard>
  )
}

/** The office types a question a trade asked by phone or email. */
function AskForm({ state, project, dispatch, onDone }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; onDone: () => void }) {
  const trades = project.packages.filter((p) => !p.selfPerform && p.invites.some((i) => i.status !== 'declined'))
  const [packageId, setPackageId] = useState(trades[0]?.id ?? '')
  const pkg = trades.find((p) => p.id === packageId)
  const companies = (pkg?.invites ?? []).filter((i) => i.status !== 'declined').map((i) => partnerById(state, i.partnerId)).filter((p): p is NonNullable<typeof p> => !!p)
  const [partnerId, setPartnerId] = useState(companies[0]?.id ?? '')
  const [sheets, setSheets] = useState('')
  const [text, setText] = useState('')
  const who = companies.some((c) => c.id === partnerId) ? partnerId : (companies[0]?.id ?? '')
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }}>
      <strong>A question that came in by phone or email</strong>
      {trades.length === 0 ? (
        <span style={{ color: 'var(--text-muted)' }}>No company is on a trade yet, so nobody can ask.</span>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select style={input} value={packageId} onChange={(e) => setPackageId(e.target.value)} aria-label="The trade it is about">
              {trades.map((p) => (
                <option key={p.id} value={p.id}>{p.trade}</option>
              ))}
            </select>
            <select style={input} value={who} onChange={(e) => setPartnerId(e.target.value)} aria-label="The company that asked">
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.company}</option>
              ))}
            </select>
            <input style={{ ...input, flex: '1 1 10rem' }} value={sheets} onChange={(e) => setSheets(e.target.value)} placeholder="Sheets, like E-301" aria-label="The sheets it is about" />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Their question, in their words"
            aria-label="Their question"
            style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Btn
              kind="primary"
              disabled={text.trim() === '' || !who}
              onClick={() => {
                dispatch({ type: 'tradeAskQuestion', projectId: project.id, packageId, partnerId: who, text: text.trim(), sheets: sheets.split(/[,\s]+/).filter(Boolean) })
                onDone()
              }}
            >
              Add the question
            </Btn>
            <Btn kind="quiet" onClick={onDone}>Cancel</Btn>
          </div>
        </>
      )}
    </div>
  )
}
