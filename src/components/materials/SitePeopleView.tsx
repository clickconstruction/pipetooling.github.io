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
import { fetchSiteAnswers, giveAnswer, withdrawAnswer, type SiteAnswers, type SiteAnswersReader } from '../../lib/materials/pressAnswersIo'
import { isAnswerable } from '../../lib/materials/pressAnswers'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { fetchLiveWatches, fetchWatchedOpens, type PersonWatch, type WatchedOpen } from '../../lib/people/personWatchIo'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import PressAnswerWindow, { AnswerWithdrawWindow, type AnswerOutcome } from './PressAnswerWindow'
import { ACT_KINDS, LOOK_WORDS, actDays, actPeople, actStampWords, actTiles, countWords, filterActs, openedNotPressed, sitePersonActs, withWatch, type ActKind, type PutBack } from '../../lib/materials/sitePersonActs'

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
  /** The viewer answers presses: a dev. Everyone else reads the answers the office may read and gives none. */
  canAnswer?: boolean
  /** The read of the answers and the rows taken back, and the two writes; a test hands in its own. */
  readAnswers?: SiteAnswersReader
  give?: typeof giveAnswer
  withdraw?: typeof withdrawAnswer
  /** A take-back or its withdrawal changed these jobs' ledgers: the desk reads them again. */
  onLedgerChanged?: (jobIds: string[]) => void
  /** Writes a box change back, through the store the desk reads. Absent where the screen has none. */
  putBack?: (back: PutBack) => void
  /** The live watches and a watch's opened boxes: a dev's reads, nothing for anyone else. A test hands in its own. */
  readWatches?: () => Promise<PersonWatch[]>
  readOpens?: (watchId: string) => Promise<WatchedOpen[]>
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
const chipAmberSolid: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--text-amber-800)', whiteSpace: 'nowrap' }
const struck: CSSProperties = { textDecoration: 'line-through', color: 'var(--text-muted)' }
const chipGrey: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', marginRight: 4, borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, borderWidth: 1, borderStyle: 'solid', whiteSpace: 'nowrap', background: 'var(--bg-subtle)', color: 'var(--text-muted)', borderColor: 'var(--border)' }
const chipRed: CSSProperties = { ...chipGrey, background: 'var(--surface)', color: 'var(--text-red-700)', borderColor: 'var(--text-red-700)' }
const linkPress: CSSProperties = { marginLeft: 6, padding: 0, border: 'none', background: 'none', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', marginRight: 4, borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, borderWidth: 1, borderStyle: 'solid', whiteSpace: 'nowrap', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)' }

function dayWords(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}
function timeWords(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function SitePeopleView({ siteId, jobs, movements, containerMoves, containers, places, boxHref, loading, readTrail = fetchSiteTrail, canAnswer = false, readAnswers = fetchSiteAnswers, give = giveAnswer, withdraw = withdrawAnswer, onLedgerChanged, putBack, readWatches = fetchLiveWatches, readOpens = fetchWatchedOpens }: Props) {
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

  /** The answers to presses and the rows taken back. The office reads them; anyone else gets none. */
  const [answers, setAnswers] = useState<SiteAnswers | null>(null)
  const [answersError, setAnswersError] = useState<string | null>(null)
  const [answersAttempt, setAnswersAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setAnswersError(null)
    readAnswers(jobKey ? jobKey.split(',') : [])
      .then((a) => {
        if (live) setAnswers(a)
      })
      .catch((e: unknown) => {
        if (live) setAnswersError(formatErrorMessage(e, 'The answers to presses did not load.'))
      })
    return () => {
      live = false
    }
  }, [jobKey, readAnswers, answersAttempt])
  /** The presses a dev picked to answer, the window that answers them, and the answer being withdrawn. */
  const [pickedIds, setPickedIds] = useState<ReadonlySet<string>>(new Set())
  const [answering, setAnswering] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  const { showToast } = useToastContext()
  const addTask = useChecklistAddModal()
  const confirmDialog = useConfirmDialog()
  /** Put one box change back: asked first, written through the store, and the trail read again once it has landed. */
  const runPutBack = async (back: PutBack, who: string) => {
    if (!putBack) return
    if (!(await confirmDialog({ title: `${back.words}?`, message: `${who} changed this box. The box goes back to how it read before, and both changes stay in this list.`, confirmLabel: back.words }))) return
    try {
      putBack(back)
      showToast(`${back.words}: done.`, 'success')
      window.setTimeout(() => setAttempt((n) => n + 1), 1500)
    } catch (e) {
      showToast(formatErrorMessage(e, 'The box was not changed back.'), 'error')
    }
  }

  /** The live watches: a dev's read. Anyone else gets none, and the look draws as it does for everyone. */
  const [watches, setWatches] = useState<PersonWatch[]>([])
  const [watchError, setWatchError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    Promise.resolve()
      .then(() => readWatches())
      .then((w) => {
        if (live) setWatches(w)
      })
      .catch((e: unknown) => {
        if (live) setWatchError(formatErrorMessage(e, 'The watches did not load.'))
      })
    return () => {
      live = false
    }
  }, [readWatches])

  const acts = useMemo(
    () =>
      withWatch(
        sitePersonActs({ jobs, movements, containerMoves, containers, places, boxChanges: trail?.boxChanges, boxRenames: trail?.boxRenames, removedAnswers: trail?.removedAnswers, answers: answers?.answers, takenBack: answers?.takenBack }),
        new Set(watches.map((w) => w.userId)),
      ),
    [jobs, movements, containerMoves, containers, places, trail, answers, watches],
  )
  const people = useMemo(() => actPeople(acts), [acts])
  const picked = people.find((p) => p.key === person) ?? null
  const pickedWatch = picked ? watches.find((w) => picked.userIds.includes(w.userId)) ?? null : null
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
  /** The boxes the watched person opened on a screen since the watch began and never pressed on. */
  const [opens, setOpens] = useState<WatchedOpen[]>([])
  const watchId = pickedWatch?.id ?? null
  useEffect(() => {
    let live = true
    setOpens([])
    if (!watchId) return
    Promise.resolve()
      .then(() => readOpens(watchId))
      .then((o) => {
        if (live) setOpens(o)
      })
      .catch(() => {
        /* the strip is left out; the presses still draw */
      })
    return () => {
      live = false
    }
  }, [watchId, readOpens])
  const quietBoxes = pickedWatch && picked ? openedNotPressed(opens, acts.filter((a) => a.personKey === picked.key), pickedWatch.setAt) : []
  const canPick = (a: (typeof acts)[number]) => canAnswer && isAnswerable(a.kind) && !a.answer
  const pickedActs = acts.filter((a) => pickedIds.has(a.id) && canPick(a))
  const togglePick = (id: string) =>
    setPickedIds((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const withdrawing = withdrawingId ? acts.find((a) => a.id === withdrawingId) ?? null : null
  const boxLabel = (id: string) => containers.find((c) => c.id === id)?.label ?? 'a box no longer listed'
  const askCount = addTask
    ? (a: (typeof acts)[number]) => addTask.openAddModal({ preset: { title: `Count ${a.boxId ? boxLabel(a.boxId) : 'the box'} again: ${a.part ?? ''}`.trim(), links: [] } })
    : undefined
  const afterAnswers = (o: AnswerOutcome) => {
    setAnswering(false)
    const counted = o.countAsked ? 1 : 0
    const kept = new Set<string>([...o.failed.map((f) => f.act.id)])
    // What was answered leaves the pick. A press that failed, or a count still to ask for, stays picked.
    setPickedIds((cur) => new Set([...cur].filter((id) => kept.has(id) || (o.countsLeft > 0 && pickedActs.some((a) => a.id === id && a.kind === 'counted' && a.id !== o.countAsked?.id)))))
    const said: string[] = []
    if (o.tookBack > 0) said.push(`Took back ${o.tookBack.toLocaleString('en-US')}.`)
    if (o.marked > 0) said.push(`Marked ${o.marked.toLocaleString('en-US')}.`)
    if (counted > 0) said.push('The count is in the New task window.')
    if (o.countsLeft > 0) said.push(`${countWords(o.countsLeft, 'count is', 'counts are')} still to ask for.`)
    if (o.failed.length > 0) said.push(`${countWords(o.failed.length, 'press was', 'presses were')} not answered: ${o.failed[0]?.reason ?? ''}`)
    if (said.length > 0) showToast(said.join(' '), o.failed.length > 0 ? 'error' : 'success')
    if (o.tookBack + o.marked > 0) setAnswersAttempt((n) => n + 1)
    if (o.jobIds.length > 0) onLedgerChanged?.(o.jobIds)
  }

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
        <button type="button" aria-pressed={lookOnly} style={{ ...btn, ...(lookOnly ? btnOn : {}) }} onClick={() => setLookOnly((v) => !v)} title={pickedWatch ? 'What a watched person does that is the office’s to do, and a take or a use with no note.' : 'A count that changed a number, a part added by hand to a line that already had a number, and a take or a use with no note.'}>
          {pickedWatch ? 'Outside the process only' : 'Worth a look only'}
        </button>
        {pickedWatch ? <span style={chipAmberSolid} title={pickedWatch.why || undefined} data-testid="site-people-watched">Watched since {new Date(pickedWatch.setAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> : null}
        {picked ? <span style={muted} data-testid="site-people-last">{picked.name} · last press {actStampWords(picked.lastAt)}</span> : null}
      </div>

      {trailError ? (
        <div role="status" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.75rem', fontSize: '0.8rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderBottom: '1px solid var(--border)' }} data-testid="site-people-trail-error">
          <span>Box changes and answers taken off are not in this list. {trailError}</span>
          <button type="button" style={btn} onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      ) : null}

      {answersError ? (
        <div role="status" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.75rem', fontSize: '0.8rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderBottom: '1px solid var(--border)' }} data-testid="site-people-answers-error">
          <span>Answers to presses are not in this list. {answersError}</span>
          <button type="button" style={btn} onClick={() => setAnswersAttempt((n) => n + 1)}>Try again</button>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, background: 'var(--border)', borderBottom: '1px solid var(--border)' }} data-testid="site-people-tiles">
        <div style={tile}><span style={tileBig}>{tiles.presses.toLocaleString('en-US')}</span><span style={muted}>{tiles.presses === 1 ? 'press' : 'presses'} over {countWords(tiles.days, 'day', 'days')}</span></div>
        <div style={tile}><span style={tileBig}>{tiles.pieces.toLocaleString('en-US')}</span><span style={muted}>{tiles.pieces === 1 ? 'piece' : 'pieces'} taken or used{tiles.markedPieces > 0 ? ` · ${tiles.markedPieces.toLocaleString('en-US')} marked not allowed` : ''}</span></div>
        <div style={tile}><span style={tileBig}>{tiles.boxes.toLocaleString('en-US')}</span><span style={muted}>{tiles.boxes === 1 ? 'box' : 'boxes'} pressed on</span></div>
        <div style={tile}><span style={{ ...tileBig, ...(tiles.look > 0 ? { color: 'var(--text-amber-800)' } : {}) }}>{tiles.look.toLocaleString('en-US')}</span><span style={muted}>{pickedWatch ? 'outside the process' : 'worth a look'}</span></div>
      </div>

      {watchError && canAnswer ? (
        <div role="status" style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderBottom: '1px solid var(--border)' }}>A watch is not marked in this list. {watchError}</div>
      ) : null}
      {quietBoxes.length > 0 && picked ? (
        <div style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderBottom: '1px solid var(--border)' }} data-testid="site-people-quiet-boxes">
          <strong>{picked.name} opened {countWords(quietBoxes.length, 'box', 'boxes')} and pressed nothing:</strong>{' '}
          {quietBoxes.map((id, i) => {
            const c = containers.find((b) => b.id === id)
            return <span key={id}>{i > 0 ? ', ' : ''}{c ? <Link to={boxHref(c.jobId, c.id)} style={{ color: 'inherit', fontWeight: 700 }}>{c.label}</Link> : 'a box no longer listed'}</span>
          })}
          . A count is the only way to know what left them.
        </div>
      ) : null}
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
                {canAnswer ? <th style={th}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Pick</span></th> : null}
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
                  <td colSpan={(picked ? 6 : 7) + (canAnswer ? 1 : 0)} style={{ ...td, background: 'var(--bg-subtle)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {d.acts[0] ? dayWords(d.acts[0].at) : d.day} · {countWords(d.acts.length, 'press', 'presses')}
                  </td>
                </tr>,
                ...d.acts.map((a) => (
                  <tr key={a.id} data-look={a.looks.length > 0 ? 'yes' : undefined} data-answer={a.answer?.answer}>
                    {canAnswer ? <td style={td}>{canPick(a) ? <input type="checkbox" aria-label={`Pick ${a.what} ${a.part ?? ''}`.trim()} checked={pickedIds.has(a.id)} onChange={() => togglePick(a.id)} /> : null}</td> : null}
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{timeWords(a.at)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', ...(a.answer?.answer === 'taken_back' ? struck : {}) }}>{a.what}</td>
                    <td style={{ ...td, ...(a.answer?.answer === 'taken_back' ? struck : {}) }}>{a.part ?? ''}</td>
                    <td style={{ ...td, ...num, ...(a.answer?.answer === 'taken_back' ? struck : {}) }}>{a.qty}</td>
                    <td style={td}>
                      {a.boxId ? <Link to={boxHref(a.jobId, a.boxId)} style={{ color: 'var(--text-link)', textDecoration: 'none', fontWeight: 600 }}>{a.where}</Link> : a.where}
                      {manyJobs && a.jobLabel ? <span style={{ ...muted, display: 'block', fontSize: '0.72rem' }}>{a.jobLabel}</span> : null}
                    </td>
                    {picked ? null : <td style={{ ...td, whiteSpace: 'nowrap' }}>{a.who}</td>}
                    <td style={td}>
                      {a.outside ? <span style={chipRed}>{a.outside}</span> : a.looks.map((l) => <span key={l} style={chip} title={LOOK_WORDS[l].why}>{LOOK_WORDS[l].chip}</span>)}
                      {a.note}
                      {canAnswer && putBack && a.putBack ? <button type="button" style={linkPress} onClick={() => void runPutBack(a.putBack as PutBack, a.who)}>Put it back…</button> : null}
                      {a.answer ? (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={a.answer.answer === 'marked' ? chipRed : chipGrey}>{a.answer.answer === 'marked' ? 'marked not allowed' : 'taken back'} by {a.answer.byName || 'a dev'}</span>
                          {a.answer.why}
                          {canAnswer ? <button type="button" style={linkPress} onClick={() => setWithdrawingId(a.id)}>{a.answer.answer === 'marked' ? 'Take the mark off…' : 'Let it stand…'}</button> : null}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}
      {canAnswer && pickedActs.length > 0 ? (
        <div style={{ padding: '0.5rem 0.75rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)' }} data-testid="site-people-answer-bar">
          <button type="button" style={{ ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }} onClick={() => setAnswering(true)}>Answer {countWords(pickedActs.length, 'press', 'presses')}…</button>
          <button type="button" style={btn} onClick={() => setPickedIds(new Set())}>Clear the pick</button>
          <span style={muted}>Every press stays in the list, whatever the answer.</span>
        </div>
      ) : null}
      {answering && pickedActs.length > 0 ? (
        <PressAnswerWindow acts={pickedActs} movementsOf={(jobId) => movements.filter((m) => m.jobId === jobId)} boxLabel={boxLabel} give={give} askCount={askCount} onClose={() => setAnswering(false)} onDone={afterAnswers} />
      ) : null}
      {withdrawing?.answer ? (
        <AnswerWithdrawWindow
          act={withdrawing}
          withdraw={withdraw}
          onClose={() => setWithdrawingId(null)}
          onDone={(jobId) => {
            setWithdrawingId(null)
            showToast(jobId ? 'The press stands again.' : 'The mark is off.', 'success')
            setAnswersAttempt((n) => n + 1)
            if (jobId) onLedgerChanged?.([jobId])
          }}
        />
      ) : null}
      {shown.length > drawn.length ? (
        <div style={{ padding: '0.5rem 0.75rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={btn} onClick={() => setAll(true)}>Show all {shown.length.toLocaleString('en-US')} presses</button>
          <span style={muted}>The newest {PEOPLE_FIRST_ROWS.toLocaleString('en-US')} are shown.</span>
        </div>
      ) : null}
    </div>
  )
}
