import { useEffect, useState, type ReactNode } from 'react'
import { answeredNotInSet, answeredQuestions, openQuestions, questionInNote, questionState, questionsCloseOn, questionsOpen, type PlanQuestionView } from '../../lib/gc/questions'
import type { GcProjectView } from '../../lib/gc/projectRows'
import type { AnswerRecipient } from '../../lib/gc/tradeEmail'
import { Btn, Chip, input } from './gcUi'
import { Picker } from './GcNewProjectPickers'
import { FIELD_HEIGHT_PX } from './GcNewProjectPickerRows'

/**
 * GC mode, the real build, step 8: questions about the plans on real data, moved from the
 * prototype (branch spike/gc-mode, `GcNewProjectQuestions.tsx`). A company asks by phone or email
 * and the office records it; the office sends it to the architect and records the answer; a new
 * set of plans carries the answers in its note. Since the Portal lane's P3-b, a dev ticks the
 * companies on the trade and one press records the answer and emails it to them (`gc-trade-email`).
 */

export interface QuestionWrites {
  onRecord: (q: { packageId: string | null; askedByName: string; text: string; sheets: string[] }) => void
  onSendToArchitect: (questionId: string) => void
  onMarkSent: (questionId: string) => void
  /** Records the answer, then emails it to the companies ticked (none: it is only recorded). */
  onAnswer: (questionId: string, answer: string, to: string[]) => void
  /** Emails an answer already recorded to companies that have not had it. */
  onSendAnswer?: (questionId: string, to: string[]) => void
}

/** Who hears an answer by email, and whether this person may send it. */
export interface AnswerReach {
  canSend: boolean
  /** The companies on a question's trade (`answerRecipients`). */
  recipients: (packageId: string | null) => AnswerRecipient[]
  companyName: (companyId: string) => string | null
}

interface Props {
  project: GcProjectView
  /** The architect's name, for the words; null when the project has none. */
  architectName: string | null
  today: string
  writes: QuestionWrites
  busy?: string | null
  problem?: string | null
  /** Null while the company record is not loaded for this person: the answer is recorded and carried, and no email goes. */
  answerReach?: AnswerReach | null
  onClose: () => void
}

const shortDate = (ymd: string | null) => {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const daysSince = (from: string, today: string) => Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000)

export function GcQuestionsWindow({ project, architectName, today, writes, busy, problem, answerReach = null, onClose }: Props) {
  const open = openQuestions(project)
  const answered = answeredQuestions(project)
  const waiting = answeredNotInSet(project).length
  const [adding, setAdding] = useState(false)
  const closeOn = questionsCloseOn(project)
  const isOpen = questionsOpen(project, today)
  const architect = architectName ?? 'the architect'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="listbox"]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tradeOf = (q: PlanQuestionView) => project.trades.find((p) => p.id === q.packageId)?.trade ?? null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: questions about the plans`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(900px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · questions about the plans</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              A company asks. We send it to {architect}. The answer rides in the next set of plans.
              {closeOn && (isOpen ? ` Questions close ${shortDate(closeOn)}.` : ` Questions closed ${shortDate(closeOn)}.`)}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto', display: 'grid', gap: '1rem' }}>
          {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{problem}</div>}
          <div>
            {!isOpen ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {project.lostOn ? 'We lost this bid. Nobody is open on it.' : `Questions closed ${shortDate(closeOn)}. They close three days before our bid is due.`}
              </span>
            ) : adding ? (
              <AskForm project={project} onRecord={(q) => writes.onRecord(q)} onDone={() => setAdding(false)} />
            ) : (
              <Btn onClick={() => setAdding(true)}>A question came in by phone or email</Btn>
            )}
          </div>

          <section style={{ display: 'grid', gap: '0.5rem' }}>
            <strong>Waiting on an answer ({open.length})</strong>
            {open.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No question is waiting.</span>}
            {open.map((q) => (
              <OpenQuestion key={q.id} q={q} trade={tradeOf(q)} today={today} architect={architect} writes={writes} busy={busy === q.id} reach={answerReach} ours={project.stage !== 'bidding'} />
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
              <QuestionCard key={q.id} q={q} trade={tradeOf(q)} today={today}>
                <div style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-subtle)' }}>
                  <strong>Answer:</strong> {q.answer}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Answered {shortDate(q.answeredOn)}. {sentWords(q, answerReach)}
                  {q.inSetId ? `It went out in ${project.planSets.find((s) => s.id === q.inSetId)?.label ?? 'a set'}.` : 'Not in a set yet.'} In the set's note it reads: {questionInNote(q, tradeOf(q))}
                </span>
                <SendToTheRest q={q} reach={answerReach} writes={writes} busy={busy === q.id} />
              </QuestionCard>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}

function QuestionCard({ q, trade, today, children }: { q: PlanQuestionView; trade: string | null; today: string; children?: ReactNode }) {
  const st = questionState(q)
  const days = daysSince(q.askedOn, today)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{trade ?? 'The job as a whole'}</strong>
        <span style={{ color: 'var(--text-muted)' }}>
          {q.askedByName || 'A company'} asked {shortDate(q.askedOn)}
          {q.answeredOn === null && days > 0 ? `, ${days} ${days === 1 ? 'day' : 'days'} ago` : ''}
        </span>
        {q.sheets.map((s) => (
          <Chip key={s} tone="grey">
            {s}
          </Chip>
        ))}
        <span style={{ flex: 1 }} />
        <Chip tone={st === 'answered' ? 'green' : st === 'with the architect' ? 'blue' : 'amber'}>{st === 'with the architect' ? `with the architect since ${shortDate(q.sentToArchitectOn)}` : st}</Chip>
      </div>
      <div>{q.text}</div>
      {children}
    </div>
  )
}

/** "Sent to A and B." from the question's `answer_sent_to`, by name when the company record is loaded. */
function sentWords(q: PlanQuestionView, reach: AnswerReach | null): string {
  const sent = q.answerSentTo ?? []
  if (sent.length === 0) return ''
  const names = sent.map((id) => reach?.companyName(id) ?? null)
  if (names.some((n) => n === null)) return `Sent to ${sent.length} ${sent.length === 1 ? 'company' : 'companies'}. `
  const known = names as string[]
  return `${`Sent to ${known.length <= 1 ? known[0] : `${known.slice(0, -1).join(', ')} and ${known[known.length - 1]}`}`.replace(/\.?$/, '.')} `
}

/** An answer some company on the trade has not had: a failed send, or one answered before the emails. */
function SendToTheRest({ q, reach, writes, busy }: { q: PlanQuestionView; reach: AnswerReach | null; writes: QuestionWrites; busy: boolean }) {
  if (!reach?.canSend || !writes.onSendAnswer) return null
  const sent = q.answerSentTo ?? []
  const rest = reach.recipients(q.packageId).filter((r) => !sent.includes(r.companyId))
  if (rest.length === 0) return null
  return (
    <div>
      <Btn disabled={busy} onClick={() => writes.onSendAnswer?.(q.id, rest.map((r) => r.companyId))}>
        {busy ? 'Sending…' : rest.length === 1 ? `Send it to ${rest[0]!.company}` : `Send it to the ${rest.length} companies that have not had it`}
      </Btn>
    </div>
  )
}

function OpenQuestion({ q, trade, today, architect, writes, busy, reach, ours }: { q: PlanQuestionView; trade: string | null; today: string; architect: string; writes: QuestionWrites; busy: boolean; reach: AnswerReach | null; ours: boolean }) {
  const [answer, setAnswer] = useState('')
  const [skipped, setSkipped] = useState<string[]>([])
  const recipients = reach?.canSend ? reach.recipients(q.packageId) : []
  const going = recipients.filter((r) => !skipped.includes(r.companyId))
  const who = !reach?.canSend
    ? 'Emails to the companies go out once the portal opens.'
    : recipients.length === 0
      ? !q.packageId
        ? 'A question about the job as a whole is not emailed.'
        : ours
          ? 'The job is ours, and only the company awarded the trade hears it. None is awarded yet, so no email goes.'
          : 'No company has an open ask on the trade, so no email goes.'
      : 'It goes to the companies ticked.'
  return (
    <QuestionCard q={q} trade={trade} today={today}>
      {!q.sentToArchitectOn && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn disabled={busy} onClick={() => writes.onSendToArchitect(q.id)}>
            {busy ? 'Sending…' : `Email it to ${architect}`}
          </Btn>
          <Btn kind="quiet" disabled={busy} onClick={() => writes.onMarkSent(q.id)}>
            It went to them another way
          </Btn>
        </div>
      )}
      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} placeholder="The architect's answer, as they gave it" aria-label={`The answer to ${q.text}`} style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
      <span style={{ color: 'var(--text-muted)' }}>The answer rides in the next set of plans. {who}</span>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {recipients.map((r) => (
          <label key={r.companyId} style={{ whiteSpace: 'nowrap', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minHeight: 32 }}>
            <input
              type="checkbox"
              checked={!skipped.includes(r.companyId)}
              onChange={(e) => setSkipped((all) => (e.target.checked ? all.filter((x) => x !== r.companyId) : [...all, r.companyId]))}
            />
            {r.company}
            {q.companyId && r.companyId === q.companyId ? ' · asked it' : ''}
          </label>
        ))}
        <span style={{ flex: 1 }} />
        <Btn kind="primary" disabled={answer.trim() === '' || busy} title={answer.trim() === '' ? 'Type the answer first.' : undefined} onClick={() => writes.onAnswer(q.id, answer.trim(), going.map((r) => r.companyId))}>
          {busy ? 'Sending…' : going.length > 0 ? `Send the answer to ${going.length} ${going.length === 1 ? 'company' : 'companies'}` : 'Record the answer'}
        </Btn>
      </div>
    </QuestionCard>
  )
}

/** The office types a question a company asked by phone or email. */
function AskForm({ project, onRecord, onDone }: { project: GcProjectView; onRecord: QuestionWrites['onRecord']; onDone: () => void }) {
  const trades = project.trades.filter((p) => !p.ours)
  const [packageId, setPackageId] = useState(trades[0]?.id ?? '')
  const [who, setWho] = useState('')
  const [sheets, setSheets] = useState('')
  const [text, setText] = useState('')
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }}>
      <strong>A question that came in by phone or email</strong>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
          <Picker value={packageId} onChange={setPackageId} placeholder="The trade" ariaLabel="The trade it is about" searchPlaceholder="Search the trades" options={[{ value: '', label: 'The job as a whole' }, ...trades.map((p) => ({ value: p.id, label: p.trade }))]} />
        </div>
        <input style={{ ...input, flex: '1 1 12rem', height: FIELD_HEIGHT_PX, boxSizing: 'border-box' }} value={who} onChange={(e) => setWho(e.target.value)} placeholder="The company that asked" aria-label="The company that asked" />
        <input style={{ ...input, flex: '1 1 10rem', height: FIELD_HEIGHT_PX, boxSizing: 'border-box' }} value={sheets} onChange={(e) => setSheets(e.target.value)} placeholder="Sheets, like E-101, E-201" aria-label="The sheets it is about" />
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Their question, in their words" aria-label="Their question" style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Btn
          kind="primary"
          disabled={text.trim() === ''}
          onClick={() => {
            onRecord({ packageId: packageId || null, askedByName: who.trim(), text: text.trim(), sheets: sheets.split(/[,\s]+/).filter(Boolean) })
            onDone()
          }}
        >
          Add the question
        </Btn>
        <Btn kind="quiet" onClick={onDone}>Cancel</Btn>
      </div>
    </div>
  )
}
