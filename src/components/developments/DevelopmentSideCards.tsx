/**
 * The Plans card and the Questions card (punch list #208, design spike). Plans: every set on the
 * site, newest first, who carries it, and the line naming the pieces on an older set or none with
 * **Ask the estimators about the N** (a stub until PR 4 writes the request). Questions: the open
 * ones first with their age, then the answered, each with the record it was asked about.
 */
import { requestIsOpen, type MemberRequest } from '../../lib/developments/overview'
import type { PlanCarrier, PlansView } from '../../lib/developments/plans'
import { ageWords, Chip, LinkButton, shortDay, SmallButton } from './developmentPageBits'

export function DevelopmentPlansCard({
  view,
  openCarrier,
  askAbout,
}: {
  view: PlansView
  openCarrier: (c: PlanCarrier) => void
  askAbout: (count: number) => void
}) {
  const th: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }
  const td: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }
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
      {view.sets.length === 0 && view.none.length === 0 ? <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>No bids or jobs here yet, so no plans.</p> : null}
      {view.sets.length > 0 || view.none.length > 0 ? (
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
            {view.none.length > 0 ? (
              <tr>
                <td style={{ ...td, color: 'var(--text-faint)' }}>No set</td>
                <td style={td}>—</td>
                <td style={td}>—</td>
                <td style={td}>
                  {view.none.length > 12 ? (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {view.none.length} pieces: {carriers(view.none.slice(0, 12))}
                      <span style={{ color: 'var(--text-faint)' }}> … and {view.none.length - 12} more</span>
                    </span>
                  ) : (
                    carriers(view.none)
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
      {view.olderOrNone.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-amber-tint)', border: '1px solid var(--bg-amber-200)', fontSize: '0.84rem' }}>
          <strong style={{ color: 'var(--text-amber-800)' }}>
            {view.olderOrNone.length} older or none
          </strong>
          <span style={{ color: 'var(--text-muted)' }}>
            {view.newest ? `The newest set is ${view.newest.dated ? shortDay(view.newest.dated) : `the one filed ${shortDay(view.newest.filedAt)}`}.` : 'No set is filed on this site.'}{' '}
            {view.olderOrNone.length === 1 ? 'One piece' : `${view.olderOrNone.length} pieces`} {view.newest ? 'carry an older set or none.' : 'carry no set.'}
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <SmallButton onClick={() => askAbout(view.olderOrNone.length)} title="Writes one request to the estimators with the set's date in it (PR 4)">
              Ask the estimators about the {view.olderOrNone.length}
            </SmallButton>
          </span>
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
}: {
  requests: MemberRequest[]
  names: ReadonlyMap<string, string>
  aboutLabel: (r: MemberRequest) => string
  openAbout: (r: MemberRequest) => void
}) {
  if (requests.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Nothing waiting on the estimators or Dispatch. <strong>Ask a question</strong> in the head starts one, and it is kept here with its answer.
      </p>
    )
  }
  const sorted = [...requests].sort((a, b) => {
    const ao = requestIsOpen(a)
    const bo = requestIsOpen(b)
    if (ao !== bo) return ao ? -1 : 1
    return b.created_at.localeCompare(a.created_at)
  })
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {sorted.map((r) => {
        const open = requestIsOpen(r)
        return (
          <div key={r.id} style={{ border: `1px solid ${open ? 'var(--bg-amber-200)' : 'var(--border)'}`, borderLeft: `4px solid ${open ? '#d97706' : '#059669'}`, borderRadius: 6, padding: '8px 10px', background: open ? 'var(--bg-amber-tint)' : 'var(--surface)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>{shortDay(r.created_at)}</span>
              {open ? <strong style={{ color: 'var(--text-amber-800)' }}>waiting · {ageWords(r.created_at)}</strong> : <span>asked</span>}
              <span>
                {names.get(r.from_user_id) ?? 'someone'} → {r.lane === 'dispatch' ? 'Dispatch' : 'the estimators'}
              </span>
              <LinkButton onClick={() => openAbout(r)}>{aboutLabel(r)}</LinkButton>
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
            {r.closed_at && r.closed_note ? (
              <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--border)', fontSize: '0.84rem', color: 'var(--text-muted)' }}>Closed · {r.closed_note}</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
