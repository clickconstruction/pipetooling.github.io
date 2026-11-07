import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserRole } from '../../hooks/useAuth'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { loadMyTraining, loadTrainingCatalog } from '../../lib/training/trainingIo'
import { TRAINING_COURSE_FACTS, courseSizeWords } from '../../lib/training/courseFacts'
import { offeredCourses, offeredPress, personStandings, standingPress, standingWords, trainingVerdict, ymdWords, type CourseStanding, type TrainingPass, type TrainingPolicy } from '../../lib/training/trainingState'
import { dueVerdict, personDueStrips, type TrainingDueStrip as TrainingDueStripModel } from '../../lib/training/trainingDueStrip'
import { DueChipSpan, TrainingDueStrip } from '../training/TrainingDueStrip'
import { ShapeSwitch, SideBySide } from '../prototypes/SideBySide'
import { useShapeView } from '../prototypes/useShapeView'

/**
 * Dashboard → Training (punch list #111, v2.5567): the card at the bottom of the page, under My Time, where a
 * person sees the courses their role must take in one colour. One verdict line (*1 course to do*, *1 course to
 * take again*, *You are caught up*), then one row per course with where they stand and one press: Start,
 * Continue, Take it again or Read it again, each opening `/training/<slug>`. Renders nothing while nothing is
 * required of the role, the catalog is empty or the tables are not on prod yet; it never nags a caught-up crew
 * member with more than one quiet green line. The colour is `trainingState.ts`'s, the same rule the People rail
 * and Settings read.
 *
 * v2.5610 (punch list #119): an OFFERED course, open to every role, sits under an **Available** line for the roles
 * it is not required of: the title, its size, one press (Start, Continue, Read it again), no dot, no colour and no
 * due day. The verdict line counts required courses only, and a viewer with nothing required and one offer sees the
 * card with the Available row alone.
 *
 * The *Due strip* switch (punch list #217, field-11, v2.6152; a prototype the owner asked to see first) draws each
 * required course's due date as a strip from the pass day to the due day, the amber window shaded and today's tick
 * on it, the version passed named at its start; amber splits into *due soon* and *lapsed*, and a pass a retake day
 * voided is its own case (`trainingDueStrip.ts`). Off by default and remembered per person on the device; a dev
 * with `?sbs=1` on the URL sees today's look and the strip one above the other.
 */

export const TRAINING_DUE_STRIP_KEY = 'training-due-strip'

type Loaded = { policies: TrainingPolicy[]; passes: TrainingPass[]; lessonCounts: Record<string, number> }

const TONES: Record<CourseStanding['colour'], CSSProperties> = {
  red: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  green: { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' },
}

const DOTS: Record<CourseStanding['colour'], string> = { red: '#dc2626', amber: '#d97706', green: '#16a34a' }

function pressStyle(quiet: boolean, offered: boolean): CSSProperties {
  return {
    gridRow: '1 / span 2',
    gridColumn: 2,
    padding: '0.45rem 0.9rem',
    minHeight: 36,
    borderRadius: 6,
    font: 'inherit',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: quiet ? '1px solid transparent' : offered ? '1px solid var(--border)' : '1px solid #2563eb',
    background: quiet ? 'none' : offered ? 'var(--surface)' : '#2563eb',
    color: quiet ? 'var(--text-link)' : offered ? 'var(--text-base)' : '#fff',
  }
}

export function DashboardTrainingSection({ userId, role, onVisibility }: { userId: string; role: UserRole | null; onVisibility?: (visible: boolean) => void }) {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const today = todayYmdInAppTz()
  const shape = useShapeView(TRAINING_DUE_STRIP_KEY)

  useEffect(() => {
    let alive = true
    Promise.all([loadTrainingCatalog(), loadMyTraining(userId)])
      .then(([catalog, mine]) => {
        if (!alive) return
        const lessonCounts: Record<string, number> = {}
        for (const [slug, keys] of Object.entries(mine.lessonPasses)) lessonCounts[slug] = keys.length
        setLoaded(catalog.missing || mine.missing ? { policies: [], passes: [], lessonCounts: {} } : { policies: catalog.policies, passes: mine.passes, lessonCounts })
      })
      .catch(() => {
        // A failed read shows nothing: the card is a nudge, never an alarm about the app.
        if (alive) setLoaded({ policies: [], passes: [], lessonCounts: {} })
      })
    return () => {
      alive = false
    }
  }, [userId])

  const standings = useMemo(() => (loaded ? personStandings(loaded.policies, loaded.passes, role, today) : []), [loaded, role, today])
  const strips = useMemo(() => (loaded ? personDueStrips(loaded.policies, loaded.passes, role, today) : []), [loaded, role, today])
  const offered = useMemo(() => (loaded ? offeredCourses(loaded.policies, loaded.passes, role) : []), [loaded, role])
  const verdict = trainingVerdict(standings)
  const visible = (standings.length > 0 && verdict != null) || offered.length > 0

  useEffect(() => {
    onVisibility?.(visible)
  }, [visible, onVisibility])

  if (!visible) return null

  const standingBySlug = new Map(standings.map((s) => [s.slug, s]))

  /** The sub line before a strip can draw: the size before the first press, how far once started. */
  const startSub = (slug: string): string => {
    const done = loaded?.lessonCounts[slug] ?? 0
    const facts = TRAINING_COURSE_FACTS[slug]
    return done > 0 ? `${done} of ${facts?.lessons ?? '?'} lessons done` : (courseSizeWords(facts) ?? 'Required for your role · not started')
  }

  const courseRow = (s: CourseStanding, strip: TrainingDueStripModel | null): ReactNode => {
    const done = loaded?.lessonCounts[s.slug] ?? 0
    const press = standingPress(s, done > 0)
    const quiet = press === 'Read it again'
    const words = standingWords(s, today)
    // v2.5575: before the first press the line says the size (from course.md, never the lessons); started says how far.
    const sub = strip
      ? strip.state === 'superseded'
        ? `Passed ${ymdWords(strip.passedOn!, today)} on an older version. Everyone takes it again from ${ymdWords(strip.dueOn!, today)}.`
        : strip.todayPct == null
          ? startSub(s.slug)
          : ''
      : words || startSub(s.slug)
    return (
      <div key={s.slug} data-training-course={s.slug} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.25rem 0.9rem', alignItems: 'center', paddingTop: '0.7rem' }}>
        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {s.title}
          {strip ? <DueChipSpan chip={strip.chip} /> : null}
        </div>
        <button type="button" className="trainingPress" onClick={() => navigate(`/training/${s.slug}`)} style={pressStyle(quiet, false)}>
          {press}
        </button>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {strip ? <TrainingDueStrip strip={strip} /> : null}
          {sub}
        </div>
      </div>
    )
  }

  const body = (withStrip: boolean): ReactNode => {
    const line = withStrip ? dueVerdict(strips) : verdict
    return (
      <div data-training-body={withStrip ? 'strip' : 'words'}>
        {line && (
          <div style={{ ...TONES[line.colour], padding: '0.45rem 0.7rem', borderRadius: 7, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }} data-training-verdict>
            <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: DOTS[line.colour], flex: 'none' }} />
            {line.line}
          </div>
        )}
        {withStrip
          ? strips.map((strip) => {
              const s = standingBySlug.get(strip.slug)
              return s ? courseRow(s, strip) : null
            })
          : standings.map((s) => courseRow(s, null))}
        {offered.length > 0 && (
          <div style={{ marginTop: standings.length ? '0.9rem' : 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }} data-training-available>
            Available
          </div>
        )}
        {offered.map((o) => {
          const done = loaded?.lessonCounts[o.slug] ?? 0
          const press = offeredPress(o, done > 0)
          const facts = TRAINING_COURSE_FACTS[o.slug]
          const sub = o.passedOn ? `Done ${ymdWords(o.passedOn, today)}` : done > 0 ? `${done} of ${facts?.lessons ?? '?'} lessons done` : (courseSizeWords(facts) ?? 'Open to everyone')
          const quiet = press === 'Read it again'
          return (
            <div key={o.slug} data-training-offered={o.slug} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.25rem 0.9rem', alignItems: 'center', paddingTop: '0.5rem' }}>
              <div style={{ fontWeight: 700 }}>{o.title}</div>
              <button type="button" className="trainingPress" onClick={() => navigate(`/training/${o.slug}`)} style={pressStyle(quiet, true)}>
                {press}
              </button>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sub}</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label="Training"
      data-training-card={verdict?.colour ?? 'none'}
      data-training-shape={shape.sideBySide ? 'side-by-side' : shape.on ? 'strip' : 'words'}
      style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.85rem 1rem 1rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Training</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>at your own pace</span>
        {standings.length > 0 ? (
          <ShapeSwitch on={shape.on} onToggle={shape.toggle} label="Due strip" title="Draw each course's due day as a strip from the day you passed, with the window before it shaded" />
        ) : null}
      </div>
      {shape.sideBySide ? <SideBySide today={body(false)} shape={body(true)} /> : body(shape.on)}
    </div>
  )
}
