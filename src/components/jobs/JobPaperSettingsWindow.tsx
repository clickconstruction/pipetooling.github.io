/**
 * The office's settings page on a job (punch list #389, step 4). A paper built from settings is required with its
 * settings, and this is where the office sets them.
 *
 *   - **The first time, the walked flow** (Taunya's call, 2026-11-21): the Document builder's flow, fed from the
 *     Contract Book entry's settings list. It opens on the notice with its box, then the basis, the note on the real
 *     site, one page a topic and the review. The review's press requires the paper.
 *   - **After that, one page**: every topic's slider, the basis and the blanks. The press says what it will do before
 *     it is pressed: saved in place while nobody has signed, and a new version that everyone signs again once someone
 *     has. The notice's box is not asked a second time.
 *   - A list with no levels cannot be walked, so it is set on the one page the first time too.
 *
 * The database decides every rule (`jobPaperSettingsIo.ts`). The kernels say them first: `jobPaperFlow.ts` and
 * `jobPaperSettings.ts`. Nothing here draws a clause. The window closes on its own presses only, so a stray press
 * outside it does not lose a walk.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import {
  readRuleProblem,
  settingsChangePlan,
} from '../../lib/contracts/jobPaperSettings'
import {
  blanksMissing,
  blanksToType,
  changeWords,
  flowDefFromBook,
  flowFromPicks,
  flowUnfit,
  hasNotice,
  picksFromFlow,
  stopOfPick,
} from '../../lib/contracts/jobPaperFlow'
import {
  choiceOf,
  startPicks,
  type PaperPicks,
  type PaperSetting,
} from '../../lib/contracts/paperSettings'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  PAPER_OFF,
  plural,
  topicFloor,
  topicOf,
  type PaperSettings,
  type PaperStop,
} from '../../lib/documentBuilder/documentBuilder'
import {
  supabaseJobPaperSettingsIo,
  type BookSettingsPaper,
  type JobForSettings,
  type JobPaperSettingsIo,
  type JobSettingsPaper,
} from '../../lib/jobs/jobPaperSettingsIo'
import {
  recoveryFailureFromError,
  type OfflineRecoveryLastError,
} from '../../lib/offlineRecoveryState'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  clauseButtonStyle,
  clauseInputStyle,
  clausePrimaryStyle,
} from '../contracts/clauseStyles'
import { DocumentBuilderFlow } from '../documentBuilder/DocumentBuilderFlow'
import { DocumentBuilderSlider } from '../documentBuilder/DocumentBuilderSlider'
import OfflineRetryPanel from '../OfflineRetryPanel'

/** What the window is opened for: a Book entry to require, or a required paper to change. */
export type JobPaperSettingsTarget =
  | { kind: 'first'; bookDocumentId: string; paperName: string }
  | { kind: 'change'; paper: JobSettingsPaper; paperName: string }

const muted: CSSProperties = {
  margin: 0,
  color: 'var(--text-muted)',
  fontSize: '0.82rem',
}
const card: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.6rem 0.7rem',
  display: 'grid',
  gap: '0.45rem',
  background: 'var(--surface)',
}
const head: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  fontWeight: 700,
  color: 'var(--text-strong)',
}
const DEAD: CSSProperties = {
  background: DEAD_PRESS_FILL,
  borderColor: DEAD_PRESS_FILL,
  color: DEAD_PRESS_TEXT,
  cursor: 'not-allowed',
}
// Every press and field here is at least a finger tall (Taunya, 2026-11-21: the buttons easy to press).
const CLOSE: CSSProperties = {
  ...clauseButtonStyle,
  minHeight: 44,
  minWidth: 64,
}
const PRIMARY: CSSProperties = {
  ...clausePrimaryStyle,
  minHeight: 44,
  padding: '0.5rem 1.1rem',
  fontSize: '0.95rem',
}
const FIELD: CSSProperties = {
  ...clauseInputStyle,
  minHeight: 44,
  fontSize: '1rem',
}
const tidy = (
  typed: Record<string, string>,
  keys: readonly string[],
): Record<string, string> | null => {
  const out: Record<string, string> = {}
  for (const k of keys)
    if ((typed[k] ?? '').trim() !== '') out[k] = typed[k]!.trim()
  return Object.keys(out).length > 0 ? out : null
}

function Shell({
  title,
  lede,
  onClose,
  children,
}: {
  title: string
  lede: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    // The backdrop takes the press and keeps it: a press outside the window closes neither this window nor the job's.
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(760px, 100%)',
          maxHeight: 'min(94vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div
          style={{
            padding: '0.7rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: '0.6rem',
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{title}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {lede}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={CLOSE}>
            Close
          </button>
        </div>
        <div
          style={{
            padding: '0.8rem 1rem',
            overflowY: 'auto',
            display: 'grid',
            gap: '0.8rem',
            minHeight: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** The blanks no picked choice fills, typed for this job. */
function Blanks({
  book,
  picks,
  typed,
  onTyped,
}: {
  book: BookSettingsPaper
  picks: PaperPicks | null
  typed: Record<string, string>
  onTyped: (next: Record<string, string>) => void
}) {
  const blanks = blanksToType(book.def, picks)
  if (blanks.length === 0) return null
  return (
    <div style={card} data-job-settings-blanks="">
      <h4 style={head}>For this job</h4>
      {blanks.map((f) => (
        <label
          key={f.key}
          style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}
        >
          <span style={{ fontWeight: 600 }}>{f.label || f.key}</span>
          <input
            aria-label={f.label || f.key}
            value={typed[f.key] ?? ''}
            onChange={(e) => onTyped({ ...typed, [f.key]: e.target.value })}
            style={FIELD}
          />
        </label>
      ))}
    </div>
  )
}

export function JobPaperSettingsWindow({
  job,
  target,
  io = supabaseJobPaperSettingsIo,
  onClose,
  onDone,
}: {
  job: { id: string }
  target: JobPaperSettingsTarget
  io?: JobPaperSettingsIo
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useToastContext()
  const bookId =
    target.kind === 'first'
      ? target.bookDocumentId
      : target.paper.bookDocumentId
  const [book, setBook] = useState<BookSettingsPaper | null | undefined>(
    undefined,
  )
  const [jobRow, setJobRow] = useState<JobForSettings | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const live = useRef(true)
  // Set on every mount, not only cleared on the way out: a development build mounts, unmounts and mounts again.
  useEffect(() => {
    live.current = true
    return () => void (live.current = false)
  }, [])

  const load = useCallback(async () => {
    setFailure(null)
    try {
      const [b, j] = await Promise.all([
        bookId ? io.readBookPaper(bookId) : Promise.resolve(null),
        io.readJob(job.id),
      ])
      if (!live.current) return
      setBook(b)
      setJobRow(j)
    } catch (e) {
      if (live.current)
        setFailure(
          recoveryFailureFromError(e, 'Couldn’t read this paper’s settings'),
        )
    }
  }, [io, bookId, job.id])
  useEffect(() => void load(), [load])

  const title = `${target.paperName}${jobRow?.number ? `, job ${jobRow.number}` : ''}`
  const lede =
    target.kind === 'first'
      ? 'Set this job’s settings, then require the paper.'
      : 'This job’s settings for the paper.'
  if (failure)
    return (
      <Shell title={title} lede={lede} onClose={onClose}>
        <OfflineRetryPanel
          failure={failure}
          onRetry={() => void load()}
          surface="job-paper-settings"
          idempotent
        />
      </Shell>
    )
  if (book === undefined || !jobRow)
    return (
      <Shell title={title} lede={lede} onClose={onClose}>
        <p style={muted}>Loading…</p>
      </Shell>
    )
  if (book === null)
    return (
      <Shell title={title} lede={lede} onClose={onClose}>
        <p style={muted}>
          This paper is no longer built from settings in the Contract Book. Take
          it off the job.
        </p>
      </Shell>
    )
  const readProblem = readRuleProblem(
    {
      name: book.name,
      revision: book.revision,
      readRevision: book.readRevision,
    },
    jobRow,
  )
  const done = (words: string) => {
    showToast(words, 'success')
    onDone()
  }
  return (
    <Shell title={title} lede={lede} onClose={onClose}>
      {readProblem ? (
        <div
          role="alert"
          style={{
            ...card,
            borderColor: 'var(--text-amber-700)',
            background: 'var(--bg-amber-tint)',
            fontSize: '0.85rem',
          }}
        >
          {readProblem}
        </div>
      ) : null}
      {target.kind === 'first' && !flowUnfit(book.def) ? (
        <FirstByFlow
          job={job}
          jobRow={jobRow}
          book={book}
          io={io}
          held={readProblem}
          onDone={done}
        />
      ) : (
        <OnePage
          job={job}
          jobRow={jobRow}
          book={book}
          io={io}
          paper={target.kind === 'change' ? target.paper : null}
          held={readProblem}
          onDone={done}
        />
      )}
    </Shell>
  )
}

/** The first setting, walked: the flow's review requires the paper. */
function FirstByFlow({
  job,
  jobRow,
  book,
  io,
  held,
  onDone,
}: {
  job: { id: string }
  jobRow: JobForSettings
  book: BookSettingsPaper
  io: JobPaperSettingsIo
  held: string | null
  onDone: (words: string) => void
}) {
  const def = useMemo(
    () =>
      flowDefFromBook(book.def, {
        paperId: book.id,
        title: book.name,
        job: jobRow.number,
      }),
    [book, jobRow.number],
  )
  const notice = hasNotice(book.def)
  // A list with no notice has no box to tick: the walk opens on the basis.
  const start = useMemo(
    () => (notice ? undefined : { ackAt: new Date().toISOString(), step: 1 }),
    [notice],
  )
  const [answer, setAnswer] = useState<{
    settings: PaperSettings
    ackAt: string | null
  } | null>(null)
  const [typed, setTyped] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const picks = answer ? picksFromFlow(book.def, answer.settings) : null
  const missing = blanksMissing(book.def, picks, typed)

  const require = async () => {
    if (!answer || !picks || busy) return
    setBusy(true)
    setError(null)
    try {
      await io.requireWithSettings(job.id, book.id, {
        picks,
        typed: tidy(
          typed,
          blanksToType(book.def, picks).map((f) => f.key),
        ),
        basis: answer.settings.basis,
        noticeRead: notice && answer.ackAt != null,
      })
      onDone(`${book.name} is required on this job.`)
    } catch (e) {
      setError(formatErrorMessage(e, 'The paper was not required.'))
      setBusy(false)
    }
  }
  const note =
    held ??
    (missing.length > 0 ? `Type ${missing.join(' and ')} first.` : undefined)
  // The blanks sit under the review, below the fold on most screens: the note is a press that goes to the first empty one.
  const blanksRef = useRef<HTMLDivElement>(null)
  const toBlank = () => {
    const empty = [
      ...(blanksRef.current?.querySelectorAll('input') ?? []),
    ].find((i) => i.value.trim() === '')
    empty?.scrollIntoView?.({ block: 'center' })
    empty?.focus()
  }
  return (
    <DocumentBuilderFlow
      def={def}
      style={{ height: 'min(72vh, 680px)' }}
      host={{
        start,
        onHeld: setAnswer,
        onConfirm: () => void require(),
        confirm: {
          ...(busy ? { label: 'Requiring…' } : {}),
          ...(busy || held || missing.length > 0 ? { dead: true } : {}),
          ...(note ? { note } : {}),
          ...(!held && missing.length > 0 ? { onNote: toBlank } : {}),
        },
        reviewExtra: (
          <div ref={blanksRef} style={{ display: 'grid', gap: 12 }}>
            <Blanks
              book={book}
              picks={picks}
              typed={typed}
              onTyped={setTyped}
            />
            {error ? (
              <div
                role="alert"
                style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}
              >
                {error}
              </div>
            ) : null}
          </div>
        ),
      }}
    />
  )
}

/** One page: every topic, the basis and the blanks. It changes a required paper, and sets a list with no levels. */
function OnePage({
  job,
  jobRow,
  book,
  io,
  paper,
  held,
  onDone,
}: {
  job: { id: string }
  jobRow: JobForSettings
  book: BookSettingsPaper
  io: JobPaperSettingsIo
  paper: JobSettingsPaper | null
  held: string | null
  onDone: (words: string) => void
}) {
  const fits = !flowUnfit(book.def)
  const def = useMemo(
    () =>
      fits
        ? flowDefFromBook(book.def, {
            paperId: book.id,
            title: book.name,
            job: jobRow.number,
          })
        : null,
    [fits, book, jobRow.number],
  )
  const [picks, setPicks] = useState<PaperPicks>(
    () => paper?.picks ?? startPicks(book.def),
  )
  const [typed, setTyped] = useState<Record<string, string>>(() => ({
    ...(paper?.typed ?? {}),
  }))
  const [basis, setBasis] = useState<string | null>(() =>
    paper
      ? (flowFromPicks(book.def, paper.picks, paper.basis)?.basis ??
        paper.basis)
      : (book.def.levels[0]?.key ?? null),
  )
  const [ticked, setTicked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notice = !paper && hasNotice(book.def)
  const typedNow = tidy(
    typed,
    blanksToType(book.def, picks).map((f) => f.key),
  )
  const missing = blanksMissing(book.def, picks, typed)
  const plan = paper
    ? settingsChangePlan({
        def: book.def,
        from: {
          picks: paper.picks,
          typed: paper.typed,
          bookRevision: paper.bookRevision,
        },
        to: { picks, typed: typedNow, bookRevision: book.revision },
        signed: paper.signed,
      })
    : null
  const basisMoved = paper != null && basis !== paper.basis && basis != null
  const words = plan ? changeWords(plan) : null
  const onlyBasis = plan?.kind === 'nothing' && basisMoved

  const pick = (s: PaperSetting, stop: PaperStop) => {
    const choice =
      stop === PAPER_OFF
        ? s.choices.find((c) => c.out)
        : choiceOf(
            book.def,
            s.key,
            book.def.levels.find((l) => l.key === stop)?.picks[s.key],
          )
    if (choice) setPicks((p) => ({ ...p, [s.key]: choice.key }))
  }
  const save = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (!paper) {
        await io.requireWithSettings(job.id, book.id, {
          picks,
          typed: typedNow,
          basis,
          noticeRead: notice && ticked,
        })
        onDone(`${book.name} is required on this job.`)
        return
      }
      let rowId = paper.requiredPaperId
      let signAgain = 0
      if (plan && plan.kind !== 'nothing') {
        const saved = await io.setSettings(rowId, picks, typedNow)
        rowId = saved.requiredPaperId
        signAgain = saved.state === 'revised' ? saved.signAgain : 0
      }
      if (basisMoved) await io.setBasis(rowId, basis)
      onDone(
        signAgain > 0
          ? `The settings are saved. ${plural(signAgain, 'person signs', 'people sign')} the new version again.`
          : onlyBasis
            ? 'The basis is moved. Nobody signs again.'
            : 'The settings are saved.',
      )
    } catch (e) {
      setError(formatErrorMessage(e, 'The settings were not saved.'))
      setBusy(false)
    }
  }

  const blockedFirst =
    !paper && (held != null || missing.length > 0 || (notice && !ticked))
  const dead =
    busy ||
    (paper
      ? held != null ||
        missing.length > 0 ||
        (words?.dead === true && !onlyBasis)
      : blockedFirst)
  const press = busy
    ? 'Saving…'
    : !paper
      ? 'Require this paper'
      : onlyBasis
        ? 'Save the basis'
        : (words?.press ?? 'Save the settings')
  const lines = !paper
    ? []
    : onlyBasis
      ? ['The basis marks this page. Nobody signs again.']
      : (words?.lines ?? [])
  return (
    <>
      {!fits ? <p style={muted}>{flowUnfit(book.def)}</p> : null}
      {notice ? (
        <div style={card} data-job-settings-notice="">
          <h4 style={head}>{book.def.notice?.title || 'Before you start'}</h4>
          {(book.def.notice?.lines ?? []).map((l) => (
            <p key={l} style={{ margin: 0, fontSize: '0.85rem' }}>
              {l}
            </p>
          ))}
          <label
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              fontSize: '0.9rem',
              fontWeight: 600,
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={ticked}
              onChange={(e) => setTicked(e.target.checked)}
              style={{
                width: 20,
                height: 20,
                margin: 0,
                accentColor: '#2563eb',
              }}
            />
            <span>{book.def.notice?.tick || 'I have read this.'}</span>
          </label>
        </div>
      ) : null}
      {def && book.def.levels.length > 0 ? (
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
          <span style={{ fontWeight: 600 }}>The basis</span>
          <select
            aria-label="The basis"
            value={basis ?? ''}
            onChange={(e) => setBasis(e.target.value || null)}
            style={FIELD}
          >
            {book.def.levels.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
          <span style={muted}>
            The level this job’s paper should express. It marks each slider
            below, and moving it changes no topic.
          </span>
        </label>
      ) : null}
      {book.def.settings.map((s) => {
        const choice = choiceOf(book.def, s.key, picks[s.key])
        const stop = def ? stopOfPick(book.def, s, picks[s.key], basis) : null
        const topic = def ? topicOf(def, s.key) : undefined
        return (
          <div key={s.key} style={card} data-job-setting={s.key}>
            <h4 style={head}>{s.label}</h4>
            {def && topic && stop !== null ? (
              <DocumentBuilderSlider
                def={def}
                value={stop}
                label={s.label}
                floor={topicFloor(topic)}
                floorWhy="This topic is in every paper"
                basis={basis ?? undefined}
                onPick={(next) => pick(s, next)}
              />
            ) : (
              <select
                aria-label={s.label}
                value={picks[s.key] ?? ''}
                onChange={(e) =>
                  setPicks((p) => ({ ...p, [s.key]: e.target.value }))
                }
                style={FIELD}
              >
                {s.choices.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
            <p style={muted}>
              <b style={{ color: 'var(--text-strong)' }}>
                {choice?.label ?? 'Not picked'}.
              </b>{' '}
              {choice?.says ?? ''}
            </p>
          </div>
        )
      })}
      <Blanks book={book} picks={picks} typed={typed} onTyped={setTyped} />
      {error ? (
        <div
          role="alert"
          style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}
        >
          {error}
        </div>
      ) : null}
      <div
        style={{ display: 'grid', gap: '0.35rem' }}
        data-job-settings-foot=""
      >
        {lines.map((l) => (
          <p key={l} style={muted}>
            {l}
          </p>
        ))}
        {missing.length > 0 ? (
          <p style={muted}>{`Type ${missing.join(' and ')} first.`}</p>
        ) : null}
        {notice && !ticked ? <p style={muted}>Tick the box to go on.</p> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={dead}
            onClick={() => void save()}
            style={dead ? { ...PRIMARY, ...DEAD } : PRIMARY}
          >
            {press}
          </button>
        </div>
      </div>
    </>
  )
}
