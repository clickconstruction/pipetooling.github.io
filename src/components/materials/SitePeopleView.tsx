/**
 * The **By person** look of a site's materials screen: every press and every box move across the
 * site's jobs, read by who made it, newest first and a day at a time. The office picks a person,
 * narrows to one kind of press or to the presses worth a look (a count that changed a number the
 * app already had, a part added by hand to a line that already had a number, a take or a use with no note), and opens a
 * box from its row. Read only: the rows
 * are the on-site store's, already read by the desk, and the words are `sitePersonActs.ts`'s.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import type { Container, ContainerMove, Movement, Place } from '../../lib/materials/onSite'
import { fetchSiteTrail, type SiteTrail, type SiteTrailReader } from '../../lib/materials/sitePeopleTrailIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ACT_KINDS, LOOK_WORDS, actDays, actPeople, actTiles, countWords, filterActs, sitePersonActs, type ActKind } from '../../lib/materials/sitePersonActs'

type Props = {
  /** The site, a development: the scope its part ties and prices stand on. */
  siteId: string
  jobs: ReadonlyArray<{ id: string; label: string }>
  movements: ReadonlyArray<Movement>
  containerMoves: ReadonlyArray<ContainerMove>
  containers: ReadonlyArray<Container>
  places: ReadonlyArray<Place>
  /** Where a box opens: the job's page for the office. */
  boxHref: (jobId: string, containerId: string) => string
  /** The desk is still reading the boxes. */
  loading?: boolean
  /** The read of the changes that are not ledger rows; a test hands in its own. */
  readTrail?: SiteTrailReader
}

/** How many acts the list draws before it asks: a long site stays quick to open. */
export const PEOPLE_FIRST_ROWS = 200

const sec: CSSProperties = { background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, overflow: 'hidden', minWidth: 0 }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const pick: CSSProperties = { minHeight: 32, maxWidth: '100%', borderRadius: 6, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.85rem' }
const btn: CSSProperties = { minHeight: 32, padding: '0 0.75rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }
const btnOn: CSSProperties = { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' }
const tile: CSSProperties = { background: 'var(--surface)', padding: '0.5rem 0.75rem', minWidth: 0, display: 'grid', gap: 1 }
const tileBig: CSSProperties = { fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }
const th: CSSProperties = { textAlign: 'left', padding: '0.4rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.35rem 0.6rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', color: 'var(--text-strong)' }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', marginRight: 4, borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, borderWidth: 1, borderStyle: 'solid', whiteSpace: 'nowrap', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)' }

function dayWords(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}
function timeWords(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
function stampWords(iso: string): string {
  return `${new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeWords(iso)}`
}

export default function SitePeopleView({ siteId, jobs, movements, containerMoves, containers, places, boxHref, loading, readTrail = fetchSiteTrail }: Props) {
  const [person, setPerson] = useState('')
  const [kind, setKind] = useState<ActKind | ''>('')
  const [lookOnly, setLookOnly] = useState(false)
  const [all, setAll] = useState(false)

  /** The changes that are not ledger rows: a box retired, brought back, edited or renamed, an answer taken off. */
  const [trail, setTrail] = useState<SiteTrail | null>(null)
  const [trailError, setTrailError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const jobKey = jobs.map((j) => j.id).join(',')
  const boxKey = containers.map((c) => c.id).join(',')
  useEffect(() => {
    let live = true
    setTrailError(null)
    readTrail({ siteId, jobIds: jobKey ? jobKey.split(',') : [], containerIds: boxKey ? boxKey.split(',') : [] })
      .then((t) => {
        if (live) setTrail(t)
      })
      .catch((e: unknown) => {
        if (live) setTrailError(formatErrorMessage(e, 'The box changes did not load.'))
      })
    return () => {
      live = false
    }
  }, [siteId, jobKey, boxKey, readTrail, attempt])

  const acts = useMemo(
    () => sitePersonActs({ jobs, movements, containerMoves, containers, places, boxChanges: trail?.boxChanges, boxRenames: trail?.boxRenames, removedAnswers: trail?.removedAnswers }),
    [jobs, movements, containerMoves, containers, places, trail],
  )
  const people = useMemo(() => actPeople(acts), [acts])
  const picked = people.find((p) => p.key === person) ?? null
  const shown = filterActs(acts, { person: picked ? picked.key : null, kind: kind || null, lookOnly })
  const tiles = actTiles(shown)
  const drawn = all ? shown : shown.slice(0, PEOPLE_FIRST_ROWS)
  const days = actDays(drawn)
  const narrowed = Boolean(picked || kind || lookOnly)
  const clear = () => {
    setPerson('')
    setKind('')
    setLookOnly(false)
  }
  const manyJobs = jobs.length > 1

  return (
    <div style={sec} data-testid="site-people">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
        <select aria-label="Person" value={picked ? picked.key : ''} onChange={(e) => setPerson(e.target.value)} style={pick}>
          <option value="">Everyone</option>
          {people.map((p) => <option key={p.key} value={p.key}>{p.name} · {p.acts.toLocaleString('en-US')}</option>)}
        </select>
        <select aria-label="Kind of press" value={kind} onChange={(e) => setKind(e.target.value as ActKind | '')} style={pick}>
          <option value="">Every press</option>
          {ACT_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.words}</option>)}
        </select>
        <button type="button" aria-pressed={lookOnly} style={{ ...btn, ...(lookOnly ? btnOn : {}) }} onClick={() => setLookOnly((v) => !v)} title="A count that changed a number, a part added by hand to a line that already had a number, and a take or a use with no note.">
          Worth a look only
        </button>
        {picked ? <span style={muted} data-testid="site-people-last">{picked.name} · last press {stampWords(picked.lastAt)}</span> : null}
      </div>

      {trailError ? (
        <div role="status" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.75rem', fontSize: '0.8rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderBottom: '1px solid var(--border)' }} data-testid="site-people-trail-error">
          <span>Box changes and answers taken off are not in this list. {trailError}</span>
          <button type="button" style={btn} onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, background: 'var(--border)', borderBottom: '1px solid var(--border)' }} data-testid="site-people-tiles">
        <div style={tile}><span style={tileBig}>{tiles.presses.toLocaleString('en-US')}</span><span style={muted}>{tiles.presses === 1 ? 'press' : 'presses'} over {countWords(tiles.days, 'day', 'days')}</span></div>
        <div style={tile}><span style={tileBig}>{tiles.pieces.toLocaleString('en-US')}</span><span style={muted}>{tiles.pieces === 1 ? 'piece' : 'pieces'} taken or used</span></div>
        <div style={tile}><span style={tileBig}>{tiles.boxes.toLocaleString('en-US')}</span><span style={muted}>{tiles.boxes === 1 ? 'box' : 'boxes'} pressed on</span></div>
        <div style={tile}><span style={{ ...tileBig, ...(tiles.look > 0 ? { color: 'var(--text-amber-800)' } : {}) }}>{tiles.look.toLocaleString('en-US')}</span><span style={muted}>worth a look</span></div>
      </div>

      {shown.length === 0 ? (
        loading
          ? <EmptyState compact main="Reading the boxes…" />
          : narrowed
            ? <EmptyState compact main="Nothing on this site matches." next={{ label: 'Show every press', onPress: clear }} />
            : <EmptyState compact main="No press is on record on this site yet." tail="A press on the phone’s On site tab lands here." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>When</th>
                <th style={th}>What</th>
                <th style={th}>Part</th>
                <th style={{ ...th, ...num }}>Qty</th>
                <th style={th}>Where</th>
                {picked ? null : <th style={th}>Who</th>}
                <th style={th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => [
                <tr key={`day-${d.day}`}>
                  <td colSpan={picked ? 6 : 7} style={{ ...td, background: 'var(--bg-subtle)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {d.acts[0] ? dayWords(d.acts[0].at) : d.day} · {countWords(d.acts.length, 'press', 'presses')}
                  </td>
                </tr>,
                ...d.acts.map((a) => (
                  <tr key={a.id} data-look={a.looks.length > 0 ? 'yes' : undefined}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{timeWords(a.at)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{a.what}</td>
                    <td style={td}>{a.part ?? ''}</td>
                    <td style={{ ...td, ...num }}>{a.qty}</td>
                    <td style={td}>
                      {a.boxId ? <Link to={boxHref(a.jobId, a.boxId)} style={{ color: 'var(--text-link)', textDecoration: 'none', fontWeight: 600 }}>{a.where}</Link> : a.where}
                      {manyJobs && a.jobLabel ? <span style={{ ...muted, display: 'block', fontSize: '0.72rem' }}>{a.jobLabel}</span> : null}
                    </td>
                    {picked ? null : <td style={{ ...td, whiteSpace: 'nowrap' }}>{a.who}</td>}
                    <td style={td}>
                      {a.looks.map((l) => <span key={l} style={chip} title={LOOK_WORDS[l].why}>{LOOK_WORDS[l].chip}</span>)}
                      {a.note}
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}
      {shown.length > drawn.length ? (
        <div style={{ padding: '0.5rem 0.75rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={btn} onClick={() => setAll(true)}>Show all {shown.length.toLocaleString('en-US')} presses</button>
          <span style={muted}>The newest {PEOPLE_FIRST_ROWS.toLocaleString('en-US')} are shown.</span>
        </div>
      ) : null}
    </div>
  )
}
