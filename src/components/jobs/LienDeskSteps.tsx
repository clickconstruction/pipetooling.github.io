import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { LIEN_STEP_CARD_GAP_PX, lienStepCardOver } from '../../lib/jobs/lienStepCardPlace'
import { lienStepTiles, type LienStepAt, type LienStepCard, type LienStepLadder } from '../../lib/jobs/lienNextUpSteps'
import { LIEN_REMINDER_SCHEDULE, LIEN_SCHEDULE_AXIS_DAYS, LIEN_SCHEDULE_TAIL, lienScheduleMarks, lienSchedulePct, lienScheduleWords } from '../../lib/jobs/lienReminderSchedule'

/**
 * The To do list's steps, drawn (v2.4631): the four dots and the fraction a row wears, and the
 * card that opens on the dots — the row's ladder written out — with the schedule strip § Rules
 * draws. The rail of rungs above the rows and the brief a pressed rung opened gave their place
 * to the Board in v2.7332 and left the code in v2.7451. The words all come from
 * `lienNextUpSteps.ts`; nothing here reads or writes.
 */

const LADDER_TONE: Record<LienStepLadder, { fg: string; tint: string }> = {
  notice: { fg: 'var(--text-blue-700)', tint: 'var(--bg-blue-tint)' },
  // Between the notices' blue and the affidavits' red (punch list #262).
  reminder: { fg: 'var(--text-violet-700)', tint: 'var(--bg-violet-tint)' },
  affidavit: { fg: 'var(--text-red-700)', tint: 'var(--bg-red-tint)' },
  retainage: { fg: 'var(--text-amber-800)', tint: 'var(--bg-amber-tint)' },
}

/**
 * Our schedule after a notice as a strip (v2.6574): the day axis from the packet, four weeks long,
 * with the clocks' points on it — a courtesy may go, letter two due, letter two overdue — and the
 * tail the affidavit's day sets. `marks` are the notices' own days, one dot per day with its count,
 * so the strip reads "you are here"; without them it is the schedule alone, as § Rules draws it.
 */
export function LienReminderScheduleStrip({ marks = [], isMobile, tone = 'var(--text-violet-700)', tint = 'var(--bg-violet-tint)' }: { marks?: ReadonlyArray<number | null | undefined>; isMobile: boolean; tone?: string; tint?: string }) {
  const dots = lienScheduleMarks(marks)
  const axisTicks = [0, 7, 14, 21, LIEN_SCHEDULE_AXIS_DAYS]
  return (
    <div data-testid="lien-schedule-strip" title={lienScheduleWords()} style={{ display: 'grid', gap: 4 }}>
      <div style={{ position: 'relative', height: 34, marginTop: dots.length ? 14 : 0 }}>
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 18, height: 2, background: 'var(--border-strong)' }} />
        {axisTicks.map((d) => (
          <span key={`t${d}`} aria-hidden style={{ position: 'absolute', left: `${lienSchedulePct(d)}%`, top: 14, width: 1, height: 10, background: 'var(--border-strong)', transform: 'translateX(-50%)' }} />
        ))}
        {LIEN_REMINDER_SCHEDULE.map((p) => (
          <span key={p.day} data-lien-schedule-point={p.day} style={{ position: 'absolute', left: `${lienSchedulePct(p.day)}%`, top: 12, transform: p.day === 0 ? 'none' : 'translateX(-50%)', display: 'grid', justifyItems: p.day === 0 ? 'start' : 'center', gap: 2, fontSize: '0.7rem', lineHeight: 1.15, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <i style={{ width: 10, height: 10, borderRadius: 999, border: `2px solid ${tone}`, background: 'var(--surface)', boxSizing: 'border-box' }} />
            <strong style={{ color: 'var(--text-700)' }}>day {p.day}</strong>
          </span>
        ))}
        {dots.map((m) => (
          <span key={`m${m.day}`} data-lien-schedule-mark={m.day} title={`${m.n} ${m.n === 1 ? 'notice' : 'notices'} at day ${m.day}`} style={{ position: 'absolute', left: `${m.pct}%`, top: -12, transform: m.past ? 'translateX(-100%)' : 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 6px', borderRadius: 999, background: tint, color: tone, border: `1px solid ${tone}`, fontSize: '0.68rem', fontWeight: 700, lineHeight: '14px', whiteSpace: 'nowrap' }}>
            {m.n > 1 ? `${m.n} · ` : ''}day {m.day}{m.past ? '+' : ''}
          </span>
        ))}
      </div>
      {/* The points' words read under the axis, not beside the dots: day 7, 10 and 14 sit too close for a label each. */}
      {isMobile ? (
        <ul style={{ margin: 0, padding: '0 0 0 1rem', fontSize: '0.74rem', color: 'var(--text-muted)', display: 'grid', gap: 1 }}>
          {LIEN_REMINDER_SCHEDULE.map((p) => (
            <li key={p.day}><strong style={{ color: 'var(--text-700)' }}>day {p.day}</strong> {p.label}</li>
          ))}
          {LIEN_SCHEDULE_TAIL.map((t) => (
            <li key={t.label}>{t.label}</li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'grid', gap: 2 }}>
          <div style={{ display: 'flex', gap: '0.35rem 0.9rem', flexWrap: 'wrap' }}>
            {LIEN_REMINDER_SCHEDULE.map((p) => (
              <span key={p.day}><strong style={{ color: 'var(--text-700)' }}>day {p.day}</strong> {p.label}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ padding: '0 6px', borderRadius: 4, background: tint, color: 'var(--text-700)' }}>then</span>
            <span>{LIEN_SCHEDULE_TAIL.map((t) => t.label).join(' · ')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** The four dots and the fraction a row wears; hover, focus or a tap opens the card. */
export function LienStepMark({ at, ladder, card, isMobile, onShow, onHide, compact = false }: { at: LienStepAt | null; ladder: LienStepLadder; card: LienStepCard; isMobile: boolean; onShow: (el: HTMLElement, card: LienStepCard) => void; onHide: () => void; /** The dots alone, with no fraction beside them: a phone's row, where the press beside them needs the room (punch list #352, PR 3). */ compact?: boolean }) {
  const tone = LADDER_TONE[ladder]
  const step = at?.step ?? 0
  return (
    <button
      type="button"
      className="lienStepMark"
      data-testid="lien-step-mark"
      aria-label={at ? `Step ${step} of 4: where this stands` : `${card.foot}: where this stands`}
      onMouseEnter={isMobile ? undefined : (e) => onShow(e.currentTarget, card)}
      onMouseLeave={isMobile ? undefined : onHide}
      onFocus={(e) => onShow(e.currentTarget, card)}
      onBlur={onHide}
      onClick={(e) => {
        e.stopPropagation()
        onShow(e.currentTarget, card)
      }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '2px 4px', margin: '-2px -4px', borderRadius: 5, font: 'inherit', color: tone.fg, cursor: 'default', minHeight: isMobile ? 40 : undefined }}
    >
      <span aria-hidden style={{ display: 'inline-flex', gap: 4 }}>
        {[1, 2, 3, 4].map((n) => (
          <i key={n} style={{ width: 7, height: 7, borderRadius: 999, display: 'inline-block', background: n <= step ? tone.fg : 'var(--border-strong)' }} />
        ))}
      </span>
      {compact && at ? null : <span style={{ fontSize: '0.72rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{at ? `${step}/4` : '—'}</span>}
    </button>
  )
}

/**
 * The row's ladder written out: four steps, the done ones ticked, the one it stands on lit. The card on the dots draws
 * it, and so does a job's own screen on a phone (punch list #352, PR 4), where `roomy` sets it in a size a thumb reads.
 */
export function LienStepCardItems({ card, roomy = false }: { card: LienStepCard; roomy?: boolean }) {
  const tone = LADDER_TONE[card.ladder]
  const dot = roomy ? 24 : 18
  return (
    <ol data-roomy={roomy ? 'yes' : undefined} style={{ listStyle: 'none', margin: roomy ? 0 : '10px 0 0', padding: 0, display: 'grid' }}>
      {card.items.map((it, i) => (
        <li key={i} data-testid="lien-step-card-item" data-state={it.state} style={{ display: 'grid', gridTemplateColumns: `${dot + 2}px 1fr`, gap: roomy ? 10 : 8, alignItems: 'start', padding: roomy ? '7px 0' : '5px 0' }}>
          <span
            aria-hidden
            style={{
              width: dot,
              height: dot,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              fontSize: roomy ? '0.8rem' : '0.66rem',
              fontWeight: 700,
              border: `1.5px solid ${it.state === 'done' ? '#15803d' : it.state === 'now' ? tone.fg : 'var(--border-strong)'}`,
              background: it.state === 'done' ? '#15803d' : 'var(--surface)',
              color: it.state === 'done' ? '#fff' : it.state === 'now' ? tone.fg : 'var(--text-muted)',
              boxShadow: it.state === 'now' ? `0 0 0 3px ${tone.tint}` : 'none',
            }}
          >
            {it.state === 'done' ? '✓' : i + 1}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: roomy ? '1rem' : '0.84rem', fontWeight: it.state === 'todo' ? 500 : 600, color: it.state === 'todo' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{it.title}</span>
            <span style={{ display: 'block', fontSize: roomy ? '0.875rem' : '0.76rem', color: it.state === 'now' ? 'var(--text-700)' : 'var(--text-muted)' }}>{it.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Where the card sits: beside the dots on a computer, a sheet from the bottom on a phone. `top` is the card's top
 * when it stands under its mark. `mark` is what lets it stand over the mark instead (v2.7425): the mark's own top in
 * the list's box, and the room the screen leaves under and over it.
 */
export type LienStepCardPlace = { top: number; left: number; mark?: { top: number; under: number; over: number } } | 'sheet'

export function LienStepCardView({ card, place, onClose, onMouseEnter, onMouseLeave, children }: { card: LienStepCard; place: LienStepCardPlace; onClose: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void; children?: ReactNode }) {
  const tone = LADDER_TONE[card.ladder]
  const closeRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (place === 'sheet') closeRef.current?.focus()
  }, [place])
  // Beside a row low on the screen the card stands over the row (v2.7425): it always opened under, so there it
  // opened below the fold. Drawn hidden where it was, measured before the paint, then shown on the side that holds it.
  const besideRef = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (place !== 'sheet') setHeight(besideRef.current?.offsetHeight ?? 0)
  }, [card, place])
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-block', padding: '0 7px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700, lineHeight: '18px', background: tone.tint, color: tone.fg }}>{card.kindWords}</span>
        <strong style={{ fontSize: '0.9rem' }} data-testid="lien-step-card-title">{card.title}</strong>
        {place === 'sheet' ? (
          <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '0 4px', lineHeight: 1 }}>
            ×
          </button>
        ) : null}
      </div>
      <div data-testid="lien-step-card-deadline" style={{ fontSize: '0.78rem', fontWeight: 600, marginTop: 2, color: card.tone === 'red' ? 'var(--text-red-600)' : card.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
        {card.deadline}
      </div>
      <LienStepCardItems card={card} />
      {card.blocked ? (
        <div data-testid="lien-step-card-blocked" style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-amber-800)' }}>
          <strong>Blocked by:</strong> {card.blocked}
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
        <span data-testid="lien-step-card-foot">{card.foot}</span>
        {children}
      </div>
    </>
  )
  if (place === 'sheet') {
    return (
      <div role="dialog" aria-modal="true" aria-label="Where this stands" data-testid="lien-step-card" data-place="sheet" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', zIndex: 95, background: 'var(--surface)', borderTop: '1px solid var(--border-strong)', borderRadius: '12px 12px 0 0', boxShadow: '0 -8px 30px rgba(0,0,0,0.35)', padding: '12px 14px calc(12px + env(safe-area-inset-bottom, 0px))', maxHeight: '70dvh', overflow: 'auto' }}>
        {body}
      </div>
    )
  }
  const over = Boolean(place.mark) && lienStepCardOver({ height: height ?? 0, under: place.mark!.under, over: place.mark!.over })
  const top = over ? place.mark!.top - LIEN_STEP_CARD_GAP_PX - (height ?? 0) : place.top
  return (
    <div ref={besideRef} role="tooltip" data-testid="lien-step-card" data-place="beside" data-side={over ? 'over' : 'under'} onClick={(e) => e.stopPropagation()} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{ position: 'absolute', top, left: place.left, visibility: height == null ? 'hidden' : 'visible', zIndex: 5, width: 'min(340px, calc(100vw - 32px))', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 14px 40px rgba(0,0,0,0.35)', padding: '12px 14px' }}>
      {body}
    </div>
  )
}

/** What shows `el`: the screen, cut to the nearest box around it that scrolls up and down. */
function scrollerBox(el: HTMLElement): { top: number; bottom: number } {
  const screen = { top: 0, bottom: typeof window === 'undefined' ? 0 : window.innerHeight }
  let up: HTMLElement | null = el.parentElement
  while (up && up !== document.body && up !== document.documentElement) {
    const flow = getComputedStyle(up).overflowY
    if (flow === 'auto' || flow === 'scroll') {
      const box = up.getBoundingClientRect()
      return { top: Math.max(screen.top, box.top), bottom: Math.min(screen.bottom, box.bottom) }
    }
    up = up.parentElement
  }
  return screen
}

/** The card's state for a list: which card is open and where, with the hover's grace so the pointer can cross onto it. */
export function useLienStepCard(isMobile: boolean) {
  const [open, setOpen] = useState<{ card: LienStepCard; place: LienStepCardPlace } | null>(null)
  const hideTimer = useRef<number | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const cancelHide = () => {
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    hideTimer.current = null
  }
  const show = (el: HTMLElement, card: LienStepCard) => {
    cancelHide()
    if (isMobile) {
      setOpen({ card, place: 'sheet' })
      return
    }
    const host = hostRef.current?.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const scrollTop = hostRef.current?.scrollTop ?? 0
    const top = host ? r.bottom - host.top + scrollTop + LIEN_STEP_CARD_GAP_PX : r.bottom + LIEN_STEP_CARD_GAP_PX
    const left = host ? Math.max(8, Math.min(r.left - host.left - 20, host.width - 356)) : r.left
    // The room the screen leaves on each side of the mark, inside the box that scrolls the list.
    const view = scrollerBox(el)
    const mark = { top: host ? r.top - host.top + scrollTop : r.top, under: view.bottom - r.bottom, over: r.top - view.top }
    setOpen({ card, place: { top, left, mark } })
  }
  const hide = () => {
    cancelHide()
    hideTimer.current = window.setTimeout(() => setOpen(null), 120)
  }
  const close = () => {
    cancelHide()
    setOpen(null)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  return { open, hostRef, show, hide, close, cancelHide }
}

/**
 * The four steps as four named tiles (v2.4881): a phone has no hover, so the names are the card.
 * Done steps ticked, the one the row stands on lit and saying whose it is. Nothing for a row past
 * the ladder.
 */
export function LienStepRow({ at, ladder, viewerIsLeader, onPress }: { at: LienStepAt | null; ladder: LienStepLadder; viewerIsLeader: boolean; /** A tap opens the step card (the To do rows' sheet); without it the row is words only. */ onPress?: (el: HTMLElement) => void }) {
  const tiles = lienStepTiles(at, ladder, viewerIsLeader)
  if (!tiles) return null
  const inner = tiles.map((t) => (
    <span key={t.n} className="lienStepTile" data-state={t.state} data-who={t.who ?? undefined}>
      <span className="lienStepTileMark" aria-hidden>{t.state === 'done' ? '✓' : t.state === 'now' ? t.who : '\u00a0'}</span>
      <span className="lienStepTileName">{t.label}</span>
    </span>
  ))
  if (onPress) {
    return (
      <button type="button" className="lienStepRow" data-testid="lien-step-row" data-ladder={ladder} aria-label={`Step ${at!.step} of 4: where this stands`} onClick={(e) => { e.stopPropagation(); onPress(e.currentTarget) }} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', width: '100%' }}>
        {inner}
      </button>
    )
  }
  return (
    <div className="lienStepRow" data-testid="lien-step-row" data-ladder={ladder} aria-label={`Step ${at!.step} of 4`}>
      {inner}
    </div>
  )
}
