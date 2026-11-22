/**
 * The Materials desk on a phone (v2.8291): three figures, then a section for each site with a row for each job.
 *
 * It draws `buildDeskPhone`'s model and nothing else: the figures are the job page's own tiles (`FlowTiles`) used as
 * filters, a site's name heads its jobs with **Whole site** beside it, and a row is one press that opens its job. A
 * row that needs something wears an amber rail and says what in the desk's words. A job that did not load is not a
 * press: it says why and offers **Read again**, as its row on the desk does.
 */
import type { CSSProperties } from 'react'
import { DESK_PHONE_WHOLE_SITE, type DeskPhoneFilter, type DeskPhoneModel, type DeskPhoneRow } from '../../lib/materials/deskPhone'
import { FlowTiles, type FlowPill } from './FlowRow'

/** The mark on a row that needs a hand: the amber the tiles' badges wear. */
const RAIL = '#d97706'

const card: CSSProperties = { background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }
const head: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, padding: '0 2px', minWidth: 0 }
const headWords: CSSProperties = { margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-strong)', minWidth: 0, overflowWrap: 'anywhere' }
const quiet: CSSProperties = { fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }
const wholeSite: CSSProperties = { flex: '0 0 auto', minHeight: 44, padding: '0 4px', background: 'none', border: 'none', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }
// A row is square inside its card, which rounds and clips it. Its left edge is the rail: drawn in amber on a row that needs a hand, clear on one that does not, so every row's words start at the same place.
const rowBox: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 60, padding: '10px 12px 10px 10px', background: 'var(--surface)', borderStyle: 'solid', borderColor: 'var(--border)', borderWidth: 0, borderLeftWidth: 4, borderLeftColor: 'transparent', borderRadius: 0, font: 'inherit', color: 'var(--text-strong)', textAlign: 'left', boxSizing: 'border-box', minWidth: 0 }
const numberTag: CSSProperties = { flex: '0 0 auto', alignSelf: 'flex-start', minWidth: 44, marginTop: 1, padding: '2px 4px', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'center', boxSizing: 'border-box' }
const nameWords: CSSProperties = { display: 'block', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }
const factWords: CSSProperties = { display: 'block', marginTop: 2, fontSize: '0.8rem', color: 'var(--text-muted)' }
const needWords: CSSProperties = { display: 'block', marginTop: 2, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-amber-700)' }
const readAgain: CSSProperties = { flex: '0 0 auto', minHeight: 40, padding: '0 0.7rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 8, background: 'var(--surface)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)', cursor: 'pointer', whiteSpace: 'nowrap' }

type Props = {
  model: DeskPhoneModel
  /** A figure's press: narrow the list to what it counts, or bring every job back. */
  onFilter: (filter: DeskPhoneFilter) => void
  onOpenJob: (jobId: string) => void
  onOpenSite: (siteId: string) => void
  /** A job whose read failed: read it again. */
  onReadAgain: (jobId: string) => void
}

export default function MaterialsDeskPhone({ model, onFilter, onOpenJob, onOpenSite, onReadAgain }: Props) {
  // A second press on the figure that is narrowing the list brings every job back.
  const pills: FlowPill[] = model.tiles.map((t) => ({ key: t.key, word: t.word, figure: t.figure, tone: t.tone, on: t.on, off: t.off, title: t.title, onPress: () => onFilter(t.on ? 'all' : t.key) }))

  const body = (r: DeskPhoneRow) => (
    <>
      {r.number ? <span style={numberTag}>{r.number}</span> : null}
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
        <span style={nameWords}>{r.name || '—'}</span>
        {r.facts ? <span style={factWords}>{r.facts}</span> : null}
        {r.needs.map((words) => <span key={words} style={needWords} data-desk-phone-need>{words}</span>)}
        {r.failed ? <span style={needWords} data-desk-phone-need>{r.failed}</span> : null}
      </span>
    </>
  )

  return (
    <div style={{ display: 'grid', gap: '0.75rem', minWidth: 0 }} data-testid="materials-desk-phone">
      <FlowTiles label="The desk in three figures" pills={pills} role="filters" />
      {model.sections.map((s) => (
        <section key={s.key} aria-label={s.heading ?? 'Jobs with boxes'} style={{ display: 'grid', gap: 4, minWidth: 0 }} data-desk-phone-section={s.key}>
          {s.heading ? (
            <div style={head}>
              <h3 style={headWords}>
                {s.heading}
                {s.boxesWords ? <span style={quiet}> · {s.boxesWords}</span> : null}
                {s.notLoadedWords ? <span style={{ ...quiet, fontWeight: 600, color: 'var(--text-amber-700)' }}> · {s.notLoadedWords}</span> : null}
              </h3>
              {s.siteId ? (
                <button type="button" style={wholeSite} onClick={() => onOpenSite(s.siteId!)} title="Everything on this site on one screen, across its jobs" aria-label={`${DESK_PHONE_WHOLE_SITE}: ${s.heading}`} data-site-row={s.siteId}>
                  {DESK_PHONE_WHOLE_SITE} <span aria-hidden>›</span>
                </button>
              ) : null}
            </div>
          ) : null}
          <div style={card}>
            {s.rows.map((r, i) => {
              const line: CSSProperties = { ...(i === 0 ? {} : { borderTopWidth: 1 }), ...(r.marked ? { borderLeftColor: RAIL } : {}) }
              return r.failed ? (
                <div key={r.id} style={{ ...rowBox, ...line }} data-desk-phone-row={r.id} data-job-not-loaded={r.id}>
                  {body(r)}
                  <button type="button" style={readAgain} onClick={() => onReadAgain(r.id)} aria-label={`Read ${r.label} again`}>Read again</button>
                </div>
              ) : (
                <button key={r.id} type="button" style={{ ...rowBox, ...line, cursor: 'pointer' }} onClick={() => onOpenJob(r.id)} aria-label={`Open ${r.label}`} data-desk-phone-row={r.id} data-marked={r.marked ? '' : undefined}>
                  {body(r)}
                  <span aria-hidden style={{ flex: '0 0 auto', fontSize: '1.25rem', lineHeight: 1, color: 'var(--text-muted)' }}>›</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
