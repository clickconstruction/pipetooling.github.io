/**
 * Prospects → State roll → Our own (punch list #411): each plumbing license we hold beside what the state's roll
 * says of the same number. Nobody is contacted from here. The one write is a license's own date, saved where it
 * lives on People → Licenses, by typing it in place or by taking the state's.
 *
 * Values are drawn in place: our date is changeable, so it is a press that turns into its field. Everything the
 * state says is worked out, so it is plain bold.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../EmptyState'
import { ChangeableValue, ValueLine, ValueLines, ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { useToastContext } from '../../contexts/ToastContext'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { filterOwnLines, ownLines, type OwnFilter, type OwnLine, type OwnTone } from '../../lib/licenseRoll/ownLicenses'
import { readOwnLicenses, saveOwnLicenseDate, type OwnLicensesRead } from '../../lib/licenseRoll/ownLicensesIo'
import { val } from '../../lib/valuesInPlace'
import { formatWorkDateYmdFriendly, todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' } as const
const quiet = { fontSize: '0.8125rem', color: 'var(--text-muted)' } as const
const press = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: '0.875rem', minHeight: 44, cursor: 'pointer' } as const

const PILL: Record<OwnTone, { background: string; color: string }> = {
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
}

const WHERE_LICENSES_LIVE = '/people?tab=licenses'

function OwnCard({ line, saving, onDate }: { line: OwnLine; saving: boolean; onDate: (line: OwnLine, ymd: string) => Promise<void> }) {
  const stateDate = line.useStateDate
  return (
    <div style={card} data-own-license={line.key}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{line.personName}</div>
          <div style={quiet}>{line.sub ? 'Sub' : 'Teammate'}</div>
        </div>
        <span data-own-pill={line.verdict} style={{ ...PILL[line.tone], borderRadius: 999, padding: '3px 10px', fontSize: '0.8125rem', fontWeight: 600, flexShrink: 0, textAlign: 'right' }}>
          {line.pill}
        </span>
      </div>
      <ValueLines>
        <ValueLine label="We hold">
          <WorkedOutValue>{line.holds}</WorkedOutValue>
          {line.number && (
            <>
              {' '}
              number <WorkedOutValue>{line.number}</WorkedOutValue>
            </>
          )}
        </ValueLine>
        {line.licenseId && (
          <ValueLine label="Our date">
            <ChangeableValue
              text={line.ourDate ? formatWorkDateYmdFriendly(line.ourDate) : 'No date'}
              label="the day this license ends"
              type="date"
              value={line.ourDate ?? ''}
              onKeep={(value) => onDate(line, value)}
            />
          </ValueLine>
        )}
        {line.stateSays && (
          <ValueLine label="The state says">
            <ValueSentence text={line.stateSays} />
          </ValueLine>
        )}
        {line.stateName && (
          <ValueLine label="Listed as">
            <WorkedOutValue>{line.stateName}</WorkedOutValue>
          </ValueLine>
        )}
        {line.insurance && (
          <ValueLine label="Insurance with the board">
            <ValueSentence text={line.insurance.words} />
          </ValueLine>
        )}
      </ValueLines>
      {line.why && (
        <div style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--text)' }}>
          <ValueSentence text={line.why} />
        </div>
      )}
      {stateDate && (
        <button
          type="button"
          onClick={() => void onDate(line, stateDate)}
          aria-disabled={saving}
          style={{ ...press, marginTop: 10, background: saving ? DEAD_PRESS_FILL : 'var(--surface)', color: saving ? DEAD_PRESS_TEXT : 'var(--text)', cursor: saving ? 'default' : 'pointer' }}
        >
          {saving ? 'Saving…' : 'Use the state’s date'}
        </button>
      )}
    </div>
  )
}

export function StateRollOwn() {
  const { showToast } = useToastContext()
  const [read, setRead] = useState<OwnLicensesRead | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [filter, setFilter] = useState<OwnFilter | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setRead(await readOwnLicenses())
      setFailure(null)
    } catch (e) {
      setFailure(formatErrorMessage(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const own = useMemo(() => (read ? ownLines({ records: read.records, roll: read.roll, today: todayYmdInAppTz() }) : null), [read])

  // A date typed in place throws to its own field, which shows the reason. The press has no field, so it toasts.
  const saveDate = useCallback(
    async (line: OwnLine, ymd: string) => {
      if (!line.licenseId || saving) return
      const fromPress = ymd === line.useStateDate
      setSaving(line.key)
      try {
        const warning = await saveOwnLicenseDate(line.licenseId, ymd)
        showToast(warning ?? `${line.personName}: the date is now ${formatWorkDateYmdFriendly(ymd)}.`, warning ? 'warning' : 'success')
        await load()
      } catch (e) {
        if (!fromPress) throw e
        showToast(formatErrorMessage(e), 'error')
      } finally {
        setSaving(null)
      }
    },
    [saving, load, showToast],
  )

  if (failure && !read) {
    return (
      <div style={{ ...card, maxWidth: 560 }} role="alert">
        <div style={{ color: 'var(--text-strong)', fontWeight: 700 }}>Our own licenses could not be read.</div>
        <div style={{ ...quiet, margin: '4px 0 10px' }}>{failure}</div>
        <button type="button" onClick={() => void load()} style={press}>
          Read it again
        </button>
      </div>
    )
  }
  if (!read || !own) return <div style={quiet}>Reading our own licenses…</div>

  const look = filterOwnLines(own.lines, 'look')
  const matches = filterOwnLines(own.lines, 'matches')
  // The list opens on what needs a look, and on the matches when nothing does.
  const showing: OwnFilter = filter ?? (look.length > 0 ? 'look' : 'matches')
  const shown = showing === 'look' ? look : matches
  const chips: { key: OwnFilter; label: string; count: number }[] = [
    { key: 'look', label: 'Needs a look', count: look.length },
    { key: 'matches', label: 'Matches', count: matches.length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ color: 'var(--text)' }}>Our own plumbing licenses, each beside what the state’s roll says of its number. Nobody is contacted from this page.</div>
        {own.otherTrades > 0 && (
          <div style={{ ...quiet, marginTop: 4 }}>
            <ValueSentence text={`${val('count', String(own.otherTrades))} ${own.otherTrades === 1 ? 'license of another trade is' : 'licenses of other trades are'} not checked here. The state roll is plumbing for now.`} />
          </div>
        )}
      </div>

      {own.lines.length === 0 ? (
        <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'plumbing licenses', page: { label: 'People → Licenses', tail: 'is where a license is added.' } }), { to: WHERE_LICENSES_LIVE })} />
      ) : (
        <>
          <div role="group" aria-label="Which licenses to show" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((c) => {
              const on = showing === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(c.key)}
                  style={{ ...press, borderRadius: 999, fontWeight: on ? 700 : 400, borderColor: on ? 'var(--text)' : 'var(--border)' }}
                >
                  {c.label} · <WorkedOutValue>{String(c.count)}</WorkedOutValue>
                </button>
              )
            })}
          </div>

          {shown.length === 0 ? (
            showing === 'look' ? (
              <EmptyState main={emptyWords({ kind: 'waiting', who: 'you' }).main} />
            ) : (
              <div style={quiet}>Every license here needs a look. Press Needs a look to see them.</div>
            )
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 8 }}>
              {shown.map((line) => (
                <OwnCard key={line.key} line={line} saving={saving === line.key} onDate={saveDate} />
              ))}
            </div>
          )}
        </>
      )}

      {failure && (
        <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          The page could not be read again: {failure}
        </div>
      )}
    </div>
  )
}
