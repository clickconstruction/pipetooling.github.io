import { useEffect, useRef, type CSSProperties } from 'react'
import type { MapTime } from '../../hooks/useMapTime'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  MAP_TIME_EARTH_PRESS,
  MAP_TIME_NEWER_PRESS,
  MAP_TIME_NO_SPOT_WORDS,
  MAP_TIME_OLDER_PRESS,
  MAP_TIME_TODAY_PRESS,
  mapTimeCaption,
} from '../../lib/map/mapTime'
import { OLDER_PHOTOS_DAYS_WORDS, OLDER_PHOTOS_EARTH_PRESS, OLDER_PHOTOS_EARTH_WORDS, OLDER_PHOTOS_LOOKING_WORDS, googleEarthUrl } from '../../lib/map/olderPhotos'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import OfflineRetryPanel from '../OfflineRetryPanel'

const words: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }
const link: CSSProperties = { flex: 'none', alignSelf: 'center', background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontSize: '0.75rem', fontFamily: 'inherit', whiteSpace: 'nowrap' }

function chip(on: boolean, isMobile: boolean): CSSProperties {
  return {
    flex: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'inherit',
    fontSize: isMobile ? '0.8125rem' : '0.75rem',
    fontWeight: 600,
    borderRadius: 8,
    minHeight: isMobile ? 36 : 28,
    padding: isMobile ? '3px 11px' : '3px 9px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    border: `1px solid ${on ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: on ? 'var(--text-strong)' : 'var(--surface)',
    color: on ? 'var(--surface)' : 'var(--text-strong)',
  }
}

function stepPress(dead: boolean): CSSProperties {
  return { ...chip(false, false), padding: '3px 8px', ...(dead ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : {}) }
}

/**
 * The second row of a map with a Time press (punch list #395): the dates the archive has for the
 * spot, oldest on the left, with **Today** held at the right end. It draws nothing while Time is off.
 *
 * It is one line whatever the archive holds. Thirty dates slide sideways and the row opens at its
 * newest end, so the date nearest today is in reach first. The sentence over it says what is on
 * show: the day the photograph was taken, and that the dots on the map are not from that day.
 *
 * It sits under the map and never on it: the map's own edges hold its zoom buttons and the
 * archive's credit, which has to stay readable.
 */
export function MapTimeRow({ time, isMobile, surface, dotsWords }: { time: MapTime; isMobile: boolean; surface: string; dotsWords?: string }) {
  const scroll = useRef<HTMLDivElement | null>(null)
  const { on, spot, photos, older, shown } = time
  const olderCount = older.length
  const shownRelease = shown?.release ?? null

  // The row opens at its newest end, stays there as older dates come in, and keeps the date on show in view.
  useEffect(() => {
    const el = scroll.current
    if (!el) return
    const lit = shownRelease == null ? null : el.querySelector<HTMLElement>('button[aria-pressed="true"]')
    if (!lit) {
      el.scrollLeft = el.scrollWidth
      return
    }
    const left = lit.offsetLeft
    const right = left + lit.offsetWidth
    if (left < el.scrollLeft + 16) el.scrollLeft = left - 40
    else if (right > el.scrollLeft + el.clientWidth - 16) el.scrollLeft = right - el.clientWidth + 40
  }, [on, shownRelease, olderCount])

  if (!on) return null
  if (!spot) {
    return (
      <div data-map-time-row className="mapTimeRow">
        <div className="mapTimeRowBody">
          <p data-map-time-caption role="status" style={words}>
            {MAP_TIME_NO_SPOT_WORDS}
          </p>
        </div>
      </div>
    )
  }

  const walking = photos.looking === 'walk'
  const steps = !isMobile && olderCount > 0
  return (
    <div data-map-time-row className="mapTimeRow">
      <div className="mapTimeRowBody">
        <div className="mapTimeRowWords">
          {photos.failure ? (
            <OfflineRetryPanel failure={photos.failure} onRetry={photos.retry} surface={`${surface}-time`} idempotent busy={photos.looking != null} style={{ margin: 0 }} />
          ) : (
            <p data-map-time-caption style={words}>
              {mapTimeCaption({ spotName: spot.name, today: time.today, olderCount, shown, walking, dotsWords })}
            </p>
          )}
          {/* A date whose own sentence already says its day is being found needs no second line. */}
          {photos.looking && !(shown?.asking && !walking) ? (
            <span role="status" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {walking ? OLDER_PHOTOS_LOOKING_WORDS : OLDER_PHOTOS_DAYS_WORDS}
            </span>
          ) : null}
          {!photos.looking && !photos.failure && olderCount === 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" style={{ ...link, padding: 0, fontSize: '0.8125rem' }} onClick={() => openInExternalBrowser(googleEarthUrl(spot))}>
                {OLDER_PHOTOS_EARTH_PRESS}
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{OLDER_PHOTOS_EARTH_WORDS}</span>
            </span>
          ) : null}
        </div>
        <div className="mapTimeRowLine">
          {steps ? (
            <button type="button" aria-label={MAP_TIME_OLDER_PRESS} title={MAP_TIME_OLDER_PRESS} disabled={!time.canStep(-1)} style={stepPress(!time.canStep(-1))} onClick={() => time.step(-1)}>
              ‹
            </button>
          ) : null}
          <div ref={scroll} role="group" aria-label="Photo dates" className="mapTimeScroll">
            {olderCount > 0 ? (
              <button type="button" style={link} title={`${OLDER_PHOTOS_EARTH_PRESS}. ${OLDER_PHOTOS_EARTH_WORDS}`} onClick={() => openInExternalBrowser(googleEarthUrl(spot))}>
                {MAP_TIME_EARTH_PRESS}
              </button>
            ) : null}
            {older.map((c) => (
              <button key={c.release} type="button" aria-pressed={shown === c} title={c.caption} style={chip(shown === c, isMobile)} onClick={() => time.pickDate(c)}>
                {c.label}
              </button>
            ))}
          </div>
          {steps ? (
            <button type="button" aria-label={MAP_TIME_NEWER_PRESS} title={MAP_TIME_NEWER_PRESS} disabled={!time.canStep(1)} style={stepPress(!time.canStep(1))} onClick={() => time.step(1)}>
              ›
            </button>
          ) : null}
          <button type="button" data-map-time-today aria-pressed={time.imagery == null} style={{ ...chip(time.imagery == null, isMobile), fontWeight: 700 }} onClick={time.pickToday}>
            {MAP_TIME_TODAY_PRESS}
          </button>
        </div>
      </div>
    </div>
  )
}
