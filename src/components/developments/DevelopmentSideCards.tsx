/**
 * The Plans card and the Questions card (punch list #208, design spike). Plans: every set on the
 * site, newest first, who carries it, and the line naming the pieces on an older set or none with
 * **Ask the estimators about the N** (a stub until PR 4 writes the request). Questions: the open
 * ones first with their age, then the answered, each with the record it was asked about. `QuestionRow`
 * is the one row, shared with a record's own log (`RecordQuestions.tsx`, PR 4b).
 */
import { requestIsOpen, type MemberRequest } from '../../lib/developments/overview'
import { sortQuestions } from '../../lib/developments/recordQuestions'
import { plansNeedWords, type PlanCarrier, type PlansView, plansAskLine, type PlansAsk } from '../../lib/developments/plans'
import type { CountCard, CountDoor, CountPress } from '../../lib/developments/countCards'
import { CountCardBody } from './DevelopmentCounts'
import { ageWords, Chip, LinkButton, shortDay, SmallButton } from './developmentPageBits'
import { useState } from 'react'

export function DevelopmentPlansCard({
  view,
  openCarrier,
  askAbout,
  askOnRecord,
  openQuestions,
}: {
  view: PlansView
  openCarrier: (c: PlanCarrier) => void
  /** The Plans question read back (PR 5): while it waits the line stands where the press was; answered, the words read under the chips. */
  askOnRecord?: PlansAsk | null
  openQuestions?: () => void
  askAbout: (count: number) => void
}) {
  const th: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }
  const td: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }
  // The pieces behind each chip (the owner, 2026-10-28: *do all 8*, item 3): a chip for those with no plans, one for those on an older set; a press opens the list.
  const [openChip, setOpenChip] = useState<'none' | 'older' | null>(null)
  const older = view.olderOrNone.filter((c) => !view.none.some((n) => n.kind === c.kind && n.id === c.id))
  const carriers = (list: PlanCarrier[]) => (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {list.map((c) => (
        <LinkButton key={`${c.kind}:${c.id}`} onClick={() => openCarrier(c)}>
          {c.label}
        </LinkButton>
      ))}
    </span>
  )
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {view.sets.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Set</th>
              <th style={th}>Dated</th>
              <th style={th}>Filed</th>
              <th style={th}>On</th>
            </tr>
          </thead>
          <tbody>
            {view.sets.map((s, i) => (
              <tr key={s.key}>
                <td style={td}>
                  <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none', fontWeight: 600 }}>
                    Open the folder
                  </a>
                  {i === 0 ? (
                    <>
                      {' '}
                      <Chip label="newest" color="#3b82f6" soft />
                    </>
                  ) : null}
                </td>
                <td style={td}>{s.dated ? shortDay(s.dated) : <span style={{ color: 'var(--text-faint)' }}>no date filed</span>}</td>
                <td style={td}>
                  {s.filedAt ? shortDay(s.filedAt) : '—'}
                  {s.filedBy ? ` · ${s.filedBy}` : ''}
                </td>
                <td style={td}>{carriers(s.carriers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {/* The pieces without the newest set, as chips that open their lists; the ask beside them. No sentence. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} data-testid="plans-chips" aria-label={plansNeedWords(view) ?? 'every piece on the newest set'}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{view.sets.length ? `${view.sets.length} ${view.sets.length === 1 ? 'set' : 'sets'}` : 'no set filed'}</span>
        {view.none.length > 0 ? (
          <button type="button" className={`developmentChipPress${openChip === 'none' ? ' isOn' : ''}`} aria-expanded={openChip === 'none'} onClick={() => setOpenChip((v) => (v === 'none' ? null : 'none'))} data-testid="plans-chip-none">
            {view.none.length} without plans <span aria-hidden>{openChip === 'none' ? '▾' : '▸'}</span>
          </button>
        ) : null}
        {older.length > 0 ? (
          <button type="button" className={`developmentChipPress${openChip === 'older' ? ' isOn' : ''}`} aria-expanded={openChip === 'older'} onClick={() => setOpenChip((v) => (v === 'older' ? null : 'older'))} data-testid="plans-chip-older">
            {older.length} on an older set <span aria-hidden>{openChip === 'older' ? '▾' : '▸'}</span>
          </button>
        ) : null}
        {view.none.length === 0 && older.length === 0 && view.sets.length > 0 ? <span className="developmentCountChip">every piece on the newest set</span> : null}
        {view.olderOrNone.length > 0 && !(askOnRecord && askOnRecord.open) ? (
          <span style={{ marginLeft: 'auto' }}>
            <SmallButton onClick={() => askAbout(view.olderOrNone.length)} title="Writes one question to the estimators about these jobs and bids; the answer reads back here">
              Ask the estimators about the {view.olderOrNone.length}
            </SmallButton>
          </span>
        ) : null}
        {askOnRecord && askOnRecord.open ? (
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-amber-800)', fontWeight: 600 }} data-testid="plans-ask-waiting">
            {openQuestions ? (
              <LinkButton onClick={openQuestions} title="The question, under Questions">
                {plansAskLine(askOnRecord, shortDay)} ›
              </LinkButton>
            ) : (
              plansAskLine(askOnRecord, shortDay)
            )}
          </span>
        ) : null}
      </div>
      {askOnRecord && !askOnRecord.open ? (
        <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="plans-ask-answered">
          <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{plansAskLine(askOnRecord, shortDay).split(' · ')[0]}</span>
          {' · '}
          {plansAskLine(askOnRecord, shortDay).split(' · ').slice(1).join(' · ')}
          {openQuestions ? (
            <>
              {' '}
              <LinkButton onClick={openQuestions}>Questions ›</LinkButton>
            </>
          ) : null}
        </div>
      ) : null}
      {openChip === 'none' && view.none.length > 0 ? (
        <div style={{ fontSize: '0.8rem' }} data-testid="plans-list-none">
          {carriers(view.none)}
        </div>
      ) : null}
      {openChip === 'older' && older.length > 0 ? (
        <div style={{ fontSize: '0.8rem' }} data-testid="plans-list-older">
          {carriers(older)}
        </div>
      ) : null}
    </div>
  )
}

export function DevelopmentQuestionsCard({
  requests,
  names,
  aboutLabel,
  openAbout,
  waitingCard,
  onRow,
  onPress,
}: {
  requests: MemberRequest[]
  names: ReadonlyMap<string, string>
  aboutLabel: (r: MemberRequest) => string
  openAbout: (r: MemberRequest) => void
  /** With no question on the site: the Waiting card's three kinds and their presses, drawn here as well (the owner, 2026-10-28: *do all 8*, item 2). */
  waitingCard: CountCard
  onRow: (door: CountDoor) => void
  onPress: (action: CountPress) => void
}) {
  if (requests.length === 0) {
    return (
      <div style={{ margin: '0 -12px' }} data-testid="questions-kinds">
        <CountCardBody card={waitingCard} sheet={false} bare onRow={onRow} onFoot={() => undefined} onPress={onPress} onClose={() => undefined} />
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {sortQuestions(requests).map((r) => (
        <QuestionRow key={r.id} request={r} names={names} about={{ label: aboutLabel(r), onOpen: () => openAbout(r) }} />
      ))}
    </div>
  )
}

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
