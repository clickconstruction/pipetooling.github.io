/**
 * Prospects → State roll (punch list #411): the state's public roll of licensed plumbers, kept for our counties.
 * Two views so far. Pulls: what is kept, when each of the state's files was last read, and what the read changed.
 * It names no person. Our own (`StateRollOwn`): our own licenses beside the state's rows. The views that say who
 * to call come later.
 *
 * Values are drawn in place: a count or a day stands apart from its words, one fact a line. Every value here is
 * worked out by the app, so each is plain bold.
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import { StateRollOwn } from './StateRollOwn'
import { pageSubTabStyle } from '../../lib/pageTabStyle'
import { ValueLine, ValueLines, ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { useToastContext } from '../../contexts/ToastContext'
import { usePeopleAccess } from '../../hooks/usePeopleAccess'
import { batchOutcomeWords, countedLabel } from '../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { countWords, countyWords, FILES_TO_PULL, pullChangeWords, pullLines, pullTroubleWords, pullWasClean, ROLL_TILES, type PullLine } from '../../lib/licenseRoll/rollPulls'
import { pullRollFile, readRollPulls, type RollPullsRead } from '../../lib/licenseRoll/rollPullsIo'
import { val } from '../../lib/valuesInPlace'
import { formatCompactNoteDateTime } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'

const FILE_NOUN = ['file', 'files'] as const

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' } as const
const quiet = { fontSize: '0.8125rem', color: 'var(--text-muted)' } as const

/** A file the last press could not pull, with the board's or the function's own reason. */
type Held = { says: string; why: string }

function FileCard({ line }: { line: PullLine }) {
  const good = line.lastGood
  const trouble = pullTroubleWords(line)
  return (
    <div style={card} data-roll-file={line.file}>
      <div style={{ fontWeight: 700, color: 'var(--text-strong)', marginBottom: 6 }}>{line.says}</div>
      {good ? (
        <ValueLines>
          <ValueLine label="Last read">
            <WorkedOutValue>{formatCompactNoteDateTime(good.finished_at ?? good.started_at)}</WorkedOutValue>
          </ValueLine>
          <ValueLine label="Kept">
            <ValueSentence text={`${val('count', countWords(good.rows_kept))} of the ${val('count', countWords(good.rows_seen))} in the state's file`} />
          </ValueLine>
          <ValueLine label="That read">
            <ValueSentence text={pullChangeWords(good)} />
          </ValueLine>
        </ValueLines>
      ) : (
        <div style={quiet}>Not read yet.</div>
      )}
      {trouble && line.last && !pullWasClean(line.last) && (
        <div role="alert" style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          The read of <WorkedOutValue tone="red">{formatCompactNoteDateTime(line.last.started_at)}</WorkedOutValue> did not finish. {trouble}
        </div>
      )}
    </div>
  )
}

type RollView = 'own' | 'pulls'
const ROLL_VIEWS: readonly { key: RollView; label: string }[] = [
  { key: 'own', label: 'Our own' },
  { key: 'pulls', label: 'Pulls' },
]

/**
 * The tab: its views, and the strip that picks one. **Our own** is drawn for a person who may also open
 * People → Licenses, since it reads the same licenses. Anyone else with the tab has Pulls alone and no strip.
 * The view is kept on the address as `roll=own` or `roll=pulls`, so a link opens the same view.
 */
export function StateRollTab({ canSeeOwn = false }: { canSeeOwn?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const asked = searchParams.get('roll')
  const view: RollView = !canSeeOwn ? 'pulls' : asked === 'pulls' ? 'pulls' : 'own'
  const pick = (next: RollView) =>
    setSearchParams(
      (p) => {
        const params = new URLSearchParams(p)
        params.set('roll', next)
        return params
      },
      { replace: true },
    )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 }}>
      {canSeeOwn && (
        <div role="group" aria-label="State roll views" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ROLL_VIEWS.map((v) => (
            <button key={v.key} type="button" aria-current={view === v.key ? 'true' : undefined} onClick={() => pick(v.key)} style={{ ...pageSubTabStyle(view === v.key), fontFamily: 'inherit', minHeight: 44, padding: '0.3rem 1rem' }}>
              {v.label}
            </button>
          ))}
        </div>
      )}
      {view === 'own' ? <StateRollOwn /> : <StateRollPulls />}
    </div>
  )
}

/** The tab as the page mounts it: it waits for who the person is, so Our own never flashes open or shut. */
export function StateRollTabForUser({ authUserId }: { authUserId: string }) {
  const access = usePeopleAccess(authUserId)
  if (!access.accessResolved) return <div style={quiet}>Reading the state roll…</div>
  return <StateRollTab canSeeOwn={access.canAccessLicenses} />
}

function StateRollPulls() {
  const { showToast } = useToastContext()
  const [read, setRead] = useState<RollPullsRead | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [pulling, setPulling] = useState<string | null>(null)
  const [held, setHeld] = useState<Held[]>([])

  const load = useCallback(async () => {
    try {
      setRead(await readRollPulls())
      setFailure(null)
    } catch (e) {
      setFailure(formatErrorMessage(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // One file at a time, so the board gets one request at a time, and on past a file that fails.
  const pullEvery = useCallback(async () => {
    if (pulling) return
    const lines = pullLines(read?.pulls ?? [])
    const stopped: Held[] = []
    let done = 0
    for (const file of FILES_TO_PULL) {
      const says = lines.find((l) => l.file === file)?.says ?? file
      setPulling(says)
      const outcome = await pullRollFile(file)
      if (outcome.ok) done += 1
      else stopped.push({ says, why: outcome.why })
    }
    setPulling(null)
    setHeld(stopped)
    const words = batchOutcomeWords({ verb: 'pull', past: 'Pulled', done, failed: stopped.length, noun: FILE_NOUN })
    showToast(words.line, words.tone)
    await load()
  }, [pulling, read, load, showToast])

  const pullLabel = countedLabel('Pull', FILES_TO_PULL.length, FILE_NOUN)
  const pullPress = (
    <button
      type="button"
      onClick={() => void pullEvery()}
      aria-disabled={pulling != null}
      style={{ background: pulling ? DEAD_PRESS_FILL : 'var(--surface)', color: pulling ? DEAD_PRESS_TEXT : 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: '0.875rem', minHeight: 44, cursor: pulling ? 'default' : 'pointer', flexShrink: 0 }}
    >
      {pulling ? `Pulling ${pulling}…` : pullLabel}
    </button>
  )

  if (failure && !read) {
    return (
      <div style={{ ...card, maxWidth: 560 }} role="alert">
        <div style={{ color: 'var(--text-strong)', fontWeight: 700 }}>The state roll could not be read.</div>
        <div style={{ ...quiet, margin: '4px 0 10px' }}>{failure}</div>
        <button type="button" onClick={() => void load()} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: '0.875rem', minHeight: 44, cursor: 'pointer' }}>
          Read it again
        </button>
      </div>
    )
  }
  if (!read) return <div style={quiet}>Reading the state roll…</div>

  const lines = pullLines(read.pulls)
  const neverPulled = read.pulls.length === 0
  const counties = countyWords(read.counties)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ color: 'var(--text)' }}>
          <ValueSentence text={`The state's public roll of licensed plumbers, kept for ${val('counties', counties || 'no county yet')}.`} />
        </div>
        <div style={{ marginTop: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '8px 10px', fontSize: '0.8125rem' }}>
          The state gives no phone, street address or email for a person, so none is kept. This page says who holds a license near us. It does not say how to reach them.
        </div>
      </div>

      {!neverPulled && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {ROLL_TILES.map((t) => (
            <div key={t.key} style={card}>
              <div style={{ fontSize: '1.375rem', lineHeight: 1.15 }}>
                <WorkedOutValue>{countWords(read.kept[t.key] ?? 0)}</WorkedOutValue>
              </div>
              <div style={quiet}>{t.label} kept</div>
            </div>
          ))}
          <div style={card}>
            <div style={{ fontSize: '1.375rem', lineHeight: 1.15 }}>
              <WorkedOutValue>{countWords(read.lapsed)}</WorkedOutValue>
            </div>
            <div style={quiet}>of them with a lapsed license</div>
          </div>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--text-strong)' }}>Pulls</h2>
          {!neverPulled && pullPress}
        </div>
        <div style={{ ...quiet, marginTop: 4 }}>The state's files are read every Monday morning. A read keeps our counties and notes what changed.</div>
      </div>

      {neverPulled ? (
        <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'pulls', control: pullLabel }), { onPress: () => void pullEvery() })} />
      ) : (
        // Two across on a desk, one on a phone: four cards read as two rows of two, never three and one.
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 8 }}>
          {lines.map((line) => (
            <FileCard key={line.file} line={line} />
          ))}
        </div>
      )}

      {held.length > 0 && (
        <div style={card} role="alert">
          <div style={{ fontWeight: 700, color: 'var(--text-strong)', marginBottom: 4 }}>{batchOutcomeWords({ verb: 'pull', past: 'Pulled', done: FILES_TO_PULL.length - held.length, failed: held.length, noun: FILE_NOUN }).head}</div>
          {held.map((h) => (
            <div key={h.says} style={{ fontSize: '0.8125rem', color: 'var(--text)', marginTop: 4 }}>
              <WorkedOutValue>{h.says}</WorkedOutValue>: {h.why}
            </div>
          ))}
          <div style={{ ...quiet, marginTop: 6 }}>Nothing on the roll was changed for a file that did not pull. Press {pullLabel} to try again.</div>
        </div>
      )}

      {failure && (
        <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          The page could not be read again: {failure}
        </div>
      )}
    </div>
  )
}
