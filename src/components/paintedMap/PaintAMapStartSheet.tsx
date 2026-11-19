/**
 * Paint a map: the start sheet (punch list #345). A name, what the map is for, and the press that
 * opens the map to draw on. Nothing is saved here: the map is made when its first line is.
 *
 * Every map is on a job (punch list #392, step 4). *For* leads the sheet and names the job. Opened
 * with no job, the sheet reads the person's jobs once. When a job is next on their schedule inside
 * a week, or they were at a job in the last two weeks, the sheet opens on it with no question and
 * says so under *For* (`pickerGuess`, the owner's words of 2026-11-19). When they have neither, or
 * a job is on today's schedule, it asks **Which job is it
 * for?** first (`PaintAMapJobPicker`), and the sheet itself is drawn once a job is pressed. A job
 * the app or the painter picked can be changed with **Change the job**, which opens the same
 * picker on the lists already read. A sheet opened under a job's own address keeps that job.
 *
 * On a phone it is a sheet on the bottom edge, and at a desk a window hung from near the top.
 *
 * One way onto no job is left, for a person with no signal: when the picker's lists cannot be read
 * it offers to paint now and pick the job later.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { PAINTED_MAP_NAME_MAX, PAINTED_MAP_UNNAMED, PAINTED_MAP_WORDS_MAX, cleanPaintedText } from '../../lib/paintedMap/paintedMap'
import { WALK_ASK_WORDS, WALK_BEFORE_WORDS } from '../../lib/paintedMap/paintedWalkWords'
import type { PaintedMapHome } from '../../lib/paintedMap/paintedMapDoor'
import { PICKER_WORDS, pickerGuess, pickerGuessWords, pickerHome, pickerSections, type PickerJob } from '../../lib/paintedMap/paintedMapJobPicker'
import { loadPickerLists, type PickerLists } from '../../lib/paintedMap/paintedMapJobPickerIo'
import { PAINTED_MAP_SHEET_Z } from '../../lib/windowLayers'
import { PaintAMapJobPicker } from './PaintAMapJobPicker'
import { paintedSheetFrame, usePaintedSheetDesk } from './paintedSheetFrame'
import { PAINT_SWATCH } from './paintedMapLook'
import type { PaintedMapToStart } from './PaintedMapWindow'

type Props = {
  home: PaintedMapHome
  onStart: (start: PaintedMapToStart) => void
  onClose: () => void
  /** For a smoke: the read of the person's jobs, made once when the sheet is opened with no job. */
  loadLists?: (userId: string) => Promise<PickerLists>
}

/** What a map is usually for: one press names it. */
const NAME_CHIPS = ['The way in', 'Where to park', 'What is where'] as const

const chip: CSSProperties = { minHeight: 36, padding: '0 0.8rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }
const chipOn: CSSProperties = { ...chip, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const field: CSSProperties = { minHeight: 44, padding: '0.5rem 0.6rem', fontSize: '1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box', width: '100%' }
const label: CSSProperties = { display: 'grid', gap: '0.3rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }
const forBox: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-subtle)', borderRadius: 10, padding: '0.5rem 0.7rem' }

const quietPress: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', minHeight: 40, textAlign: 'left' }
const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export function PaintAMapStartSheet({ home: given, onStart, onClose, loadLists = loadPickerLists }: Props) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const desk = usePaintedSheetDesk()
  // Opened with no job (the Dashboard's press with nothing known, the header's search, the Documents tab): the app guesses the next job or the last, or asks.
  const homeless = !given.jobId && !given.developmentId
  const [picked, setPicked] = useState<PickerJob | null>(null)
  /** The person's jobs, read once for the guess and handed to the picker so it reads nothing more. */
  const [lists, setLists] = useState<PickerLists | null>(null)
  /** Whether the read for the guess is still out. A sheet opened on a job reads nothing. */
  const [guessing, setGuessing] = useState(homeless && !!userId)
  /** Under *For* while the job is the app's guess: how the app knows. Gone once the painter picks. */
  const [guessWords, setGuessWords] = useState<string | null>(null)
  /** The lists could not be read and the painter chose to paint now: the one map that starts on no job. */
  const [later, setLater] = useState(false)
  const [picking, setPicking] = useState(false)
  const home: PaintedMapHome = picked ? pickerHome(picked) : given
  // The app's pick or the painter's own can be changed. A job the sheet was opened on from its own address cannot.
  const changeable = !!picked || (!!given.jobId && !!given.canChangeJob)
  const [name, setName] = useState('')
  const [words, setWords] = useState('')
  // A job in a development: the map is for the job unless the painter says it is for the whole site.
  const [forSite, setForSite] = useState(!given.jobId && !!given.developmentId)
  const isTopmost = useModalStackEntry()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost()) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isTopmost, onClose])

  // One read, when the sheet is opened with no job. A read that fails falls to the picker, which reads again and draws its own retry.
  useEffect(() => {
    if (!homeless || !userId) return
    let live = true
    void loadLists(userId)
      .then((got) => {
        if (!live) return
        setLists(got)
        const guess = pickerGuess(pickerSections({ todayStops: got.todayStops, soon: got.soon, last: got.last, todayYmd: got.todayYmd, paintable: got.paintable }))
        if (guess) {
          setPicked((had) => had ?? guess.job)
          setGuessWords(pickerGuessWords(guess, got.todayYmd))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (live) setGuessing(false)
      })
    return () => {
      live = false
    }
  }, [homeless, userId, loadLists])

  const frame = paintedSheetFrame(desk)

  const pick = (job: PickerJob) => {
    setPicked(job)
    setGuessWords(null)
    setLater(false)
    setForSite(false)
    setPicking(false)
  }

  // No job yet: the question comes first, and the sheet is not drawn behind it. Cancel closes everything.
  if (homeless && !picked && !later) {
    if (!userId) return null
    if (guessing) {
      // The read for the guess is out. The same head as the sheet, so nothing jumps when it lands.
      return createPortal(
        <div
          data-paint-a-map-reading
          style={{ ...frame.scrim, zIndex: PAINTED_MAP_SHEET_Z }}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="Paint a map" onClick={(e) => e.stopPropagation()} style={frame.sheet}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Paint a map</h2>
              <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem' }}>
                Cancel
              </button>
            </div>
            <p role="status" style={{ margin: 0, padding: '0.85rem 1rem calc(1.2rem + env(safe-area-inset-bottom, 0px))', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {PICKER_WORDS.reading}
            </p>
          </div>
        </div>,
        document.fullscreenElement ?? document.body,
      )
    }
    return <PaintAMapJobPicker userId={userId} mode="pick" lists={lists} onPick={pick} onClose={onClose} onLater={() => setLater(true)} />
  }

  const both = !!home.jobId && !!home.developmentId
  const canWalk = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const start = (first: 'line' | 'place' | 'walk') => {
    onStart({
      first,
      id: newId(),
      name: cleanPaintedText(name, PAINTED_MAP_NAME_MAX) || PAINTED_MAP_UNNAMED,
      words: cleanPaintedText(words, PAINTED_MAP_WORDS_MAX),
      home: forSite ? { ...home, jobId: null } : { ...home, developmentId: home.jobId ? null : home.developmentId },
    })
  }
  const homeWords = (home.jobId ? home.label : home.developmentLabel) || (home.jobId ? 'This job' : 'This development')

  return (
    <>
      {createPortal(
        <div
          data-paint-a-map-start
          data-paint-a-map-shape={desk ? 'window' : 'sheet'}
          style={{ ...frame.scrim, zIndex: PAINTED_MAP_SHEET_Z }}
          onClick={(e) => {
            // The window behind stays: this press closes the sheet alone.
            e.stopPropagation()
            onClose()
          }}
        >
          {/* At a desk the picker hangs at this sheet's own height and is shorter, so the sheet would show under it. It is kept, with what was typed, and not drawn. */}
          <div role="dialog" aria-modal="true" aria-label="Paint a map" onClick={(e) => e.stopPropagation()} style={picking && desk ? { ...frame.sheet, visibility: 'hidden' } : frame.sheet}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Paint a map</h2>
              <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem' }}>
                Cancel
              </button>
            </div>
            <div style={{ display: 'grid', gap: '0.7rem', padding: '0.75rem 1rem calc(0.95rem + env(safe-area-inset-bottom, 0px))' }}>
              <div data-paint-a-map-for style={{ display: 'grid', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>For</span>
                {later ? (
                  <div style={{ ...forBox, display: 'grid', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>It is on no job yet. It stays yours and the office’s until it is put on one.</span>
                    <button type="button" data-paint-a-map-pick-job style={{ ...quietPress, justifySelf: 'start' }} onClick={() => setPicking(true)}>
                      Pick the job it is for
                    </button>
                  </div>
                ) : both ? (
                  <>
                    <div role="group" aria-label="For" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <button type="button" aria-pressed={!forSite} style={forSite ? chip : chipOn} onClick={() => setForSite(false)}>
                        {home.label || 'This job'}
                      </button>
                      <button type="button" aria-pressed={forSite} style={forSite ? chipOn : chip} onClick={() => setForSite(true)}>
                        {home.developmentLabel ? `${home.developmentLabel}, every lot` : 'The whole development'}
                      </button>
                    </div>
                    {forSite ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>It will show on every job in the development.</span> : null}
                    {changeable ? (
                      <button type="button" data-paint-a-map-change-job style={{ ...quietPress, justifySelf: 'start' }} onClick={() => setPicking(true)}>
                        Change the job
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div style={forBox}>
                    <span aria-hidden style={{ ...PAINT_SWATCH, display: 'inline-block' }} />
                    <span style={{ minWidth: 0, display: 'grid', gap: 1 }}>
                      <b style={{ fontSize: '0.9375rem', lineHeight: 1.25 }}>{homeWords}</b>
                      {home.address ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{home.address}</span> : null}
                    </span>
                    {changeable ? (
                      <button type="button" data-paint-a-map-change-job style={{ ...quietPress, marginLeft: 'auto', flex: 'none' }} onClick={() => setPicking(true)}>
                        Change the job
                      </button>
                    ) : null}
                  </div>
                )}
                {guessWords && !later ? (
                  <span data-paint-a-map-guess style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {guessWords}
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                <label style={label}>
                  What is it?
                  <input type="text" value={name} maxLength={PAINTED_MAP_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="The way in for deliveries" style={field} />
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {NAME_CHIPS.map((c) => (
                    <button key={c} type="button" aria-pressed={name === c} style={name === c ? chipOn : chip} onClick={() => setName(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <label style={label}>
                A line for whoever opens it
                <input type="text" value={words} maxLength={PAINTED_MAP_WORDS_MAX} onChange={(e) => setWords(e.target.value)} placeholder="Start at the truck gate, not the sales entrance." style={field} />
              </label>
              {canWalk ? (
                <div data-paint-a-map-walk-box style={{ display: 'grid', gap: '0.4rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.55rem 0.7rem' }}>
                  <button type="button" data-paint-a-map-walk onClick={() => start('walk')} style={{ minHeight: 52, borderRadius: 8, border: '1px solid #dc2626', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                    Walk or drive it
                  </button>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-700)', display: 'grid', gap: '0.1rem' }}>
                    {WALK_BEFORE_WORDS.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{WALK_ASK_WORDS}</span>
                </div>
              ) : null}
              {/* The two ways that need no location. The draw screen itself says how a line is pressed out, so no paragraph stands between these and the fold. */}
              <button type="button" data-paint-a-map-go onClick={() => start('line')} style={{ minHeight: 52, borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                Draw it by hand
              </button>
              <button type="button" data-paint-a-map-place onClick={() => start('place')} style={{ minHeight: 48, borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                Start with a place
              </button>
            </div>
          </div>
        </div>,
        document.fullscreenElement ?? document.body,
      )}
      {picking && userId ? <PaintAMapJobPicker userId={userId} mode={later ? 'pick' : 'change'} excludeJobId={home.jobId ?? null} lists={lists} onPick={pick} onClose={() => setPicking(false)} /> : null}
    </>
  )
}
