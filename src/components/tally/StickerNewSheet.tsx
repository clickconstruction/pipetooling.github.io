/**
 * Sticker 0147 is new (punch list #329, PR 3, v2.7298): the sheet a signed-in scan of a blank sticker opens on the
 * phone's On site tab. Two branches. **It is on a box I know**: the development's live boxes, this job's and the
 * site's other jobs', the ones with no sticker first, searched by stencil, place, where line and parts; a row is
 * picked and *Put 0147 on R76* places the sticker through `place_sticker`. **It is a new box**: the box is made in
 * the same call, named by the site's next free name under #351's rule with the sticker's number beside it (the
 * owner's change to call 7, 2026-11-14: never the number as the name), the kind asked as Add a container asks it,
 * the place optional. The database's verdicts are said in words: someone else took the sticker first (who and when,
 * with the box to open), a sticker on a box of a job the person is not on, a lost one, a name the rule refuses. It
 * needs signal: the press is dead and says so without one, never an outbox press, since two phones may hold the same
 * blank sticker and only the database can say who was first. The words and the order are `lib/materials/stickerPlace.ts`.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { boxNameVerdict, movedWordsNote, nextFreeName, whereWithWords, type SiteBox } from '../../lib/materials/boxName'
import { readLastBoxKind, rememberBoxKind } from '../../lib/materials/boxKindMemory'
import { BOX_KIND_CHOICES, BOX_WHERE_MAX, boxKindWords, type BoxKindChoice } from '../../lib/materials/editBox'
import { containerLines, placeName, type Container, type ContainerLine, type Place } from '../../lib/materials/onSite'
import type { OnSiteFindJob } from '../../lib/materials/onSiteFind'
import { onSiteJobWords } from '../../lib/materials/onSiteJobWords'
import { newId } from '../../lib/materials/onSiteStore'
import { fetchSiteMaterials } from '../../lib/materials/siteMaterialsRead'
import {
  defaultBranch,
  GOES_ON_WORDS,
  matchBoxes,
  matchJobOf,
  matchList,
  NO_SIGNAL_WORDS,
  NO_STICKER_MARK,
  newBoxPressLabel,
  noStickerCountWords,
  openBoxLabel,
  placeOutcome,
  placePressLabel,
  READING_SITE_WORDS,
  STICKER_BRANCH_WORDS,
  STICKER_NEW_ASK,
  stickerNewTitle,
  stickerNumbersWords,
  stickersByBoxOf,
  type MatchBox,
  type PlaceOutcome,
  type PlaceRequest,
  type StickerBranch,
} from '../../lib/materials/stickerPlace'
import { fetchStickersOnBoxes, placeSticker } from '../../lib/materials/stickerPlaceIo'
import { placingVerdict, stickerNumberWords, type StickerFacts } from '../../lib/materials/stickers'
import { EmptyState } from '../EmptyState'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Sheet } from './OnSiteSheet'
import type { OnSiteJob } from './TallyOnSiteTab'

const TOUCH_MIN = 48
const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: TOUCH_MIN, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff', width: '100%', minHeight: 52 }
const input: CSSProperties = { width: '100%', minHeight: TOUCH_MIN, padding: '0.6rem 0.9rem', fontSize: '1rem', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }
const on: CSSProperties = { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' }
const dis = (off: boolean): CSSProperties => (off ? { opacity: 0.45, cursor: 'default' } : {})
const MATCH_ROWS_MAX = 40

type Props = {
  sticker: StickerFacts
  /** The job the person is on: where a new box lands, and whose boxes come first. */
  jobId: string
  /** The jobs this person may open. */
  jobs: ReadonlyArray<OnSiteJob>
  /** This job's rows, from the store: fresh and there with no signal. */
  containers: ReadonlyArray<Container>
  lines: ReadonlyArray<ContainerLine>
  places: ReadonlyArray<Place>
  /** The site's other jobs, read when the sheet opens. */
  siteJobIds: ReadonlyArray<string>
  /** The site's boxes for the name rule, live and retired. */
  siteBoxes: ReadonlyArray<SiteBox>
  /** The stickers on this job's boxes, by box. */
  stickersByBox: ReadonlyMap<string, ReadonlyArray<number>>
  onClose: () => void
  /** *Change* under the new box's job: the job picker, the sticker kept in hand. */
  onChangeJob: () => void
  /** The press landed, or a taken sticker's box is to be opened: the tab says it and opens the box. */
  onDone: (outcome: PlaceOutcome) => void
  place?: typeof placeSticker
  readSite?: typeof fetchSiteMaterials
  readStickers?: typeof fetchStickersOnBoxes
  /** The phone has signal; a test hands one. */
  online?: () => boolean
  now?: () => string
}

export default function StickerNewSheet({ sticker, jobId, jobs, containers, lines, places, siteJobIds, siteBoxes, stickersByBox, onClose, onChangeJob, onDone, place = placeSticker, readSite = fetchSiteMaterials, readStickers = fetchStickersOnBoxes, online = () => typeof navigator === 'undefined' || navigator.onLine !== false, now = () => new Date().toISOString() }: Props) {
  const number = stickerNumberWords(sticker.number)
  const job = jobs.find((j) => j.id === jobId) ?? null
  const jobLabel = job ? onSiteJobWords(job) : 'this job'
  const otherIds = useMemo(() => [...new Set(siteJobIds)].filter((id) => id !== jobId), [siteJobIds, jobId])
  /** The site's other jobs with their boxes: 'reading' while the read runs, null when it failed, the jobs once read. */
  const [others, setOthers] = useState<OnSiteFindJob[] | 'reading' | null>(otherIds.length ? 'reading' : [])
  const [otherStickers, setOtherStickers] = useState<Map<string, number[]>>(new Map())
  useEffect(() => {
    if (otherIds.length === 0) { setOthers([]); return }
    let live = true
    setOthers('reading')
    void (async () => {
      try {
        const rows = await readSite(otherIds)
        const read: OnSiteFindJob[] = otherIds.map((id) => {
          const j = jobs.find((x) => x.id === id)
          const containersOf = rows.containers.filter((c) => c.jobId === id)
          return matchJobOf({ jobId: id, label: j ? onSiteJobWords(j) : 'another job on this site', containers: containersOf, lines: containerLines(rows.movements.filter((m) => m.jobId === id)), places: rows.places.filter((p) => p.jobId === id) })
        })
        const stickers = await readStickers(rows.containers.map((c) => c.id)).catch(() => [])
        if (!live) return
        setOtherStickers(stickersByBoxOf(stickers))
        setOthers(read)
      } catch {
        if (live) setOthers(null)
      }
    })()
    return () => { live = false }
  }, [otherIds, jobs, readSite, readStickers])

  const hereJob = useMemo(() => matchJobOf({ jobId, label: jobLabel, containers, lines, places }), [jobId, jobLabel, containers, lines, places])
  const byBox = useMemo(() => {
    const m = new Map<string, ReadonlyArray<number>>(otherStickers)
    for (const [id, nums] of stickersByBox) m.set(id, nums)
    return m
  }, [stickersByBox, otherStickers])
  const boxes: MatchBox[] = useMemo(() => matchBoxes({ hereJobId: jobId, jobs: [hereJob, ...(Array.isArray(others) ? others : [])], stickersByBox: byBox }), [jobId, hereJob, others, byBox])
  const [branch, setBranch] = useState<StickerBranch>(() => defaultBranch(matchBoxes({ hereJobId: jobId, jobs: [hereJob], stickersByBox })))
  const [query, setQuery] = useState('')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const list = useMemo(() => matchList(boxes, query), [boxes, query])
  const picked = pickedId ? boxes.find((b) => b.container.id === pickedId) ?? null : null

  // The new box.
  const [kind, setKind] = useState<BoxKindChoice>(() => readLastBoxKind())
  const [typed, setTyped] = useState<string | null>(null)
  const [where, setWhere] = useState('')
  const [placeId, setPlaceId] = useState<string | null>(places[0]?.id ?? null)
  const verdict = boxNameVerdict(typed ?? '', siteBoxes)
  const shown = typed ?? nextFreeName(siteBoxes) ?? ''
  const whereSaved = verdict.ok ? whereWithWords(where, verdict.words) : where.trim()
  const longWhere = whereSaved.length > BOX_WHERE_MAX
  /** The new box's id, cut once: a second press after a lost answer is the same box, so the database answers *already*. */
  const newBoxIdRef = useRef<string>(newId())

  // Signal, watched: the press comes back alive when the bars do.
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('online', bump)
    window.addEventListener('offline', bump)
    return () => { window.removeEventListener('online', bump); window.removeEventListener('offline', bump) }
  }, [])
  const hasSignal = online()

  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  /** A verdict the sheet keeps on screen: someone else took the sticker, it is out of reach, or it was lost. */
  const [said, setSaid] = useState<PlaceOutcome | null>(null)

  const run = async (request: PlaceRequest, boxLabel: string) => {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      const answer = await place(request)
      const outcome = placeOutcome(answer, { jobIds: jobs.map((j) => j.id), boxLabel, number: sticker.number, now: now() })
      if (outcome.kind === 'placed' || outcome.kind === 'created' || outcome.kind === 'already') {
        if (request.kind === 'new') rememberBoxKind(request.boxKind)
        onDone(outcome)
      } else setSaid(outcome)
    } catch (e) {
      setFailure(formatErrorMessage(e, 'The sticker did not go on the box.'))
    } finally {
      setBusy(false)
    }
  }

  const otherJob = placingVerdict({ sticker, hereJobId: jobId, runJobName: (() => { const j = sticker.runJobId ? jobs.find((x) => x.id === sticker.runJobId) : null; return j ? onSiteJobWords(j) : null })(), now: now() })
  const knownDead = !picked || busy || !hasSignal
  const newDead = !verdict.ok || longWhere || busy || !hasSignal

  if (said) {
    const open = said.containerId && said.jobId && jobs.some((j) => j.id === said.jobId)
    return (
      <Sheet title={stickerNewTitle(sticker.number)} onClose={onClose} footer={open ? <button type="button" style={btnPrimary} onClick={() => onDone(said)} data-testid="sticker-open-box">{openBoxLabel(said.kind === 'taken' ? boxes.find((b) => b.container.id === said.containerId)?.container.label ?? null : null)}</button> : <button type="button" style={{ ...btn, width: '100%' }} onClick={onClose}>Close</button>}>
        <p role="alert" style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.45 }} data-testid="sticker-said" data-kind={said.kind}>{said.words}</p>
      </Sheet>
    )
  }

  return (
    <Sheet title={stickerNewTitle(sticker.number)} sub={STICKER_NEW_ASK} onClose={onClose} footer={
      <>
        {!hasSignal ? <p role="alert" style={{ margin: 0, color: 'var(--text-amber-800)', fontSize: '0.85rem' }} data-testid="sticker-no-signal">{NO_SIGNAL_WORDS}</p> : null}
        {failure ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }} data-testid="sticker-failure">{failure}</p> : null}
        {branch === 'known' ? (
          <button type="button" style={{ ...btnPrimary, ...dis(knownDead) }} disabled={knownDead} onClick={() => { if (picked) void run({ kind: 'known', stickerId: sticker.id, containerId: picked.container.id }, picked.container.label) }} data-testid="sticker-place-known">
            {picked ? placePressLabel(sticker.number, picked.container.label) : `Put ${number} on a box`}
          </button>
        ) : (
          <button type="button" style={{ ...btnPrimary, ...dis(newDead) }} disabled={newDead} onClick={() => { if (verdict.ok) void run({ kind: 'new', stickerId: sticker.id, containerId: newBoxIdRef.current, jobId, label: verdict.name, boxKind: kind, where: whereSaved, placeId }, verdict.name) }} data-testid="sticker-place-new">
            {verdict.ok ? newBoxPressLabel(verdict.name) : newBoxPressLabel(null)}
          </button>
        )}
      </>
    }>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        <span style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }} data-testid="sticker-number">{number}</span>
        {otherJob.kind === 'other_job' ? <span style={{ ...muted, color: 'var(--text-amber-800)', fontWeight: 600 }} data-testid="sticker-other-job">{otherJob.words}</span> : null}
      </div>
      <div role="group" aria-label={STICKER_NEW_ASK} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.35rem' }}>
        {(['known', 'new'] as StickerBranch[]).map((b) => (
          <button key={b} type="button" aria-pressed={branch === b} style={{ ...btn, fontSize: '0.9rem', padding: '0 0.5rem', ...(branch === b ? on : {}) }} onClick={() => setBranch(b)} data-testid={`sticker-branch-${b}`}>{STICKER_BRANCH_WORDS[b]}</button>
        ))}
      </div>

      {branch === 'known' ? (
        <>
          <input type="search" autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setPickedId(null) }} placeholder="Stencil, place or part" aria-label="Which box" style={input} data-testid="sticker-match-search" />
          <div style={{ display: 'grid', gap: '0.35rem' }} data-testid="sticker-match-list">
            {list.slice(0, MATCH_ROWS_MAX).map((b) => {
              const isPicked = b.container.id === pickedId
              const nums = stickerNumbersWords(b.stickerNumbers)
              return (
                <button key={b.container.id} type="button" aria-pressed={isPicked} onClick={() => setPickedId(isPicked ? null : b.container.id)} style={{ ...btn, width: '100%', justifyContent: 'flex-start', gap: '0.6rem', fontWeight: 500, textAlign: 'left', padding: '0.5rem 0.75rem', ...(isPicked ? { borderColor: BLUE, boxShadow: `inset 0 0 0 1px ${BLUE}` } : {}) }} data-testid="sticker-match-row">
                  <span style={{ display: 'grid', minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{b.container.label}</span>
                      {nums ? <span style={muted}>· {nums}</span> : <span style={{ ...muted, color: 'var(--text-amber-800)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{NO_STICKER_MARK}</span>}
                      {!b.here ? <span style={{ ...muted, fontSize: '0.75rem' }}>{b.jobLabel}</span> : null}
                    </span>
                    <span style={muted}>{boxKindWords(b.container.kind).toLowerCase()} · {b.place || placeName([], null)}{b.container.where ? ` · ${b.container.where}` : ''}{b.partNames.length ? ` · ${b.partNames.length === 1 ? '1 part' : `${b.partNames.length} parts`}` : ''}</span>
                  </span>
                </button>
              )
            })}
            {list.length === 0 ? (
              <EmptyState compact main={query.trim() ? 'No box on this site matches that.' : 'No box on this site yet.'} next={{ label: STICKER_BRANCH_WORDS.new, onPress: () => setBranch('new') }} tail="makes one with this sticker on it." />
            ) : null}
          </div>
          {others === 'reading' ? <p style={{ ...muted, margin: 0 }}>{READING_SITE_WORDS}</p> : null}
          {others === null ? <p style={{ ...muted, margin: 0, color: 'var(--text-amber-800)' }} data-testid="sticker-site-unread">The site’s other jobs did not read. This job’s boxes are listed.</p> : null}
          {!query.trim() && noStickerCountWords(boxes) ? <p style={{ ...muted, margin: 0 }} data-testid="sticker-no-sticker-count">{noStickerCountWords(boxes)}</p> : null}
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>Its name<input type="text" value={shown} onChange={(e) => setTyped(e.target.value)} placeholder="R1" aria-label="Its name" autoCapitalize="characters" autoComplete="off" style={{ ...input, fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase' }} data-testid="sticker-new-name" /></label>
            <span style={{ ...btn, cursor: 'default', borderStyle: 'dashed', fontVariantNumeric: 'tabular-nums' }} title="The sticker on it" data-testid="sticker-beside-name">Sticker {number}</span>
          </div>
          <p data-testid="sticker-new-say" role={verdict.ok ? undefined : 'alert'} style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.45, color: !verdict.ok ? 'var(--text-red-700)' : verdict.tone === 'wait' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{verdict.say}{verdict.ok && verdict.words ? ` ${movedWordsNote(verdict.words)}` : ''}</p>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <span style={{ fontWeight: 600 }}>How it sits</span>
            <div role="group" aria-label="How it sits" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
              {BOX_KIND_CHOICES.map((k) => (
                <button key={k} type="button" aria-pressed={k === kind} style={{ ...btn, ...(k === kind ? on : {}) }} onClick={() => setKind(k)}>{boxKindWords(k)}</button>
              ))}
            </div>
          </div>
          {places.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <span style={{ fontWeight: 600 }}>Which place on site</span>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {places.map((p) => (
                  <button key={p.id} type="button" aria-pressed={placeId === p.id} onClick={() => setPlaceId(placeId === p.id ? null : p.id)} style={{ ...btn, minHeight: 36, padding: '0 0.75rem', borderRadius: 999, fontSize: '0.85rem', ...(placeId === p.id ? on : {}) }}>{p.name}</button>
                ))}
              </div>
            </div>
          ) : null}
          <label style={{ display: 'grid', gap: '0.25rem', fontWeight: 600 }}>Where exactly, if it helps<input type="text" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="by the north stair" aria-label="Where exactly" style={input} /></label>
          {longWhere ? <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>The where line holds {BOX_WHERE_MAX} characters. This one is {whereSaved.length}.</p> : null}
          <p style={{ ...muted, margin: 0 }} data-testid="sticker-goes-on">
            {GOES_ON_WORDS} <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{jobLabel}</b>.{' '}
            <button type="button" style={{ background: 'none', border: 'none', padding: 0, minHeight: 36, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={onChangeJob} data-testid="sticker-change-job">Change</button>
          </p>
        </>
      )}
    </Sheet>
  )
}
