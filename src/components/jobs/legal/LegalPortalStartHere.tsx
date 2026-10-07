import { useState, type CSSProperties, type ReactNode } from 'react'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER_GREEN } from '../../../lib/portal/portalTheme'
import { portalSmall } from '../../../lib/legal/legalPortalCards'
import { startStepWords, startStopLabel, type StartStop } from '../../../lib/legal/legalPortalStart'

/**
 * Start here (v2.4820): the firm's first tab, a short intake in steps — who the office is (live
 * figures), what comes with each matter, how the office works with the firm, and the portal's tour.
 * A rail across the top says which step this is; Matters are one tap away from every step. The words
 * are the kernel's (`legalPortalStart.ts`); this draws them.
 */
export type StartHereProps = {
  /** The steps this portal shows (`startStops`). */
  stops: ReadonlyArray<StartStop>
  /** The step it opens at; the page remounts it to jump (the Matters nudge opens the answers). */
  initialStop?: StartStop
  /** Step 4's form (v2.4821), drawn by the page with its act. */
  answers?: ReactNode
  short: string
  companyName: string
  companyLines: ReadonlyArray<string>
  matterLines: ReadonlyArray<string>
  workLines: ReadonlyArray<string>
  rulesWords: string
  portalLines: ReadonlyArray<string>
  tourStopTitles: ReadonlyArray<string>
  matterCount: number
  onOpenMatters: () => void
  onStartTour: () => void
  onOpenRules: () => void
}

const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 5, border: `1px solid ${COPPER}`, color: COPPER, background: CARD, cursor: 'pointer', font: 'inherit' }
const fill: CSSProperties = { ...btn, background: COPPER, color: '#fff' }
const ghost: CSSProperties = { ...btn, borderColor: HAIR, color: MUTED }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: COPPER, fontWeight: 600, cursor: 'pointer', font: 'inherit' }

function Lines({ lines }: { lines: ReadonlyArray<string> }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8, fontSize: 14, lineHeight: 1.45 }}>
      {lines.map((l) => (
        <li key={l} style={{ position: 'relative', paddingLeft: 16 }}>
          <span aria-hidden style={{ position: 'absolute', left: 0, top: 8, width: 6, height: 6, borderRadius: 999, background: COPPER }} />
          {l}
        </li>
      ))}
    </ul>
  )
}

export default function LegalPortalStartHere(p: StartHereProps) {
  const stops = p.stops
  const [at, setAt] = useState(() => Math.max(0, p.initialStop ? stops.indexOf(p.initialStop) : 0))
  const stop: StartStop = stops[at] ?? 'company'
  const next = stops[at + 1]
  const heading: Record<StartStop, string> = {
    company: p.companyName,
    matter: 'What comes with each matter',
    work: `How ${p.short} works with you`,
    answers: 'Your answers',
    portal: 'The portal, stop by stop',
  }
  let body: ReactNode
  if (stop === 'company') body = <Lines lines={p.companyLines} />
  else if (stop === 'matter') body = <Lines lines={p.matterLines} />
  else if (stop === 'work') {
    body = (
      <>
        <Lines lines={p.workLines} />
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <button type="button" onClick={p.onOpenRules} style={link} data-legal-start-rules>{p.rulesWords} ›</button>
          <span style={{ color: FAINT, fontSize: portalSmall(12) }}> It opens here, with no sign-in.</span>
        </div>
      </>
    )
  } else if (stop === 'answers') {
    body = p.answers ?? null
  } else {
    body = (
      <>
        <Lines lines={p.portalLines} />
        <div style={{ marginTop: 10, fontSize: portalSmall(12.5), color: MUTED }}>{p.tourStopTitles.join(', ')}.</div>
      </>
    )
  }
  return (
    <div data-legal-start data-start-step={stop} style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '16px 18px' }}>
      <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 12 }}>
        {p.matterCount > 0 ? <>With your firm now: {p.matterCount} {p.matterCount === 1 ? 'matter' : 'matters'}. </> : null}
        <button type="button" onClick={p.onOpenMatters} style={link} data-legal-start-open-matters>Open Matters ›</button>
      </div>
      <nav className="legalStartRail" aria-label="Start here steps" style={{ marginBottom: 14 }}>
        {stops.map((s, i) => {
          const on = i === at
          const done = i < at
          return (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {i > 0 ? <span aria-hidden className="legalStartRailBar" style={{ width: 22, height: 1.5, background: HAIR, margin: '0 10px 0 0' }} /> : null}
              <button type="button" onClick={() => setAt(i)} aria-current={on ? 'step' : undefined} data-start-rail={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '2px 10px 2px 0', cursor: 'pointer', font: 'inherit', fontSize: 12.5, color: on ? INK : done ? MUTED : FAINT, fontWeight: on ? 700 : 500 }}>
                <span aria-hidden style={{ width: 20, height: 20, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: `1.5px solid ${on ? COPPER : done ? PAPER_GREEN : HAIR}`, background: on ? COPPER : done ? PAPER_GREEN : CARD, color: on || done ? '#fff' : FAINT }}>{done ? '✓' : i + 1}</span>
                {startStopLabel(s, p.short)}
              </button>
            </span>
          )
        })}
      </nav>
      <div style={{ fontSize: portalSmall(11), color: FAINT, textTransform: 'uppercase', letterSpacing: '0.07em' }} data-legal-start-step-words>{startStepWords(at, stops.length)}</div>
      <h2 style={{ margin: '2px 0 12px', fontSize: 20, color: INK }}>{heading[stop]}</h2>
      {body}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
        {at > 0 ? <button type="button" onClick={() => setAt(at - 1)} style={ghost}>‹ Back</button> : null}
        {next ? (
          <button type="button" onClick={() => setAt(at + 1)} style={fill}>Next: {startStopLabel(next, p.short)} ›</button>
        ) : (
          <>
            <button type="button" onClick={p.onStartTour} style={fill} data-legal-start-tour>Start the tour ›</button>
            <button type="button" onClick={p.onOpenMatters} style={ghost}>Skip to Matters</button>
          </>
        )}
      </div>
    </div>
  )
}
