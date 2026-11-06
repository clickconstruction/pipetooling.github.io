/**
 * The question row shared by the Questions look and a record's own log (`RecordQuestions.tsx`). The Plans card
 * that lived here (punch list #208, by link) is `DevelopmentPartsCard.tsx` since v2.6302 (punch list #239, PR 3),
 * which reads the site by part; the Questions look moved to `DevelopmentQuestionsLook.tsx` (v2.6214).
 */
import { requestIsOpen, type MemberRequest } from '../../lib/developments/overview'
import { STAGE_CHECK_WORDS, isStageCheckRequest } from '../../lib/jobs/stageCheckDispatch'
import { ageWords, LinkButton, shortDay } from './developmentPageBits'

/**
 * One question as the Questions card and a record's own log draw it (PR 4b): the day, the wait while
 * it is open, who asked whom, the piece it is about (a door when the caller gives one), the words,
 * every reply with its author, and the close note. `askedOn` marks a bid's question shown on the job
 * it became.
 */
export function QuestionRow({ request: r, names, about, askedOn }: { request: MemberRequest; names: ReadonlyMap<string, string>; about?: { label: string; onOpen: () => void } | null; askedOn?: string | null }) {
  const open = requestIsOpen(r)
  return (
    <div data-testid={`question-row-${r.id}`} data-open={open ? '1' : undefined} style={{ border: `1px solid ${open ? 'var(--bg-amber-200)' : 'var(--border)'}`, borderLeft: `4px solid ${open ? '#d97706' : '#059669'}`, borderRadius: 6, padding: '8px 10px', background: open ? 'var(--bg-amber-tint)' : 'var(--surface)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span>{shortDay(r.created_at)}</span>
        {open ? <strong style={{ color: 'var(--text-amber-800)' }}>waiting · {ageWords(r.created_at)}</strong> : <span>asked</span>}
        <span>
          {names.get(r.from_user_id) ?? 'someone'} → {r.lane === 'dispatch' ? 'Dispatch' : 'the estimators'}
        </span>
        {isStageCheckRequest(r) ? (
          // A check the crew sent from a stage checklist (#245, PR 3): the inbox row's tag, so the job's log reads the same.
          <span data-testid="question-stage-check-tag" style={{ padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }}>
            {STAGE_CHECK_WORDS.tag}
          </span>
        ) : null}
        {about ? <LinkButton onClick={about.onOpen}>{about.label}</LinkButton> : null}
        {askedOn ? (
          <span style={{ fontStyle: 'italic' }} title="Asked on the bid this job came from" data-testid="question-asked-on">
            asked on {askedOn}
          </span>
        ) : null}
      </div>
      <div style={{ marginTop: 4, fontSize: '0.88rem', color: 'var(--text-strong)' }}>{r.title}</div>
      {r.notes.map((n) => (
        <div key={n.id} style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--bg-green-200)', fontSize: '0.84rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {names.get(n.author_user_id) ?? 'someone'} · {shortDay(n.created_at)}
          </span>
          <div>{n.body}</div>
        </div>
      ))}
      {r.closed_at && r.closed_note ? <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: '0.84rem', color: 'var(--text-muted)' }}>Closed · {r.closed_note}</div> : null}
    </div>
  )
}
