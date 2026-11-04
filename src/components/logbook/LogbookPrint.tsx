/**
 * The logbook's two print faces (punch list #255): the summary sheet that goes behind the
 * board's own form, and the full week-by-week log kept as backup for an audit. The window is
 * portalled to <body> and prints alone (lib/printRoot.ts). Paper is light: data-theme="light".
 */
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { printRootCss } from '../../lib/printRoot'
import {
  NOT_COUNTED_LABEL,
  TRADES,
  TRADE_LABEL,
  fmtNum,
  type Goal,
  type LogWeek,
  type NoRuleYet,
  type OpeningBalance,
  type ParsedLicense,
  type Progress,
  type Supervisor,
  type Totals,
  type Trade,
} from '../../lib/logbook/logbook'

export type PrintFace = 'summary' | 'full'

type Props = {
  face: PrintFace
  onClose: () => void
  personName: string
  employer: string
  held: ParsedLicense[]
  goals: Goal[]
  /** The licenses held with nothing above them in their trade. */
  topOfLadder: ParsedLicense[]
  /** The licenses held whose next rung has no rule seeded yet. */
  noRuleYet: NoRuleYet[]
  progress: Progress[]
  supervisorFor: (trade: Trade, cls: Goal['requirement']['supervisorClass']) => Supervisor | null
  weeks: LogWeek[]
  totals: Totals
  openings: OpeningBalance[]
  todayYmd: string
}

const INK = '#111'
const RULE = '1px solid #999'
const th: CSSProperties = { textAlign: 'left', borderBottom: RULE, padding: '3px 5px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }
const td: CSSProperties = { borderBottom: '1px solid #ddd', padding: '3px 5px', fontSize: 11.5, verticalAlign: 'top' }
const num: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

function longDate(ymd: string | null): string {
  if (!ymd) return '—'
  const [y = 1970, m = 1, d = 1] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function LogbookPrint(p: Props) {
  const facing = p.face === 'summary' ? 'Summary sheet' : 'Full log'
  return createPortal(
    <div className="logbook-print" data-theme="light" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'center', overflow: 'auto', padding: 'calc(24px + var(--app-top-chrome, 0px)) 12px 24px' }}>
      <style>{`${printRootCss('logbook-print')} @media print { .logbook-print-chrome { display: none !important; } .logbook-print-sheet { box-shadow: none !important; width: auto !important; padding: 0 !important; margin: 0 !important; } .logbook-week { break-inside: avoid; page-break-inside: avoid; } .logbook-sign { break-inside: avoid; page-break-inside: avoid; } }`}</style>
      <div role="dialog" aria-modal="true" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <div className="logbook-print-chrome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: 'var(--surface)', borderRadius: 10, padding: '8px 12px', width: 816, maxWidth: '100%' }}>
          <b style={{ color: INK }}>{facing}, as it prints</b>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={p.onClose} style={{ font: 'inherit', fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-400)', background: 'var(--surface)', color: INK, cursor: 'pointer' }}>Close</button>
            <button type="button" onClick={() => window.print()} style={{ font: 'inherit', fontWeight: 800, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Print the {facing.toLowerCase()}</button>
          </div>
        </div>
        <div className="logbook-print-sheet" style={{ background: 'var(--surface)', color: INK, width: 816, maxWidth: '100%', padding: 48, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontFamily: 'Georgia, "Times New Roman", serif' }}>
          <Head {...p} title={p.face === 'summary' ? 'Record of trade experience: summary' : 'Record of trade experience: week by week'} />
          {p.face === 'summary' ? <Summary {...p} /> : <Full {...p} />}
          <p style={{ fontSize: 10, color: '#555', marginTop: 18, borderTop: RULE, paddingTop: 6 }}>
            Approved clock hours from ClickTooling, printed {longDate(p.todayYmd)}. Each hour counts toward the trade of the job it was clocked on. This record goes behind the board’s own form, which the board accepts only as its signed original.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Head(p: Props & { title: string }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${INK}`, paddingBottom: 6 }}>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{p.employer}</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{p.title}</div>
        </div>
        <div style={{ fontSize: 11, textAlign: 'right' }}>Period: {longDate(p.totals.firstYmd)} to {longDate(p.totals.lastYmd)}</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
        <tbody>
          <tr>
            <td style={{ ...td, width: 140, fontWeight: 700 }}>Teammate</td>
            <td style={td}>{p.personName}</td>
          </tr>
          <tr>
            <td style={{ ...td, fontWeight: 700 }}>Licenses held</td>
            <td style={td}>{p.held.length ? p.held.map((l) => `${l.name}${l.number ? ` #${l.number}` : ''}`).join(' · ') : '—'}</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function Summary(p: Props) {
  const years = p.totals.byYear
  const trades = TRADES.filter((t) => p.totals.byTrade[t] > 0 || p.goals.some((g) => g.requirement.trade === t))
  return (
    <>
      <h3 style={{ fontSize: 13, margin: '16px 0 4px' }}>Toward the next license</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th style={th}>Trade</th><th style={th}>Toward</th><th style={{ ...th, textAlign: 'right' }}>On the clock</th><th style={{ ...th, textAlign: 'right' }}>Before the clock</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={{ ...th, textAlign: 'right' }}>Board needs</th></tr>
        </thead>
        <tbody>
          {p.goals.map((g, i) => {
            const pr = p.progress[i]
            if (!pr) return null
            const u = pr.unit === 'hours' ? 'h' : 'mo'
            return (
              <tr key={g.requirement.toName}>
                <td style={td}>{TRADE_LABEL[g.requirement.trade]}</td>
                <td style={td}>{g.requirement.toName} ({g.requirement.board})</td>
                <td style={num}>{fmtNum(pr.fromClock)} {u}</td>
                <td style={num}>{pr.opening ? `${fmtNum(pr.opening)} ${u}` : '—'}</td>
                <td style={{ ...num, fontWeight: 700 }}>{fmtNum(pr.done)} {u}</td>
                <td style={num}>{fmtNum(pr.need)} {u}</td>
              </tr>
            )
          })}
          {p.goals.length === 0 ? (
            <tr>
              <td style={td} colSpan={6}>
                {p.noRuleYet.length
                  ? [
                      ...p.noRuleYet.map((n) => `${n.holds.name} is held. The next license is ${n.next.name}, and its rule is not seeded yet.`),
                      ...(p.topOfLadder.length ? [`${p.topOfLadder.map((l) => l.name).join(' and ')}: the top rung the logbook tracks.`] : []),
                    ].join(' ')
                  : 'The licenses held are the top rungs the logbook tracks.'}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {p.openings.length ? (
        <p style={{ fontSize: 11, margin: '6px 0 0' }}>Before the clock: {p.openings.map((o) => `${TRADE_LABEL[o.trade]} ${fmtNum(o.amount)} ${o.unit} from ${o.source}`).join('; ')}.</p>
      ) : null}

      <h3 style={{ fontSize: 13, margin: '16px 0 4px' }}>Approved hours by year and trade</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th style={th}>Year</th>{trades.map((t) => <th key={t} style={{ ...th, textAlign: 'right' }}>{TRADE_LABEL[t]}</th>)}</tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.year}><td style={td}>{y.year}</td>{trades.map((t) => <td key={t} style={num}>{fmtNum(y.byTrade[t])}</td>)}</tr>
          ))}
          <tr><td style={{ ...td, fontWeight: 700 }}>Total</td>{trades.map((t) => <td key={t} style={{ ...num, fontWeight: 700 }}>{fmtNum(p.totals.byTrade[t])}</td>)}</tr>
        </tbody>
      </table>
      <p style={{ fontSize: 11, margin: '6px 0 0' }}>
        Not counted toward any license: {(Object.keys(NOT_COUNTED_LABEL) as Array<keyof typeof NOT_COUNTED_LABEL>).map((k) => `${NOT_COUNTED_LABEL[k].toLowerCase()} ${fmtNum(p.totals.notCounted[k])} h`).join(', ')}.
      </p>

      <h3 style={{ fontSize: 13, margin: '20px 0 4px' }}>Supervising licensee</h3>
      {p.goals.every((g) => !(p.totals.byTrade[g.requirement.trade] > 0)) ? (
        <p style={{ fontSize: 11.5, margin: 0 }}>
          A supervisor has nothing to sign on this sheet yet. {p.personName} has no approved hours in a trade they hold a license in.
          {TRADES.filter((t) => p.totals.byTrade[t] > 0 && !p.held.some((l) => l.trade === t)).map((t) => ` The ${fmtNum(p.totals.byTrade[t])} ${TRADE_LABEL[t].toLowerCase()} hours above count toward no license, because no ${TRADE_LABEL[t].toLowerCase()} license is held.`).join('')}
        </p>
      ) : null}
      {p.goals.filter((g) => p.totals.byTrade[g.requirement.trade] > 0).map((g) => {
        const s = p.supervisorFor(g.requirement.trade, g.requirement.supervisorClass)
        return (
          <div key={g.requirement.toName} className="logbook-sign" style={{ border: RULE, padding: '8px 10px', marginTop: 8, fontSize: 11.5 }}>
            <div><b>{TRADE_LABEL[g.requirement.trade]}.</b> I supervised the {g.requirement.trade === 'hvac' ? 'HVAC' : g.requirement.trade} work shown above and it is true and correct to the best of my knowledge.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr', gap: 14, marginTop: 22 }}>
              <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 2 }}>{s ? s.personName : 'Name'}, signature</div>
              <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 2 }}>{s ? `${s.licenseName} #${s.number ?? ''}` : 'License and number'}</div>
              <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 2 }}>Date</div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function Full(p: Props) {
  const weeks = [...p.weeks].reverse()
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
      <thead>
        <tr><th style={th}>Week</th><th style={th}>Job</th><th style={th}>Address</th><th style={th}>Trade</th><th style={{ ...th, textAlign: 'right' }}>Days</th><th style={{ ...th, textAlign: 'right' }}>Hours</th></tr>
      </thead>
      {weeks.map((w) => (
        <tbody key={w.weekStartYmd} className="logbook-week">
          {w.lines.map((l, i) => (
            <tr key={l.jobKey} style={{ color: l.counts.trade ? INK : '#666' }}>
              <td style={td}>{i === 0 ? `${w.weekStartYmd.slice(5).replace('-', '/')} to ${w.weekEndYmd.slice(5).replace('-', '/')}/${w.weekEndYmd.slice(2, 4)}` : ''}</td>
              <td style={td}>{l.jobNumber ? `J${l.jobNumber} ` : ''}{l.jobName}</td>
              <td style={td}>{l.jobAddress}</td>
              <td style={td}>{l.counts.trade ? TRADE_LABEL[l.counts.trade] : 'Not counted'}</td>
              <td style={num}>{l.sessions}</td>
              <td style={num}>{fmtNum(l.hours)}</td>
            </tr>
          ))}
        </tbody>
      ))}
      <tbody>
        {TRADES.filter((t) => p.totals.byTrade[t] > 0).map((t) => (
          <tr key={t}><td style={{ ...td, fontWeight: 700 }} colSpan={5}>{TRADE_LABEL[t]} total</td><td style={{ ...num, fontWeight: 700 }}>{fmtNum(p.totals.byTrade[t])}</td></tr>
        ))}
        <tr><td style={td} colSpan={5}>Not counted</td><td style={num}>{fmtNum(p.totals.notCounted.estimating + p.totals.notCounted.office + p.totals.notCounted.no_trade)}</td></tr>
      </tbody>
    </table>
  )
}
