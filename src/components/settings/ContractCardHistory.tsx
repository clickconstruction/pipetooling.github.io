import { useState, type CSSProperties } from 'react'
import { inForceLine, versionCompareKey, versionKind, versionLine, wordingInForceOn, type ContractTextVersion, type NameOf } from '../../lib/contracts/contractTextHistory'

/**
 * A card's history on Settings → Contracts & terms: every record of the wording, newest first,
 * each to read in place or to put in a Side by side column — and *What did it say on…*, which
 * answers for a customer who accepted on a given day.
 */

const MUTED: CSSProperties = { fontSize: '0.76rem', color: 'var(--text-muted)' }
const LINK: CSSProperties = { font: 'inherit', fontSize: '0.74rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const LINK_ON: CSSProperties = { ...LINK, background: 'var(--bg-blue-50)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' }
const BODY: CSSProperties = { margin: '0.3rem 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: 'inherit', fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-700)', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.6rem', maxHeight: 220, overflowY: 'auto' }

export type ContractCardHistoryProps = {
  /** Newest first. */
  versions: ReadonlyArray<ContractTextVersion>
  nameOf: NameOf
  picked: ReadonlyArray<string>
  onToggleCompare: (key: string) => void
  /** The card's key, for test ids. */
  cardKey: string
}

export function ContractCardHistory({ versions, nameOf, picked, onToggleCompare, cardKey }: ContractCardHistoryProps) {
  const [reading, setReading] = useState<string | null>(null)
  const [day, setDay] = useState('')
  const onDay = day ? wordingInForceOn(versions, day) : null

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', display: 'grid', gap: '0.5rem' }} data-testid={`contract-history-${cardKey}`}>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' }}>
        {versions.map((v, i) => {
          const key = versionCompareKey(v.id)
          const isPicked = picked.includes(key)
          const hasBody = versionKind(v) !== 'cleared'
          return (
            <li key={v.id} style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.5rem', alignItems: 'center' }}>
                <span>
                  {versionLine(v, nameOf)}
                  {i === 0 ? <span style={MUTED}> · as it stands</span> : null}
                </span>
                {hasBody ? (
                  <>
                    <button type="button" style={reading === v.id ? LINK_ON : LINK} aria-expanded={reading === v.id} onClick={() => setReading((prev) => (prev === v.id ? null : v.id))}>
                      {reading === v.id ? 'Close' : 'Read'}
                    </button>
                    <button type="button" style={isPicked ? LINK_ON : LINK} aria-pressed={isPicked} onClick={() => onToggleCompare(key)}>
                      {isPicked ? '✓ Comparing' : 'Compare'}
                    </button>
                  </>
                ) : null}
              </div>
              {reading === v.id ? <pre style={BODY}>{v.body}</pre> : null}
            </li>
          )
        })}
      </ol>

      <div style={{ display: 'grid', gap: '0.3rem' }}>
        <label style={{ ...MUTED, display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          What did it say on
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            aria-label="What did it say on"
            style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.15rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
          />
        </label>
        {day ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-700)' }} data-testid={`contract-in-force-${cardKey}`}>
            {inForceLine(versions, day)}{' '}
            {onDay && versionKind(onDay) !== 'cleared' ? (
              <button type="button" style={picked.includes(versionCompareKey(onDay.id)) ? LINK_ON : LINK} onClick={() => onToggleCompare(versionCompareKey(onDay.id))}>
                {picked.includes(versionCompareKey(onDay.id)) ? '✓ Comparing' : 'Compare it'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
