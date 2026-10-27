/**
 * To-do #152 (v2.5803): the one Call button, wherever the app dials. It wears the site's own look (`style`,
 * `className`, its glyph) and takes its link and its words from `planCall`: `tel:` for anyone with no seat, as it
 * always was; for a seat holder on a phone, the first press opens the sheet with the two ways, **Call in Quo** and
 * **Call from my phone**, the pick is kept on that phone and the next press is one tap again; a ▾ beside the button
 * brings the sheet back, so the other way is always in sight. On a desk the ▾ opens the one-time words that make Quo
 * the computer's calling app. The sheet's rows are links: the tap that picks is the tap that dials.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCallThrough } from '../../hooks/useCallThrough'
import type { Mailbox } from '../../lib/messages/boxes'
import { DIAL_WORDS, planCall, type CallPlan, type CallThrough, type CallWay } from '../../lib/quo/dial'
import { recordCallPressed } from '../../lib/navClickViewer'
import ResponsiveModalShell from '../ResponsiveModalShell'

export interface CallButtonProps {
  number: string
  /** The person's name, for the sheet's title. */
  name?: string | null
  /** The button's verb: *Call*, *Call back*, *Call them*. */
  verb?: string
  /** The button's words in place of the verb, given what the press will do: the reply box prints the number too. */
  words?: (through: CallThrough, plain: string) => ReactNode
  /** 📞, ☎ or a drawn phone, before the words. */
  glyph?: ReactNode
  /** The box whose number the call shows as: the one the thread texts from. */
  box?: Mailbox
  style?: CSSProperties
  className?: string
  testId?: string
  /** The site the button sits on, for the ledger (v2.5904): `call_pressed{#surface=<site>}` on every dial. Left out on a public page. */
  site?: string
  /** A string, or the words given the button's plain words, so a glyph-only control still says *Call in Quo*. */
  ariaLabel?: string | ((plain: string) => string)
  title?: string | ((plain: string) => string)
  /** Above the window the button sits in, when it sits in one (the customer door is 1100). */
  zIndex?: number
}

export function CallButton({ number, name, verb = 'Call', words, glyph, box = 'team', style, className, testId, ariaLabel, title, zIndex = 1300, site }: CallButtonProps) {
  const { seat, phone, kept, fromFor, keep } = useCallThrough()
  /** v2.5904: one `call_pressed` row per dial, on the press that dials (the kept way, or a way picked on the sheet). */
  const noteCall = () => {
    if (site) recordCallPressed(site)
  }
  const plan = planCall({ number, from: fromFor(box), seat, phone, kept, verb })
  const [open, setOpen] = useState(false)
  const inner = (
    <>
      {glyph}
      {words ? words(plan.through, plan.words) : plan.words}
    </>
  )
  const split = plan.sheet !== null
  const mainStyle: CSSProperties | undefined =
    split && style ? { ...style, borderTopRightRadius: 0, borderBottomRightRadius: 0, ...(style.width ? { width: undefined, flex: 1, minWidth: 0 } : {}) } : style
  const label = typeof ariaLabel === 'function' ? ariaLabel(plan.words) : ariaLabel
  const tip = typeof title === 'function' ? title(plan.words) : title
  const main = plan.href ? (
    <a href={plan.href} style={mainStyle} className={className} data-testid={testId} data-call-through={plan.through} aria-label={label} title={tip} onClick={noteCall}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={() => setOpen(true)} style={mainStyle} className={className} data-testid={testId} data-call-through="ask" aria-label={label} title={tip}>
      {inner}
    </button>
  )
  return (
    <>
      {split ? (
        <span style={{ display: 'inline-flex', alignItems: 'stretch', justifySelf: style?.justifySelf, width: style?.width }} data-call-split>
          {main}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={DIAL_WORDS.change}
            title={DIAL_WORDS.change}
            className={className}
            style={caretStyle(style)}
            data-testid={testId ? `${testId}-ways` : undefined}
          >
            ▾
          </button>
        </span>
      ) : (
        main
      )}
      {open && (
        <CallWaysSheet
          plan={plan}
          name={name}
          number={number}
          zIndex={zIndex}
          onPick={(way) => {
            keep(way.through)
            noteCall()
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** The ▾ in the button's own colours, joined to its right edge. */
function caretStyle(style: CSSProperties | undefined): CSSProperties {
  const base: CSSProperties = { font: 'inherit', border: 'none', cursor: 'pointer', lineHeight: 1 }
  if (!style) return { ...base, background: 'transparent', padding: '0 0.3rem' }
  const { background, color, fontSize, fontWeight, borderRadius, border } = style
  return {
    ...base,
    background,
    color,
    fontSize,
    fontWeight,
    border: border ?? 'none',
    borderLeft: background ? '1px solid rgba(255, 255, 255, 0.45)' : border ?? 'none',
    borderRadius,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    padding: '0 0.45rem',
  }
}

const wayRow: CSSProperties = {
  display: 'grid',
  gap: '0.2rem',
  padding: '0.75rem 0.9rem',
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--surface)',
  color: 'inherit',
  textDecoration: 'none',
  minHeight: 44,
}

const keptChip: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-green-700)',
  marginLeft: '0.5rem',
}

const quiet: CSSProperties = { margin: '0.75rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }

/**
 * The sheet: on a phone the two ways, each a link that dials and keeps the pick; on a desk the words that make Quo the
 * computer's calling app, with the `tel:` link under them.
 */
function CallWaysSheet({ plan, name, number, zIndex, onPick, onClose }: { plan: CallPlan; name: string | null | undefined; number: string; zIndex: number; onPick: (way: CallWay) => void; onClose: () => void }) {
  if (plan.sheet === 'desk') {
    return (
      <ResponsiveModalShell title={DIAL_WORDS.title(name, number)} onRequestClose={onClose} maxWidthDesktop={420} zIndex={zIndex}>
        <div data-testid="call-ways-desk" style={{ display: 'grid', gap: '0.6rem', paddingTop: '0.5rem' }}>
          <a href={plan.href ?? undefined} onClick={onClose} style={{ ...wayRow, fontWeight: 700, color: 'var(--text-blue-700)' }} data-testid="call-ways-tel">
            {DIAL_WORDS.title(null, number)}
          </a>
          <p style={{ margin: 0 }}>{DIAL_WORDS.deskLine}</p>
          <p style={{ margin: 0 }}>{DIAL_WORDS.deskQuo}</p>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.3rem' }}>
            <li>{DIAL_WORDS.deskMac}</li>
            <li>{DIAL_WORDS.deskWindows}</li>
          </ul>
          <p style={quiet}>
            <Link to={DIAL_WORDS.deskGuideHref} onClick={onClose}>
              {DIAL_WORDS.deskGuide}
            </Link>
          </p>
        </div>
      </ResponsiveModalShell>
    )
  }
  return (
    <ResponsiveModalShell title={DIAL_WORDS.title(name, number)} onRequestClose={onClose} maxWidthDesktop={420} zIndex={zIndex}>
      <div data-testid="call-ways" style={{ display: 'grid', gap: '0.6rem', paddingTop: '0.5rem' }}>
        {plan.ways.map((way) => (
          <a key={way.through} href={way.href} onClick={() => onPick(way)} style={wayRow} data-testid={`call-way-${way.through}`} data-kept={way.kept || undefined}>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>
              {way.words}
              {way.kept ? <span style={keptChip}>{DIAL_WORDS.kept}</span> : null}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{way.note}</span>
          </a>
        ))}
        <p style={quiet}>{DIAL_WORDS.keptLine}</p>
        <p style={{ ...quiet, marginTop: '0.25rem' }}>{DIAL_WORDS.storeLine}</p>
      </div>
    </ResponsiveModalShell>
  )
}
