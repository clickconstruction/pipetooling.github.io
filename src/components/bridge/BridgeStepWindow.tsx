import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * The frame every step window on the Bridge opens in (spike candidate 9, punch list #303, drawn in
 * `to-dos/bridge-one-story/desks.html`). The owner asked for each of the five windows to be looked at ("is this the
 * best we can do?") and said of the drawing: "Like all of your recommendations, build it all."
 *
 * One shape for Market, Sales, Build, Bill and Collect:
 * 1. where the step stands, in one headline and one line;
 * 2. what to do this week: short groups of rows, each row one thing with one press, the biggest first, the rest
 *    behind *Show all*;
 * 3. everything else the window used to print whole, closed behind a press at the foot (`folds`), with *How this is
 *    counted* last.
 *
 * The frame owns the overlay, the close press, Escape, the sizes and the folds. A window passes words and rows.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const pressBase: CSSProperties = { font: 'inherit', fontSize: '0.84rem', fontWeight: 700, minHeight: 44, padding: '0 0.85rem', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', textDecoration: 'none', whiteSpace: 'nowrap' }
const pressPrimary: CSSProperties = { ...pressBase, background: '#2563eb', border: '1px solid #2563eb', color: '#ffffff' }
const linkPress: CSSProperties = { font: 'inherit', fontSize: '0.84rem', padding: 0, minHeight: 44, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }

export type StepPress = {
  label: string
  /** A page of the app to open. */
  to?: string
  onClick?: () => void
  /** The first thing to do: drawn blue. At most one per window. */
  primary?: boolean
  testId?: string
}

export type StepRow = {
  key: string
  /** One thing to do, in a few words. */
  title: ReactNode
  /** One short line under it: the number and why. */
  sub?: ReactNode
  press?: StepPress
  /** Anything a row opens under itself (a sheet, the why). Drawn full width under the row. */
  under?: ReactNode
}

export type StepGroup = {
  key: string
  /** "Do this week", or the group's own name with its count: "Sold, and nobody on it · 29 jobs, $98k". */
  title: string
  rows: StepRow[]
  /** How many rows show before *Show all*. Default 3. */
  shown?: number
  /** Said in place of the rows when there are none. Leave out to hide an empty group. */
  empty?: string
}

export type StepFoldSpec = {
  key: string
  /** The press's words: "Every source (45)", "How this is counted". */
  label: string
  content: ReactNode
}

function Press({ press }: { press: StepPress }) {
  const style = press.primary ? pressPrimary : pressBase
  if (press.to)
    return (
      <Link to={press.to} onClick={press.onClick} style={style} data-testid={press.testId}>
        {press.label}
      </Link>
    )
  return (
    <button type="button" onClick={press.onClick} style={style} data-testid={press.testId}>
      {press.label}
    </button>
  )
}

/** One group of rows: its name, the first few rows, and a press for the rest. */
export function StepRows({ group }: { group: StepGroup }) {
  const [all, setAll] = useState(false)
  const shown = group.shown ?? 3
  if (group.rows.length === 0 && !group.empty) return null
  const rows = all ? group.rows : group.rows.slice(0, shown)
  return (
    <section data-testid={`bridge-step-group-${group.key}`} style={{ minWidth: 0 }}>
      <div style={label}>{group.title}</div>
      {group.rows.length === 0 ? (
        <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>{group.empty}</div>
      ) : (
        rows.map((r) => (
          <div key={r.key} style={{ borderTop: '1px solid var(--border)', padding: '0.5rem 0' }} data-testid="bridge-step-row">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.2rem 0.75rem', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{r.title}</div>
                {r.sub ? <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{r.sub}</div> : null}
              </div>
              {r.press ? <Press press={r.press} /> : null}
            </div>
            {r.under ? <div style={{ marginTop: 6 }}>{r.under}</div> : null}
          </div>
        ))
      )}
      {group.rows.length > shown && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} style={linkPress} data-testid={`bridge-step-all-${group.key}`}>
          {all ? 'Show fewer ▴' : `Show all ${group.rows.length} ›`}
        </button>
      )}
    </section>
  )
}

/** The presses at the foot: each opens what the window used to print whole. One is open at a time. */
function Folds({ folds }: { folds: StepFoldSpec[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (folds.length === 0) return null
  const current = folds.find((f) => f.key === open) ?? null
  return (
    <section style={{ borderTop: '1px solid var(--border)', paddingTop: 4, minWidth: 0 }} data-testid="bridge-step-folds">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 1.1rem' }}>
        {folds.map((f) => (
          <button key={f.key} type="button" onClick={() => setOpen((o) => (o === f.key ? null : f.key))} aria-expanded={open === f.key} style={linkPress} data-testid={`bridge-step-fold-${f.key}`}>
            {f.label} {open === f.key ? '▴' : '›'}
          </button>
        ))}
      </div>
      {current ? (
        <div style={{ marginTop: 8, minWidth: 0 }} data-testid={`bridge-step-fold-body-${current.key}`}>
          {current.content}
        </div>
      ) : null}
    </section>
  )
}

export type BridgeStepWindowProps = {
  /** The window's own test id, kept from before: "bridge-collect-desk". */
  testId: string
  /** "Collect, broken down": the dialog's name. */
  ariaLabel: string
  /** "Collect · the work billed". */
  eyebrow: ReactNode
  /** Where the step stands, in one sentence or two short ones. */
  headline: ReactNode
  headlineTestId?: string
  /** 'bad' draws the headline red, as a step that is short or late. */
  tone?: 'plain' | 'bad'
  /** One line under the headline. */
  line?: ReactNode
  /** A small picture or pair of figures between the headline and the rows. */
  summary?: ReactNode
  groups: StepGroup[]
  /** Anything a window still draws itself between the rows and the folds. */
  children?: ReactNode
  folds: StepFoldSpec[]
  /** A line at the very foot: the page doors, the record press. */
  footer?: ReactNode
  onClose: () => void
  /** False while a sheet over the window is open, so Escape closes the sheet first. Default true. */
  escCloses?: boolean
}

export function BridgeStepWindow({ testId, ariaLabel, eyebrow, headline, headlineTestId, tone = 'plain', line, summary, groups, children, folds, footer, onClose, escCloses = true }: BridgeStepWindowProps) {
  useEffect(() => {
    if (!escCloses) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, escCloses])
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 750, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(24px + var(--app-top-chrome, 0px)) 16px 24px', overflow: 'auto' }} data-testid={testId}>
      <div role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: 'min(760px, 100%)', padding: '1.1rem 1.3rem 1rem', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div style={label}>{eyebrow}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: tone === 'bad' ? 'var(--text-red-700)' : 'var(--text-strong)', lineHeight: 1.2, overflowWrap: 'anywhere' }} data-testid={headlineTestId}>
              {headline}
            </div>
            {line ? <div style={{ fontSize: '0.92rem', color: 'var(--text-700)', lineHeight: 1.35 }}>{line}</div> : null}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            ×
          </button>
        </div>
        {summary}
        {groups.map((g) => (
          <StepRows key={g.key} group={g} />
        ))}
        {children}
        <Folds folds={folds} />
        {footer}
      </div>
    </div>
  )
}
