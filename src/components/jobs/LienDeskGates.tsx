import type { ReactNode } from 'react'
import { lienGateMark, type LienGate, type LienGateKey, type LienGateVerdict } from '../../lib/jobs/lienDeskGates'

/**
 * The Lien desk's gates as four numbered steps (v2.3657): a verdict headline, then
 * one cell per gate in a fixed slot — one row across a wide pane, stacked 1–4 in a
 * narrow one (a container query on the box, `.lienGates` in index.css, so it follows
 * the pane and not the window). A gate that is not clear carries its sentence and
 * its door in a detail block numbered to match.
 */
export default function LienDeskGates({ gates, verdict, details }: { gates: LienGate[]; verdict: LienGateVerdict; details: Partial<Record<LienGateKey, ReactNode>> }) {
  return (
    <div className="lienGates" data-lien-desk-gates data-ready={verdict.ready ? 'yes' : 'no'}>
      <div className="lienGatesHead">
        <span className="lienGatesVerdict" data-ready={verdict.ready ? 'yes' : 'no'}>
          <span aria-hidden="true">{verdict.ready ? '✓' : '✗'}</span> {verdict.headline}
        </span>
        <span className="lienGatesSummary">{verdict.summary}</span>
        <span className="lienGatesBar" aria-hidden="true">
          {gates.map((g) => (
            <span key={g.key} data-tone={g.tone} />
          ))}
        </span>
      </div>
      <div className="lienGatesGrid">
        {gates.map((g) => {
          const detail = details[g.key]
          return [
            <div key={g.key} className="lienGate" data-n={g.n} data-tone={g.tone} data-gate={g.key} title={g.title}>
              <span className="lienGateNum">{g.n}</span>
              <span className="lienGateLabel">{g.label}</span>
              <span className="lienGateValue">
                <span aria-hidden="true">{lienGateMark(g.tone)}</span> {g.value}
              </span>
            </div>,
            detail ? (
              <div key={`${g.key}-detail`} className="lienGateDetail" data-tone={g.tone} data-gate-detail={g.key}>
                {g.tone !== 'ok' ? (
                  <span className="lienGateDetailLead">
                    {g.n} · {g.label}
                  </span>
                ) : null}
                {detail}
              </div>
            ) : null,
          ]
        })}
      </div>
    </div>
  )
}
