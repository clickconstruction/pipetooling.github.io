import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useToastContext } from '../contexts/ToastContext'
import { pageGate } from '../lib/roleGate'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { findCourse } from '../lib/training/courseRegistry'
import { courseProgress, lessonToOpen, type CourseLesson, type FinalCheckResult } from '../lib/training/courseContent'
import { courseStanding, standingWords, ymdWords, type CourseStanding, type TrainingPass, type TrainingPolicy } from '../lib/training/trainingState'
import { finishCourse, loadMyTraining, loadTrainingCatalog, passLesson } from '../lib/training/trainingIo'
import { LessonCheck } from '../components/training/LessonCheck'
import { FinalCheck } from '../components/training/FinalCheck'
import { Chip } from '../components/training/Chip'
import { BTN, BTN_DISABLED, BTN_PRIMARY, BTN_QUIET, VERDICT_TONES, inlineBold } from '../components/training/trainingUi'

/**
 * /training/<slug> — a training course, read at the person's own pace (punch list #111, v2.5566).
 *
 * A page of its own, not a window: a two-hour read on a phone wants a URL, scrolling and a resume. The rail lists
 * the parts and their lessons with a tick on each one done; a lesson is five minutes and ends in Check yourself,
 * four questions the person must get right (`LessonCheck`, recorded once by `training_pass_lesson`); the Final
 * check opens once every lesson is done and its pass is the course's pass (`FinalCheck`, recorded by
 * `training_finish_course`). Lessons open in any order; `?lesson=<key>` and `?final=1` are the doors.
 *
 * Anyone signed in may read a course that is on; a dev may read one that is off (a preview, said so). The
 * lessons come from the bundle (`courseRegistry`, lazy with this page); the policy and the record come from the
 * tables, and both reads fail soft until the migration is on prod.
 */

type Loaded = {
  policy: TrainingPolicy | null
  catalogMissing: boolean
  passedKeys: Set<string>
  passes: TrainingPass[]
}

const WRAP: CSSProperties = { maxWidth: 1080, margin: '0 auto', padding: '0 var(--page-wrap-pad, 1rem) 4rem' }

export default function Training() {
  const { slug = '' } = useParams()
  const { user, role, loading: authLoading } = useAuth()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const gate = pageGate({ loading: authLoading, user, role }, () => true)
  const course = useMemo(() => findCourse(slug), [slug])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [railOpen, setRailOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkSeed, setCheckSeed] = useState(() => Date.now() % 1_000_000)
  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId || !course) return
    let alive = true
    Promise.all([loadTrainingCatalog(), loadMyTraining(userId)])
      .then(([catalog, mine]) => {
        if (!alive) return
        setLoaded({
          policy: catalog.policies.find((p) => p.slug === course.slug) ?? null,
          catalogMissing: catalog.missing,
          passedKeys: new Set(mine.lessonPasses[course.slug] ?? []),
          passes: mine.passes.filter((p) => p.slug === course.slug),
        })
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(e instanceof Error ? e.message : 'Could not read your training')
      })
    return () => {
      alive = false
    }
  }, [userId, course])

  const today = todayYmdInAppTz()
  const lessonParam = params.get('lesson')
  const wantsFinal = params.get('final') === '1'
  const progress = useMemo(
    () => (course && loaded ? courseProgress(course, loaded.passedKeys, loaded.passes.length > 0) : null),
    [course, loaded],
  )
  // The lesson on screen is pinned once chosen: passing it must not jump the page to the next one. A `?lesson=`
  // in the URL wins; otherwise the first lesson not yet passed opens when the record arrives.
  const [openKey, setOpenKey] = useState<string | null>(null)
  useEffect(() => {
    if (lessonParam) setOpenKey(lessonParam)
  }, [lessonParam])
  useEffect(() => {
    if (!course || !loaded || lessonParam) return
    setOpenKey((k) => k ?? lessonToOpen(course, loaded.passedKeys).key)
  }, [course, loaded, lessonParam])
  const lesson: CourseLesson | null = useMemo(() => {
    if (!course || !loaded) return null
    return course.lessons.find((l) => l.key === openKey) ?? (openKey ? null : lessonToOpen(course, loaded.passedKeys))
  }, [course, loaded, openKey])
  const showFinal = Boolean(wantsFinal && progress?.allLessonsDone)
  const standing: CourseStanding | null = useMemo(
    () => (loaded?.policy ? courseStanding(loaded.policy, loaded.passes, role ?? null, today) : null),
    [loaded, role, today],
  )

  const openLesson = useCallback(
    (key: string) => {
      setOpenKey(key)
      setParams((p) => {
        const n = new URLSearchParams(p)
        n.set('lesson', key)
        n.delete('final')
        return n
      })
      setCheckSeed(Date.now() % 1_000_000)
      setRailOpen(false)
      window.scrollTo({ top: 0 })
    },
    [setParams],
  )
  const openFinal = useCallback(() => {
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('final', '1')
      n.delete('lesson')
      return n
    })
    setRailOpen(false)
    window.scrollTo({ top: 0 })
  }, [setParams])

  const onLessonPassed = useCallback(
    async (tries: number) => {
      if (!course || !lesson || !loaded) return
      if (loaded.passedKeys.has(lesson.key)) return
      setLoaded((prev) => (prev ? { ...prev, passedKeys: new Set([...prev.passedKeys, lesson.key]) } : prev))
      try {
        await passLesson(course.slug, lesson.key, tries)
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not record the lesson', 'error')
      }
    },
    [course, lesson, loaded, showToast],
  )

  const onFinalPassed = useCallback(
    async (r: FinalCheckResult, answers: Record<string, number>): Promise<boolean> => {
      if (!course) return false
      setSaving(true)
      try {
        await finishCourse({ courseSlug: course.slug, contentVersion: course.contentVersion, score: r.right, total: r.total, pass: course.finalPass, answers })
        setLoaded((prev) => (prev ? { ...prev, passes: [{ slug: course.slug, passedOn: today, contentVersion: course.contentVersion }, ...prev.passes] } : prev))
        showToast('Passed. Your training is recorded.', 'success')
        return true
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not record the pass', 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [course, showToast, today],
  )

  if (gate === 'wait') return <div style={WRAP}>Loading…</div>
  if (gate === 'away') return <Navigate to="/dashboard" replace />
  if (!course) {
    return (
      <div style={WRAP}>
        <p style={{ marginTop: '2rem' }}>No course is named {slug || 'that'}.</p>
        <Link to="/dashboard">‹ Dashboard</Link>
      </div>
    )
  }
  if (loadError) {
    return (
      <div style={WRAP}>
        <p style={{ marginTop: '2rem', color: 'var(--text-red-700)' }}>{loadError}</p>
        <Link to="/dashboard">‹ Dashboard</Link>
      </div>
    )
  }
  if (!loaded || !progress || !lesson) return <div style={WRAP}>Loading…</div>

  const isDev = role === 'dev'
  const courseOn = Boolean(loaded.policy?.on)
  if (!courseOn && !isDev) {
    return (
      <div style={WRAP}>
        <p style={{ marginTop: '2rem' }}>{course.title} is not on yet. A dev turns it on in Settings → Training.</p>
        <Link to="/dashboard">‹ Dashboard</Link>
      </div>
    )
  }

  const partName = (n: number) => course.parts.find((p) => p.n === n)?.name ?? ''
  const standingLine = standing ? standingWords(standing, today) : ''
  const lessonIndex = course.lessons.findIndex((l) => l.key === lesson.key)
  const prev = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : null
  const next = lessonIndex < course.lessons.length - 1 ? course.lessons[lessonIndex + 1] : null
  const lessonDone = loaded.passedKeys.has(lesson.key)

  return (
    <div style={WRAP} data-training-course={course.slug}>
      <style>{`
        .training-cols { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 0; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
        .training-rail { border-right: 1px solid var(--border); padding: 0.6rem 0; }
        @media (max-width: 640px) { .training-cols { grid-template-columns: 1fr; } .training-rail { border-right: 0; border-bottom: 1px solid var(--border); } }
      `}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem 0 0.75rem' }}>
        <Link to="/dashboard" style={{ ...BTN_QUIET, textDecoration: 'none' }}>
          ‹ Dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.25rem', lineHeight: 1.2 }}>{course.title}</h1>
        <Chip tone="blue" title="Lessons done">
          {progress.lessonsDone} of {progress.lessons} lessons
        </Chip>
        {progress.finalPassed && <Chip tone="green">Final check passed</Chip>}
        {!courseOn && <Chip tone="gray">Preview · switched off</Chip>}
        {/* The standing chip says when a pass was and when it is due; with no pass the lesson count already says it all (v2.5575). */}
        {standing && standing.passedOn && standingLine && (
          <span style={{ ...VERDICT_TONES[standing.colour], padding: '0.1rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }} data-standing={standing.colour}>
            {standingLine}
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{course.line}</span>
      </header>

      <div className="training-cols">
        <nav className="training-rail" aria-label="Lessons">
          {isMobile && (
            <button type="button" className="trainingPress" onClick={() => setRailOpen((o) => !o)} style={{ ...BTN, margin: '0 0.75rem 0.4rem', width: 'calc(100% - 1.5rem)', justifyContent: 'space-between' }} aria-expanded={railOpen}>
              <span>Lessons · {progress.lessonsDone} of {progress.lessons}</span>
              <span aria-hidden="true">{railOpen ? '▴' : '▾'}</span>
            </button>
          )}
          {(!isMobile || railOpen) && (
            <>
              {course.parts.map((part) => {
                const lessons = course.lessons.filter((l) => l.part === part.n)
                if (!lessons.length) return null
                return (
                  <div key={part.n}>
                    <p style={{ margin: 0, padding: '0.5rem 0.9rem 0.15rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {part.n === 0 ? part.name : `${part.n} · ${part.name}`}
                    </p>
                    {lessons.map((l) => {
                      const done = loaded.passedKeys.has(l.key)
                      const now = l.key === lesson.key && !showFinal
                      return (
                        <button
                          key={l.key}
                          type="button"
                          className="trainingRow"
                          onClick={() => openLesson(l.key)}
                          aria-current={now ? 'page' : undefined}
                          data-lesson-row={l.key}
                          data-done={done ? 'true' : 'false'}
                          style={{
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'baseline',
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.3rem 0.9rem',
                            minHeight: 30,
                            border: 0,
                            font: 'inherit',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            background: now ? 'var(--bg-blue-tint)' : 'transparent',
                            color: now ? 'var(--text-blue-700)' : done ? 'var(--text-muted)' : 'var(--text-base)',
                            fontWeight: now ? 700 : 400,
                          }}
                        >
                          <span style={{ width: 20, flex: 'none', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{l.order}</span>
                          <span style={{ minWidth: 0 }}>
                            {done && <span style={{ color: 'var(--text-green-700)', fontWeight: 700 }}>✓ </span>}
                            {l.title}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              <div style={{ margin: '0.75rem 0.9rem 0.25rem' }}>
                <button
                  type="button"
                  className="trainingPress"
                  onClick={openFinal}
                  disabled={!progress.allLessonsDone}
                  aria-current={showFinal ? 'page' : undefined}
                  data-final-row
                  style={{
                    ...BTN,
                    width: '100%',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    whiteSpace: 'normal',
                    borderStyle: progress.allLessonsDone ? 'solid' : 'dashed',
                    ...(progress.allLessonsDone ? {} : { ...BTN_DISABLED, color: 'var(--text-muted)' }),
                    ...(showFinal ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' } : {}),
                  }}
                >
                  {progress.allLessonsDone
                    ? `Final check · ${course.finalDraw} questions, ${course.finalPass} right passes`
                    : `Final check · opens when every lesson is done`}
                </button>
              </div>
            </>
          )}
        </nav>

        <main style={{ padding: '1rem 1.25rem 1.5rem', maxWidth: '72ch', minWidth: 0 }}>
          {showFinal ? (
            <FinalCheck
              course={course}
              onPassed={onFinalPassed}
              saving={saving}
              recordedLine={standing?.dueOn ? `Recorded, due again ${ymdWords(standing.dueOn, today)}.` : null}
              onHome={() => navigate('/dashboard')}
              onReadAgain={() => {
                const first = course.lessons[0]
                if (first) openLesson(first.key)
              }}
            />
          ) : (
            <article data-lesson={lesson.key}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
                {lesson.part === 0 ? partName(0) : `Part ${lesson.part}`} · Lesson {lesson.order} of {course.lessons.length} · about {lesson.minutes} minutes
              </p>
              <h2 style={{ margin: '0.1rem 0 0.6rem', fontSize: '1.4rem', lineHeight: 1.2 }}>{lesson.title}</h2>
              <h3 style={h5}>Why it matters</h3>
              {lesson.why.map((p, i) => (
                <p key={i} style={{ margin: '0 0 0.4rem' }}>
                  {inlineBold(p)}
                </p>
              ))}
              <h3 style={h5}>Must know</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {lesson.mustKnow.map((p, i) => (
                  <li key={i} style={{ margin: '0.2rem 0' }}>
                    {inlineBold(p)}
                  </li>
                ))}
              </ul>
              <h3 style={h5}>Traps</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {lesson.traps.map((p, i) => (
                  <li key={i} style={{ margin: '0.2rem 0' }}>
                    {inlineBold(p)}
                  </li>
                ))}
              </ul>
              <h3 style={h5}>Numbers to remember</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {lesson.numbers.map((n, i) => (
                  <span key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.1rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-subtle)' }}>
                    <b>{n.value}</b> · {n.label}
                  </span>
                ))}
              </div>
              <LessonCheck lesson={lesson} seed={checkSeed} alreadyPassed={lessonDone} onPassed={onLessonPassed} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                {prev && (
                  <button type="button" className="trainingPress" onClick={() => openLesson(prev.key)} style={BTN}>
                    ‹ {prev.title}
                  </button>
                )}
                <span style={{ marginLeft: 'auto' }} />
                {next ? (
                  <button type="button" className="trainingPress" onClick={() => openLesson(next.key)} disabled={!lessonDone} style={{ ...BTN_PRIMARY, ...(lessonDone ? {} : BTN_DISABLED) }} data-next-lesson>
                    Next lesson ›
                  </button>
                ) : (
                  <button type="button" className="trainingPress" onClick={openFinal} disabled={!progress.allLessonsDone} style={{ ...BTN_PRIMARY, ...(progress.allLessonsDone ? {} : BTN_DISABLED) }} data-next-lesson>
                    Final check ›
                  </button>
                )}
              </div>
            </article>
          )}
        </main>
      </div>
    </div>
  )
}

const h5: CSSProperties = { margin: '1rem 0 0.25rem', fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }
