/**
 * Paint a map: the start sheet (punch list #345). A name, what the map is for, and the press that
 * opens the map to draw on. Nothing is saved here: the map is made when its first line is.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { CostBatchJobPicker } from '../costBatches/CostBatchJobPicker'
import { PAINTED_MAP_NAME_MAX, PAINTED_MAP_UNNAMED, PAINTED_MAP_WORDS_MAX, cleanPaintedText } from '../../lib/paintedMap/paintedMap'
import { WALK_ASK_WORDS, WALK_BEFORE_WORDS } from '../../lib/paintedMap/paintedWalkWords'
import type { PaintedMapHome } from '../../lib/paintedMap/paintedMapDoor'
import { PAINTED_MAP_SHEET_Z } from '../../lib/windowLayers'
import type { PaintedMapToStart } from './PaintedMapWindow'

type Props = {
  home: PaintedMapHome
  onStart: (start: PaintedMapToStart) => void
  onClose: () => void
}

/** What a map is usually for: one press names it. */
const NAME_CHIPS = ['The way in', 'Where to park', 'What is where'] as const

const chip: CSSProperties = { minHeight: 36, padding: '0 0.8rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }
const chipOn: CSSProperties = { ...chip, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const field: CSSProperties = { minHeight: 44, padding: '0.5rem 0.6rem', fontSize: '1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box', width: '100%' }
const label: CSSProperties = { display: 'grid', gap: '0.3rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }

const quietPress: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.875rem', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', minHeight: 32, textAlign: 'left' }
const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export function PaintAMapStartSheet({ home: given, onStart, onClose }: Props) {
  // Opened from the header's search there is no job yet: the painter may pick one here, or paint first and put it on a job later.
  const homeless = !given.jobId && !given.developmentId
  const [picked, setPicked] = useState<{ jobId: string; label: string; address: string | null } | null>(null)
  const [picking, setPicking] = useState(false)
  const home: PaintedMapHome = picked ? { ...given, jobId: picked.jobId, label: picked.label, address: picked.address } : given
  const [name, setName] = useState('')
  const [words, setWords] = useState('')
  // A job in a development: the map is for the job unless the painter says it is for the whole site.
  const [forSite, setForSite] = useState(!home.jobId && !!home.developmentId)
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

  return createPortal(
    <div
      data-paint-a-map-start
      style={{ position: 'fixed', inset: 0, zIndex: PAINTED_MAP_SHEET_Z, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'env(safe-area-inset-top, 0px) 0 0' }}
      onClick={(e) => {
        // The window behind stays: this press closes the sheet alone.
        e.stopPropagation()
        onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Paint a map" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 520, maxHeight: '100%', overflowY: 'auto', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Paint a map</h2>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem' }}>
            Cancel
          </button>
        </div>
        <div style={{ display: 'grid', gap: '0.8rem', padding: '0.85rem 1rem calc(0.95rem + env(safe-area-inset-bottom, 0px))' }}>
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
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>For</span>
            {both ? (
              <div role="group" aria-label="For" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                <button type="button" aria-pressed={!forSite} style={forSite ? chip : chipOn} onClick={() => setForSite(false)}>
                  {home.label || 'This job'}
                </button>
                <button type="button" aria-pressed={forSite} style={forSite ? chipOn : chip} onClick={() => setForSite(true)}>
                  {home.developmentLabel ? `${home.developmentLabel}, every lot` : 'The whole development'}
                </button>
              </div>
            ) : home.jobId || home.developmentId ? (
              <span style={{ fontSize: '0.9375rem' }}>{(home.jobId ? home.label : home.developmentLabel) || (home.jobId ? 'This job' : 'This development')}</span>
            ) : (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>It is on no job yet. It stays yours and the office’s until it is put on one.</span>
            )}
            {homeless ? (
              picking ? (
                <div data-paint-a-map-job-pick style={{ display: 'grid', gap: '0.4rem' }}>
                  <CostBatchJobPicker
                    title="Which job is it for?"
                    autoFocus
                    onPick={(job) => {
                      setPicked({ jobId: job.id, label: [job.hcp_number, job.job_name].filter(Boolean).join(' · ') || 'The job', address: job.job_address || null })
                      setPicking(false)
                    }}
                  />
                  <button type="button" style={quietPress} onClick={() => setPicking(false)}>
                    Leave it on no job
                  </button>
                </div>
              ) : (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem' }}>
                  <button type="button" data-paint-a-map-pick-job style={quietPress} onClick={() => setPicking(true)}>
                    {picked ? 'Pick another job' : 'Pick the job it is for'}
                  </button>
                  {picked ? (
                    <button type="button" style={quietPress} onClick={() => setPicked(null)}>
                      Leave it on no job
                    </button>
                  ) : null}
                </span>
              )
            ) : null}
            {both && forSite ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>It will show on every job in the development.</span> : null}
          </div>
          {canWalk ? (
            <div data-paint-a-map-walk-box style={{ display: 'grid', gap: '0.45rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.6rem 0.7rem' }}>
              <button type="button" data-paint-a-map-walk onClick={() => start('walk')} style={{ minHeight: 52, borderRadius: 8, border: '1px solid #dc2626', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                Walk or drive it
              </button>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-700)', display: 'grid', gap: '0.15rem' }}>
                {WALK_BEFORE_WORDS.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{WALK_ASK_WORDS}</span>
            </div>
          ) : null}
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)', background: 'var(--bg-muted)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
            Or draw the line by hand on the view from above: press along the way, and each press is a corner. It needs no location, and it is the better way to get a length. The map is saved with its first line or place.
          </p>
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
  )
}
