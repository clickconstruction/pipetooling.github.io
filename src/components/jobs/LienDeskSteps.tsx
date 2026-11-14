import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LIEN_STEP_LADDERS, lienRunRungWords, lienStepName, lienStepTiles, type LienStepAt, type LienStepCard, type LienStepCounts, type LienStepLadder, type LienStepN } from '../../lib/jobs/lienNextUpSteps'
import { lienReminderRungWords, type LienReminderBrief } from '../../lib/jobs/lienReminders'
import { LIEN_REMINDER_SCHEDULE, LIEN_SCHEDULE_AXIS_DAYS, LIEN_SCHEDULE_TAIL, lienScheduleMarks, lienSchedulePct, lienScheduleWords } from '../../lib/jobs/lienReminderSchedule'
import type { LienTimelineRow } from '../../lib/jobs/lienNoticeTimeline'
import { lienStepFoldWords, lienStepRailsShown } from '../../lib/jobs/lienStepFold'
import { LienNoticeTimeline } from './LienNoticeTimeline'

/**
 * The Do now list's steps, drawn (v2.4631): the rail of four rungs per kind of paper above the
 * rows, each rung with its count, a press narrowing the list to that rung; the four dots and
 * the fraction a row wears; and the card that opens on the dots — the row's ladder written
 * out. The words all come from `lienNextUpSteps.ts`; nothing here reads or writes.
 */

const LADDER_TONE: Record<LienStepLadder, { fg: string; tint: string }> = {
  notice: { fg: 'var(--text-blue-700)', tint: 'var(--bg-blue-tint)' },
  // Between the notices' blue and the affidavits' red (punch list #262).
  reminder: { fg: 'var(--text-violet-700)', tint: 'var(--bg-violet-tint)' },
  affidavit: { fg: 'var(--text-red-700)', tint: 'var(--bg-red-tint)' },
  retainage: { fg: 'var(--text-amber-800)', tint: 'var(--bg-amber-tint)' },
}

const railHead: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }

export function LienStepRail({
  counts,
  ladders,
  on,
  isMobile,
  onPick,
  onOpenRun,
  viewerIsLeader,
  printed,
  reminderWaiting,
  reminderScheduled,
}: {
  counts: LienStepCounts
  ladders: ReadonlyArray<LienStepLadder>
  /** The rung the list is narrowed to, or null. */
  on: LienStepAt | null
  isMobile: boolean
  onPick: (at: LienStepAt | null) => void
  /** The notice ladder's fourth rung is the run itself: pressing it opens the run when the desk hands this over. */
  onOpenRun?: () => void
  /** The leader's rung wears *you*. */
  viewerIsLeader?: boolean
  /** Of the run rung's count, how many printed and wait on their tracking numbers (punch list #101). */
  printed?: Partial<Record<LienStepLadder, number>>
  /** Sent notices before day 7 (punch list #262): on the REMINDERS ladder's first rung but not in its count. */
  reminderWaiting?: number
  /** Sent notices past day 7 waiting for reminders week of the lien's month (punch list #235, PR 4): on the first rung, not in its count. */
  reminderScheduled?: number
}) {
  // On a phone the rails are one row that unfolds in place (punch list #352, PR 2); a pressed step keeps them open.
  const [unfolded, setUnfolded] = useState(false)
  const shown = lienStepRailsShown({ isMobile, unfolded, stepPressed: on != null })
  const fold = lienStepFoldWords(ladders.map((key) => LIEN_STEP_LADDERS.find((l) => l.key === key)!.label), shown)
  return (
    <div data-testid="lien-step-rails" data-folded={isMobile ? (shown ? 'no' : 'yes') : undefined} style={{ display: 'grid', gap: 8, marginBottom: '0.9rem' }}>
      {isMobile ? (
        <button
          type="button"
          data-testid="lien-step-rails-fold"
          aria-expanded={shown}
          onClick={() => {
            // Hiding the steps also lets go of a pressed one, or the rails would stay open on it.
            if (shown && on != null) onPick(null)
            setUnfolded(!shown)
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, padding: '0 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}
        >
          <span style={{ flex: 'none' }}>{fold.label}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{fold.hint}</span>
          <span aria-hidden style={{ flex: 'none', color: 'var(--text-muted)' }}>{shown ? '▴' : '▾'}</span>
        </button>
      ) : null}
      {!shown ? null : ladders.map((key) => {
        const ladder = LIEN_STEP_LADDERS.find((l) => l.key === key)!
        const tone = LADDER_TONE[key]
        return (
          <div key={key} data-testid={`lien-step-rail-${key}`} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '84px 1fr', gap: isMobile ? 4 : 10, alignItems: 'center' }}>
            <span style={railHead}>{ladder.label}</span>
            <div role="group" aria-label={`The ${key === 'affidavit' ? 'affidavit' : key === 'reminder' ? 'reminder' : 'notice'}'s four steps`} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', border: '1px solid var(--border-strong)', borderRadius: 9, overflow: 'hidden' }}>
              {ladder.steps.map((label, i) => {
                const step = (i + 1) as LienStepN
                const n = counts[key][i] ?? 0
                const isOn = on?.ladder === key && on.step === step
                const isRun = (key === 'notice' || key === 'retainage') && step === 4 && onOpenRun
                const empty = n === 0
                return (
                  <button
                    key={step}
                    type="button"
                    aria-pressed={isOn}
                    data-testid={`lien-step-${key}-${step}`}
                    onClick={() => (isRun && n > 0 ? onOpenRun() : onPick(isOn ? null : { ladder: key, step }))}
                    title={isRun ? 'Open the run' : isOn ? 'Show every row again' : `Show only the rows at this step`}
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: isMobile ? '7px 10px' : '5px 10px',
                      border: 'none',
                      borderRight: !isMobile && i < 3 ? '1px solid var(--border-strong)' : 'none',
                      borderBottom: isMobile && i < 3 ? '1px solid var(--border-strong)' : 'none',
                      background: isOn ? tone.tint : 'var(--surface)',
                      boxShadow: isOn ? `inset 0 -2px 0 ${tone.fg}` : 'none',
                      color: empty ? 'var(--text-muted)' : 'var(--text-strong)',
                      font: 'inherit',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{ width: 18, height: 18, borderRadius: 999, border: `1.5px solid ${empty ? 'var(--border-strong)' : tone.fg}`, color: empty ? 'var(--text-muted)' : tone.fg, display: 'inline-grid', placeItems: 'center', fontSize: '0.68rem', fontWeight: 700, flex: 'none' }}
                    >
                      {step}
                    </span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                    {key !== 'affidavit' && step === 3 && viewerIsLeader ? <span style={{ fontSize: '0.62rem', padding: '0 6px', borderRadius: 999, background: '#fbbf24', color: '#1a1200', fontWeight: 700, flex: 'none' }}>you</span> : null}
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', color: empty ? 'var(--text-muted)' : 'var(--text-strong)', opacity: empty ? 0.6 : 1, flex: 'none' }} data-testid={`lien-step-count-${key}-${step}`}>
                      {n}
                      {isRun && n > 0 ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{lienRunRungWords(n, printed?.[key] ?? 0)}</span> : null}
                      {key === 'reminder' ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{lienReminderRungWords(step, reminderWaiting ?? 0, reminderScheduled ?? 0)}</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
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

/**
 * The step brief a pressed rung opens (v2.6574, Grace's ask of 2026-11-06): what the step is, why
 * a notice is here, the usual move and whose, the other moves allowed, what closes it by itself —
 * the schedule strip across the top on the REMINDERS rail — and *Every step*, which clears the rung
 * as a second press on it does. Until v2.6574 a pressed rung faded the rows off it and a line said
 * so; the brief teaches the step instead, and the list below is sorted, not dimmed. On a rail that
 * had no brief yet (v2.6574) the head and the count still read; since v2.6577 every rail has one.
 */
export type LienStepBriefTimeline = { rows: ReadonlyArray<LienTimelineRow>; options: ReadonlyArray<{ jobId: string; title: string }>; picked: string; onPick: (jobId: string) => void }

export function LienStepBrief({ on, brief, count, marks, timeline, whyChips, isMobile, onClear, children }: { on: LienStepAt; brief: LienReminderBrief | null; count: number; marks?: ReadonlyArray<number | null | undefined>; /** One notice's dated timeline (PR 2 of #274); without it the REMINDERS rail draws the schedule strip. */ timeline?: LienStepBriefTimeline | null; /** Why these N are here, as counts. */ whyChips?: ReadonlyArray<{ why: string; n: number }>; isMobile: boolean; onClear: () => void; children?: ReactNode }) {
  const tone = LADDER_TONE[on.ladder]
  const k: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }
  const words: CSSProperties = { fontSize: '0.8125rem', lineHeight: 1.45, color: 'var(--text-700)', margin: 0 }
  const whoWords = brief ? (brief.who === 'leader' ? 'the leader’s step' : 'the office’s step') : ''
  const paper = on.ladder === 'affidavit' ? 'affidavit' : 'notice'
  const where = on.ladder === 'reminder' ? 'on the row or on the notice’s footer under Sent' : `on the row or on the ${paper}’s pane`
  return (
    <div data-testid="lien-step-brief" data-ladder={on.ladder} data-step={on.step} style={{ margin: isMobile ? '-4px 0 14px' : `-6px 0 14px calc(84px + 10px)`, borderLeft: `3px solid ${tone.fg}`, background: tone.tint, borderRadius: '0 10px 10px 0', padding: isMobile ? '10px 12px' : '12px 16px', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.95rem' }} data-testid="lien-step-brief-title">{lienStepName(on)}</strong>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="lien-step-brief-count">{whoWords ? `${whoWords} · ` : ''}{count} {on.ladder === 'affidavit' ? (count === 1 ? 'affidavit' : 'affidavits') : count === 1 ? 'notice' : 'notices'} here</span>
        <button type="button" onClick={onClear} data-testid="lien-step-brief-clear" style={{ marginLeft: isMobile ? 0 : 'auto', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '2px 10px', borderRadius: 999, border: `1px solid ${tone.fg}`, background: 'var(--surface)', color: tone.fg, cursor: 'pointer', minHeight: isMobile ? 32 : undefined }}>
          Every step
        </button>
      </div>
      {brief ? <div><div style={k}>In plain words</div><p style={{ ...words, fontSize: '0.875rem', maxWidth: '76ch' }} data-testid="lien-step-brief-plain">{brief.plain}</p></div> : null}
      {on.ladder === 'reminder' && timeline && timeline.rows.length ? (
        <LienNoticeTimeline rows={timeline.rows} isMobile={isMobile} tone={tone.fg} picker={{ options: timeline.options, picked: timeline.picked, onPick: timeline.onPick }} action={brief?.usual ? { press: brief.usual.press, who: brief.who, means: brief.usual.means, instead: brief.instead.slice(0, 2) } : null} />
      ) : on.ladder === 'reminder' ? (
        <LienReminderScheduleStrip marks={marks} isMobile={isMobile} tone={tone.fg} tint={tone.tint} />
      ) : null}
      {brief ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: isMobile ? 8 : '10px 24px' }}>
            <div>
              <div style={k}>What to do now</div>
              {brief.usual ? (
                <p style={words} data-testid="lien-step-brief-usual"><strong>{brief.usual.press}</strong> · {brief.who === 'leader' ? 'the leader presses it' : 'the office presses it'} · {brief.usual.means}</p>
              ) : (
                <p style={words} data-testid="lien-step-brief-usual">Nothing. This one needs nobody.</p>
              )}
            </div>
            <div>
              <div style={k}>Why {whyChips && whyChips.length ? `these ${count === 1 ? 'one is' : `${count} are`}` : paper === 'affidavit' ? 'an affidavit is' : 'a notice is'} here</div>
              {whyChips && whyChips.length ? (
                <div data-testid="lien-step-brief-why" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  {whyChips.map((c) => (
                    <span key={c.why} style={{ fontSize: '0.78rem', padding: '2px 9px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-strong)' }}><strong style={{ color: tone.fg }}>{c.n}</strong> · {c.why}</span>
                  ))}
                </div>
              ) : null}
              <p style={{ ...words, color: whyChips && whyChips.length ? 'var(--text-muted)' : undefined }}>{brief.why}</p>
            </div>
            <div>
              <div style={k}>If that is not right</div>
              <div data-testid="lien-step-brief-instead" style={{ display: 'grid', gap: 3 }}>
                {brief.instead.map((m) => (
                  <p key={m.press} style={words}><strong>{m.press}</strong> <span style={{ color: 'var(--text-muted)' }}>· {m.means}</span></p>
                ))}
              </div>
              <p style={{ ...words, color: 'var(--text-muted)', marginTop: 4 }}>Each press sits {where}.</p>
            </div>
            <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
              {brief.closes ? <div><div style={k}>This step ends on its own when</div><p style={words}>{brief.closes[0]!.toUpperCase()}{brief.closes.slice(1)}.</p></div> : null}
              <div><div style={k}>If nobody acts</div><p style={words} data-testid="lien-step-brief-nobody">{brief.ifNobody}</p></div>
            </div>
          </div>
        </div>
      ) : null}
      {children}
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

/** Where the card sits: beside the dots on a computer, a sheet from the bottom on a phone. */
export type LienStepCardPlace = { top: number; left: number } | 'sheet'

export function LienStepCardView({ card, place, onClose, onMouseEnter, onMouseLeave, children }: { card: LienStepCard; place: LienStepCardPlace; onClose: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void; children?: ReactNode }) {
  const tone = LADDER_TONE[card.ladder]
  const closeRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (place === 'sheet') closeRef.current?.focus()
  }, [place])
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
      <ol style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid' }}>
        {card.items.map((it, i) => (
          <li key={i} data-testid="lien-step-card-item" data-state={it.state} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, alignItems: 'start', padding: '5px 0' }}>
            <span
              aria-hidden
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                fontSize: '0.66rem',
                fontWeight: 700,
                border: `1.5px solid ${it.state === 'done' ? '#16a34a' : it.state === 'now' ? tone.fg : 'var(--border-strong)'}`,
                background: it.state === 'done' ? '#16a34a' : 'var(--surface)',
                color: it.state === 'done' ? '#fff' : it.state === 'now' ? tone.fg : 'var(--text-muted)',
                boxShadow: it.state === 'now' ? `0 0 0 3px ${tone.tint}` : 'none',
              }}
            >
              {it.state === 'done' ? '✓' : i + 1}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.84rem', fontWeight: it.state === 'todo' ? 500 : 600, color: it.state === 'todo' ? 'var(--text-muted)' : 'var(--text-strong)' }}>{it.title}</span>
              <span style={{ display: 'block', fontSize: '0.76rem', color: it.state === 'now' ? 'var(--text-700)' : 'var(--text-muted)' }}>{it.detail}</span>
            </span>
          </li>
        ))}
      </ol>
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
  return (
    <div role="tooltip" data-testid="lien-step-card" data-place="beside" onClick={(e) => e.stopPropagation()} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{ position: 'absolute', top: place.top, left: place.left, zIndex: 5, width: 'min(340px, calc(100vw - 32px))', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 14px 40px rgba(0,0,0,0.35)', padding: '12px 14px' }}>
      {body}
    </div>
  )
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
    const top = host ? r.bottom - host.top + scrollTop + 6 : r.bottom + 6
    const left = host ? Math.max(8, Math.min(r.left - host.left - 20, host.width - 356)) : r.left
    setOpen({ card, place: { top, left } })
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
export function LienStepRow({ at, ladder, viewerIsLeader, onPress }: { at: LienStepAt | null; ladder: LienStepLadder; viewerIsLeader: boolean; /** A tap opens the step card (the Do now rows' sheet); without it the row is words only. */ onPress?: (el: HTMLElement) => void }) {
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
