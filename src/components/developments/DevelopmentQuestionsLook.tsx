/**
 * The Questions look (v2.6214; the owner, 2026-10-30: *these could just be buttons, and if there are
 * outstanding questions then they should show up in tables below*). Two presses at the top, one per
 * lane, always there. Under them one table per lane that has questions: the open ones first, oldest
 * first, with how long each has waited, what it is about, the words and the answer so far; the
 * answered ones folded under a count. A phone draws the same rows as cards. With no question at all,
 * the good-state words. The words and the order come from `lib/developments/questionsLook.ts`.
 */
import { useState } from 'react'
import { EmptyState } from '../EmptyState'
import { requestIsOpen, type MemberRequest } from '../../lib/developments/overview'
import { answeredFoldLabel, NO_QUESTIONS_WORDS, QUESTION_LANES, questionAnswer, questionTableMeta, questionTables, type QuestionLane, type QuestionTable } from '../../lib/developments/questionsLook'
import { ageWords, FoldButton, LinkButton, shortDay, SmallButton } from './developmentPageBits'
import { QuestionRow } from './DevelopmentSideCards'

export function DevelopmentQuestionsLook({
  requests,
  names,
  aboutLabel,
  openAbout,
  onAsk,
  phone,
}: {
  requests: MemberRequest[]
  names: ReadonlyMap<string, string>
  aboutLabel: (r: MemberRequest) => string
  openAbout: (r: MemberRequest) => void
  onAsk: (lane: QuestionLane) => void
  phone: boolean
}) {
  const tables = questionTables(requests)
  return (
    <div style={{ display: 'grid', gap: 12 }} data-testid="questions-look">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} data-testid="questions-asks">
        {QUESTION_LANES.map((l) => (
          <SmallButton key={l.lane} onClick={() => onAsk(l.lane)} title={l.hint}>
            {l.ask}
          </SmallButton>
        ))}
      </div>
      {tables.length === 0 ? <EmptyState main={NO_QUESTIONS_WORDS} /> : tables.map((t) => <LaneTable key={t.lane} table={t} names={names} aboutLabel={aboutLabel} openAbout={openAbout} phone={phone} />)}
    </div>
  )
}

function LaneTable({ table: t, names, aboutLabel, openAbout, phone }: { table: QuestionTable; names: ReadonlyMap<string, string>; aboutLabel: (r: MemberRequest) => string; openAbout: (r: MemberRequest) => void; phone: boolean }) {
  const [answeredOpen, setAnsweredOpen] = useState(t.open.length === 0)
  const rows = answeredOpen ? [...t.open, ...t.answered] : t.open
  const th: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }
  return (
    <div data-testid={`questions-table-${t.lane}`}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
        <strong style={{ fontSize: '0.9rem', color: 'var(--text-strong)' }}>{t.label}</strong>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid={`questions-meta-${t.lane}`}>
          {questionTableMeta(t)}
        </span>
      </div>
      {phone ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r) => (
            <QuestionRow key={r.id} request={r} names={names} about={{ label: aboutLabel(r), onOpen: () => openAbout(r) }} />
          ))}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Asked</th>
              <th style={th}>Waiting</th>
              <th style={th}>About</th>
              <th style={{ ...th, width: '34%' }}>Question</th>
              <th style={{ ...th, width: '30%' }}>Answer</th>
              <th style={th}>Asked by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const open = requestIsOpen(r)
              const a = questionAnswer(r)
              return (
                <tr key={r.id} data-testid={`question-line-${r.id}`} data-open={open ? '1' : undefined}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{shortDay(r.created_at)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{open ? <strong style={{ color: 'var(--text-amber-800)' }}>{ageWords(r.created_at)}</strong> : <span style={{ color: 'var(--text-green-700)' }}>answered{r.closed_at ? ` ${shortDay(r.closed_at)}` : ''}</span>}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <LinkButton onClick={() => openAbout(r)}>{aboutLabel(r)}</LinkButton>
                  </td>
                  <td style={td}>{r.title}</td>
                  <td style={{ ...td, color: a ? 'inherit' : 'var(--text-faint)' }}>
                    {a ? (
                      <>
                        {a.body}
                        {a.by ? <span style={{ color: 'var(--text-muted)' }}> · {names.get(a.by) ?? 'someone'}</span> : null}
                      </>
                    ) : (
                      'nothing yet'
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{names.get(r.from_user_id) ?? 'someone'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {t.answered.length > 0 && t.open.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          <FoldButton open={answeredOpen} label={answeredFoldLabel(t.answered.length, answeredOpen)} onClick={() => setAnsweredOpen((v) => !v)} testId={`questions-fold-${t.lane}`} />
        </div>
      ) : null}
    </div>
  )
}
