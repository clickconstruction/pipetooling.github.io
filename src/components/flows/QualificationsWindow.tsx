/**
 * Their qualifications (spike, 2026-10-23): the owner's scale for the trades, asked in one small window off a candidate's or a
 * sub's flow. Three rows, one a trade, each with the four levels in the owner's words; the license they hold, or none;
 * where they are. The line at the foot says what is still needed before their qualifications read as noted. Save hands them to
 * the caller; the window keeps nothing itself.
 */
import { useState } from 'react'
import { EMPTY_QUALIFICATIONS, qualificationsComplete, LEVEL_WORDS, LEVELS, qualificationsMissing, TRADE_WORDS, TRADES, type Level, type Trade, type Qualifications } from '../../lib/hiring/tradeScale'
import { Btn, input } from '../gc/gcUi'
import { HomeMapWindow } from './HomeMapWindow'

export function QualificationsWindow({ name, start = EMPTY_QUALIFICATIONS, onSave, onClose, busy = false }: { name: string; start?: Qualifications; onSave: (quals: Qualifications) => void; onClose: () => void; busy?: boolean }) {
  const [levels, setLevels] = useState<Partial<Record<Trade, Level>>>(start.levels)
  const [license, setLicense] = useState<string>(start.license?.has ? start.license.words : '')
  const [noLicense, setNoLicense] = useState<boolean>(start.license ? !start.license.has : false)
  const [location, setLocation] = useState(start.location)
  // The home's pin, once the map found it (the owner's ask of 2026-10-23); typing over the words drops it.
  const [homePin, setHomePin] = useState<{ lat: number; lng: number } | null>(start.homePin ?? null)
  const [mapOpen, setMapOpen] = useState(false)
  const quals: Qualifications = { levels, license: noLicense ? { has: false } : license.trim() ? { has: true, words: license.trim() } : null, location, homePin }
  const missing = qualificationsMissing(quals)
  const anything = Object.keys(levels).length > 0 || quals.license !== null || location.trim() !== ''
  return (
    <div role="dialog" aria-modal="true" aria-label={`Qualifications of ${name}`} data-qualifications="" style={{ position: 'fixed', inset: 0, zIndex: 780, display: 'grid', placeItems: 'center', background: 'rgba(0, 0, 0, 0.35)', padding: '1rem' }}>
      <div style={{ width: 'min(34rem, 100%)', maxHeight: '100%', overflowY: 'auto', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '0.9rem 1rem', display: 'grid', gap: '0.7rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Their qualifications</h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>One scale for every trade. A zero is an answer.</div>
        </div>
        {TRADES.map((trade) => (
          <fieldset key={trade} style={{ border: '1px solid var(--border)', borderRadius: 8, margin: 0, padding: '0.5rem 0.65rem', display: 'grid', gap: '0.25rem' }}>
            <legend style={{ fontWeight: 600, fontSize: '0.875rem', padding: '0 0.3rem' }}>{TRADE_WORDS[trade]}</legend>
            {LEVELS.map((level) => (
              <label key={level} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="radio" name={`trade-level-${trade}`} checked={levels[trade] === level} onChange={() => setLevels((l) => ({ ...l, [trade]: level }))} disabled={busy} />
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: '1ch' }}>{level}</span>
                <span>{LEVEL_WORDS[level]}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
          <span>License</span>
          <input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="Journeyman plumber, TX M-12345" style={input} disabled={busy || noLicense} />
        </label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={noLicense} onChange={(e) => setNoLicense(e.target.checked)} disabled={busy} />
          <span>No license</span>
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
          <span>Home, where they drive in from</span>
          <input
            value={location}
            onChange={(e) => {
              setLocation(e.target.value)
              setHomePin(null)
            }}
            placeholder="A city, a zip or an address"
            style={input}
            disabled={busy}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.8rem' }}>
          <Btn kind="plain" onClick={() => setMapOpen(true)} disabled={busy}>
            Find it on the map
          </Btn>
          {homePin ? <span style={{ color: 'var(--text-muted)' }}>Pinned on the map.</span> : null}
        </div>
        {mapOpen ? (
          <HomeMapWindow
            start={{ words: location, pin: homePin }}
            onPick={(home) => {
              setLocation(home.words)
              setHomePin(home.pin)
              setMapOpen(false)
            }}
            onClose={() => setMapOpen(false)}
          />
        ) : null}
        <div data-qualifications-still-needs="" style={{ fontSize: '0.8rem', color: qualificationsComplete(quals) ? 'var(--text-green-800)' : 'var(--text-muted)' }}>
          {qualificationsComplete(quals) ? 'Noted. Every trade, the license and where they drive in from.' : `Still needed: ${missing.join(', ')}.`}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Btn kind="plain" onClick={onClose} disabled={busy}>
            Not now
          </Btn>
          <Btn kind="primary" onClick={() => onSave(quals)} disabled={busy || !anything}>
            Save their qualifications
          </Btn>
        </div>
      </div>
    </div>
  )
}
