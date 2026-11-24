/**
 * Prospects → State roll → Everyone (punch list #411, step three): the kept roll for our counties, with a search box
 * and chips, read a page at a time. A row opens the person's sheet (`StateRollSheet`), kept on the address as
 * `person=<id>`. At the foot, who is left off at their asking, each with **Put back on the list**.
 *
 * A table on a desk, two lines a person on a phone. Every value is the state's or the app's, so it is plain bold.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import { StateRollSheet } from './StateRollSheet'
import { ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { useToastContext } from '../../contexts/ToastContext'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import {
  CLASS_CHIPS,
  classWords,
  countyWords,
  EVERYONE_FIRST_FILTER,
  expiresWords,
  filterIsFirst,
  noteCounts,
  notedNumbers,
  noteKey,
  oursTags,
  personName,
  pickClass,
  pickStatus,
  sinceWords,
  type EveryoneFilter,
  type EveryoneRow,
  type LeftOffRow,
} from '../../lib/licenseRoll/everyone'
import { EVERYONE_PAGE, putBackOnRoll, readEveryoneFrame, readEveryonePage, type EveryoneFrame, type LeaveOffOutcome } from '../../lib/licenseRoll/everyoneIo'
import { countWords } from '../../lib/licenseRoll/rollPulls'
import { val } from '../../lib/valuesInPlace'
import { formatCompactNoteDateTime, todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' } as const
const quiet = { fontSize: '0.8125rem', color: 'var(--text-muted)' } as const
const press = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: '0.875rem', minHeight: 44, cursor: 'pointer', fontFamily: 'inherit' } as const
const th = { textAlign: 'left', padding: '7px 8px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' } as const
const td = { textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.875rem', color: 'var(--text)' } as const

const SEARCH_WAIT_MS = 300

function Chip({ on, label, count, onPress }: { on: boolean; label: string; count?: number; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPress}
      style={{
        fontFamily: 'inherit',
        minHeight: 44,
        padding: '0 14px',
        borderRadius: 999,
        fontSize: '0.8125rem',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        border: `1px solid ${on ? '#93b4f5' : 'var(--border)'}`,
        background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
        color: on ? 'var(--text-blue-700)' : 'var(--text)',
        fontWeight: on ? 600 : 400,
      }}
    >
      {label}
      {count != null && (
        <>
          {' · '}
          <WorkedOutValue>{countWords(count)}</WorkedOutValue>
        </>
      )}
    </button>
  )
}

function StatusPill({ row }: { row: EveryoneRow }) {
  const lapsed = row.status === 'expired'
  return (
    <span style={{ borderRadius: 999, padding: '2px 9px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', background: lapsed ? 'var(--bg-amber-tint)' : 'var(--bg-green-tint)', color: lapsed ? 'var(--text-amber-800)' : 'var(--text-green-800)' }}>
      {lapsed ? 'Lapsed' : 'Current'}
    </span>
  )
}

function OursCell({ row, notes, canSeeOwn }: { row: EveryoneRow; notes: number; canSeeOwn: boolean }) {
  const tags = oursTags(row, notes, canSeeOwn)
  // A row with nothing of ours leaves the cell blank: a word in every empty cell reads as noise down the column.
  if (tags.length === 0) return null
  return (
    <>
      {tags.map((t) => (
        <span key={t.label} style={{ display: 'inline-block', borderRadius: 999, padding: '1px 8px', margin: '0 4px 3px 0', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', background: t.tone === 'green' ? 'var(--bg-green-tint)' : 'var(--bg-muted)', color: t.tone === 'green' ? 'var(--text-green-800)' : 'var(--text)', border: '1px solid var(--border)' }}>
          {t.label}
        </span>
      ))}
    </>
  )
}

function MedGas({ row }: { row: EveryoneRow }) {
  if (!row.endorsements.includes('medical_gas')) return null
  return <span style={{ display: 'inline-block', marginTop: 3, borderRadius: 999, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', whiteSpace: 'nowrap' }}>Medical gas</span>
}

export function StateRollEveryone({ canSeeOwn, authUserId }: { canSeeOwn: boolean; authUserId: string | null }) {
  const { showToast, showActionToast } = useToastContext()
  const narrow = useNarrowViewport640()
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('person')

  const [frame, setFrame] = useState<EveryoneFrame | null>(null)
  const [frameFailure, setFrameFailure] = useState<string | null>(null)
  const [filter, setFilter] = useState<EveryoneFilter>(EVERYONE_FIRST_FILTER)
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<EveryoneRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [reading, setReading] = useState(false)
  const [pageFailure, setPageFailure] = useState<string | null>(null)
  const [showLeftOff, setShowLeftOff] = useState(false)
  const [puttingBack, setPuttingBack] = useState<string | null>(null)
  const [readNo, setReadNo] = useState(0)
  const asked = useRef(0)

  const loadFrame = useCallback(async () => {
    try {
      setFrame(await readEveryoneFrame())
      setFrameFailure(null)
    } catch (e) {
      setFrameFailure(formatErrorMessage(e))
    }
  }, [])

  useEffect(() => {
    void loadFrame()
  }, [loadFrame])

  // The search is read once the typing stops.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(0)
      setSearch(typed)
    }, SEARCH_WAIT_MS)
    return () => window.clearTimeout(t)
  }, [typed])

  const numbers = useMemo(() => notedNumbers(frame?.notes ?? []), [frame])
  const counts = useMemo(() => noteCounts(frame?.notes ?? []), [frame])

  // A page under the chips and the search. A change to either starts again at the first page. A reply that comes
  // back after a newer question was asked is dropped.
  useEffect(() => {
    if (!frame) return
    const n = ++asked.current
    setReading(true)
    readEveryonePage({ counties: frame.counties, filter, search, notedNumbers: numbers, page })
      .then((out) => {
        if (n !== asked.current) return
        setRows((was) => (page === 0 ? out.rows : [...was, ...out.rows]))
        setTotal(out.total)
        setPageFailure(null)
      })
      .catch((e) => {
        if (n !== asked.current) return
        setPageFailure(formatErrorMessage(e))
      })
      .finally(() => {
        if (n === asked.current) setReading(false)
      })
  }, [frame, filter, search, numbers, page, readNo])

  const changeFilter = (next: EveryoneFilter) => {
    setPage(0)
    setFilter(next)
  }

  const setPerson = useCallback(
    (id: string | null) =>
      setSearchParams(
        (p) => {
          const params = new URLSearchParams(p)
          if (id) params.set('person', id)
          else params.delete('person')
          return params
        },
        { replace: true },
      ),
    [setSearchParams],
  )

  const readAgain = useCallback(async () => {
    setPage(0)
    setReadNo((x) => x + 1)
    await loadFrame()
  }, [loadFrame])

  const putBack = useCallback(
    async (id: string, shownAs: string) => {
      if (puttingBack) return
      setPuttingBack(id)
      try {
        await putBackOnRoll(id)
        showToast(`${shownAs || 'They'} go back on the roll with the next Monday pull.`, 'success')
        await loadFrame()
      } catch (e) {
        showToast(formatErrorMessage(e), 'error')
      } finally {
        setPuttingBack(null)
      }
    },
    [puttingBack, showToast, loadFrame],
  )

  const onLeftOff = useCallback(
    (outcome: LeaveOffOutcome) => {
      setPerson(null)
      showActionToast(`${outcome.shownAs} is left off the roll.`, { label: 'Put back', onClick: () => void putBack(outcome.leftOffId, outcome.shownAs) }, { type: 'success', durationMs: 10_000 })
      void readAgain()
    },
    [setPerson, showActionToast, putBack, readAgain],
  )

  if (frameFailure && !frame) {
    return (
      <div style={{ ...card, maxWidth: 560 }} role="alert">
        <div style={{ color: 'var(--text-strong)', fontWeight: 700 }}>The state roll could not be read.</div>
        <div style={{ ...quiet, margin: '4px 0 10px' }}>{frameFailure}</div>
        <button type="button" onClick={() => void loadFrame()} style={press}>
          Read it again
        </button>
      </div>
    )
  }
  if (!frame) return <div style={quiet}>Reading the state roll…</div>

  const today = todayYmdInAppTz()
  const hiddenByAsk = search.trim() !== '' || !filterIsFirst(filter)
  const clear = () => {
    setTyped('')
    setSearch('')
    changeFilter(EVERYONE_FIRST_FILTER)
  }
  const left = total - rows.length
  const more = Math.min(EVERYONE_PAGE, left)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label htmlFor="roll-everyone-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Search the state roll
        </label>
        <input
          id="roll-everyone-search"
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Search a name or a license number"
          autoComplete="off"
          style={{ width: '100%', maxWidth: 520, boxSizing: 'border-box', minHeight: 44, padding: '8px 12px', fontSize: '1rem', fontFamily: 'inherit', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
        />
      </div>

      <div role="group" aria-label="Which licenses" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Chip on={filter.status === 'current'} label="Current" count={frame.current} onPress={() => changeFilter(pickStatus(filter, 'current'))} />
        <Chip on={filter.status === 'lapsed'} label="Lapsed" count={frame.lapsed} onPress={() => changeFilter(pickStatus(filter, 'lapsed'))} />
        {CLASS_CHIPS.map((c) => (
          <Chip key={c.key} on={filter.classes.includes(c.key)} label={c.label} onPress={() => changeFilter(pickClass(filter, c.key))} />
        ))}
        <Chip on={filter.medicalGas} label="Medical gas" onPress={() => changeFilter({ ...filter, medicalGas: !filter.medicalGas })} />
        <Chip on={filter.hasNotes} label="Has our notes" count={frame.withNotes} onPress={() => changeFilter({ ...filter, hasNotes: !filter.hasNotes })} />
      </div>

      <div style={quiet} aria-live="polite">
        {reading && rows.length === 0 ? 'Reading…' : rows.length > 0 ? <ValueSentence text={`Showing ${val('count', countWords(rows.length))} of ${val('count', countWords(total))}.`} /> : null}
      </div>

      {pageFailure && (
        <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          The list could not be read: {pageFailure}{' '}
          <button type="button" onClick={() => setReadNo((x) => x + 1)} style={{ ...press, minHeight: 44, marginLeft: 6 }}>
            Read it again
          </button>
        </div>
      )}

      {!reading && rows.length === 0 && !pageFailure ? (
        hiddenByAsk ? (
          <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'people', query: search }), { onPress: clear })} />
        ) : (
          <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'people on the roll', page: { label: 'Pulls', tail: 'reads the state’s files.' } }), { to: '/prospects?tab=roll&roll=pulls' })} />
        )
      ) : narrow ? (
        <div data-roll-everyone="list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              data-roll-row={row.id}
              onClick={() => setPerson(row.id)}
              style={{ ...card, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'start', minHeight: 44, overflowWrap: 'anywhere' }}
            >
              <span style={{ minWidth: 0 }}>
                <b style={{ color: 'var(--text-strong)' }}>{personName(row)}</b>
                <span style={{ ...quiet, display: 'block' }}>
                  {classWords(row.license_class)} <WorkedOutValue>{row.license_number}</WorkedOutValue>
                </span>
                <span style={{ ...quiet, display: 'block' }}>
                  Since <WorkedOutValue>{sinceWords(row.licensed_on, today)}</WorkedOutValue> · {row.status === 'expired' ? 'Expired' : 'Expires'} <WorkedOutValue>{expiresWords(row.expires_on)}</WorkedOutValue> · <WorkedOutValue>{countyWords(row.county)}</WorkedOutValue>
                </span>
                <span style={{ display: 'block', marginTop: 3 }}>
                  <MedGas row={row} /> <OursCell row={row} notes={counts.get(noteKey(row.source, row.license_number)) ?? 0} canSeeOwn={canSeeOwn} />
                </span>
              </span>
              <StatusPill row={row} />
            </button>
          ))}
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table data-roll-everyone="table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>License</th>
                <th style={th}>Since</th>
                <th style={th}>Expires</th>
                <th style={th}>County</th>
                <th style={th}>Ours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-roll-row={row.id} onClick={() => setPerson(row.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ ...td, overflowWrap: 'anywhere', minWidth: 140 }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPerson(row.id) }} style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer', textAlign: 'left', minHeight: 24 }}>
                      {personName(row)}
                    </button>
                  </td>
                  <td style={td}>
                    {classWords(row.license_class)} <span style={{ ...quiet, whiteSpace: 'nowrap' }}>{row.license_number}</span>
                    <br />
                    <MedGas row={row} />
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <WorkedOutValue>{sinceWords(row.licensed_on, today)}</WorkedOutValue>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <WorkedOutValue>{expiresWords(row.expires_on)}</WorkedOutValue>
                    <div style={{ marginTop: 3 }}>
                      <StatusPill row={row} />
                    </div>
                  </td>
                  <td style={td}>
                    <WorkedOutValue>{countyWords(row.county)}</WorkedOutValue>
                  </td>
                  <td style={td}>
                    <OursCell row={row} notes={counts.get(noteKey(row.source, row.license_number)) ?? 0} canSeeOwn={canSeeOwn} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {left > 0 && rows.length > 0 && (
        <button
          type="button"
          onClick={() => !reading && setPage((p) => p + 1)}
          aria-disabled={reading}
          style={{ ...press, alignSelf: 'flex-start', background: reading ? DEAD_PRESS_FILL : 'var(--surface)', color: reading ? DEAD_PRESS_TEXT : 'var(--text)', cursor: reading ? 'default' : 'pointer' }}
        >
          {reading ? 'Reading…' : `Show ${countWords(more)} more`}
        </button>
      )}

      <LeftOffFoot rows={frame.leftOff} open={showLeftOff} onToggle={() => setShowLeftOff((o) => !o)} puttingBack={puttingBack} onPutBack={(r) => void putBack(r.id, r.shown_as)} />

      {openId && (
        <StateRollSheet
          rollId={openId}
          authUserId={authUserId}
          onClose={() => setPerson(null)}
          onLeftOff={onLeftOff}
          onNotesChanged={() => void loadFrame()}
        />
      )}
    </div>
  )
}

function LeftOffFoot({ rows, open, onToggle, puttingBack, onPutBack }: { rows: LeftOffRow[]; open: boolean; onToggle: () => void; puttingBack: string | null; onPutBack: (row: LeftOffRow) => void }) {
  if (rows.length === 0) return null
  return (
    <div style={{ ...card, marginTop: 6 }} data-roll-left-off>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--text)' }}>
          <ValueSentence text={`Left off at their asking: ${val('count', countWords(rows.length))}`} />
        </div>
        <button type="button" onClick={onToggle} aria-expanded={open} style={press}>
          {open ? 'Hide them' : 'Show them'}
        </button>
      </div>
      <div style={{ ...quiet, marginTop: 4 }}>Each pull keeps them off until someone puts them back on the list.</div>
      {open &&
        rows.map((r) => (
          <div key={r.id} data-left-off={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 8, overflowWrap: 'anywhere' }}>
            <div style={{ minWidth: 0 }}>
              <b style={{ color: 'var(--text-strong)' }}>{r.shown_as || r.license_number || 'A person'}</b>
              <div style={quiet}>
                Left off by {r.noted_by_name || 'someone here'} on <WorkedOutValue>{formatCompactNoteDateTime(r.noted_at)}</WorkedOutValue>
              </div>
              {r.note && <div style={{ fontSize: '0.875rem', color: 'var(--text)', marginTop: 2 }}>{r.note}</div>}
            </div>
            <button type="button" onClick={() => onPutBack(r)} aria-disabled={puttingBack != null} style={{ ...press, flexShrink: 0 }}>
              {puttingBack === r.id ? 'Putting back…' : 'Put back on the list'}
            </button>
          </div>
        ))}
    </div>
  )
}
