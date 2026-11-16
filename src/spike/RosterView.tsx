/** SPIKE ONLY: People → Subs over the made-up roster. Deleted at wrap-up. */
import { useMemo, useState, type CSSProperties } from 'react'
import { SubOwedBlock } from '../components/people/SubOwedBlock'
import { PeopleSubsReach, TeamSheetRuleSwitch } from '../components/people/PeopleSubsReach'
import { buildSubOwedBreakdown, owedMoney, owedPersonById, owedTiles, owedUnderFigure, owedView } from '../lib/people/subOwedBreakdown'
import { sheetOwedToChip, teamSheetsLineWords, type TeamSheetRule } from '../lib/subWorkOrders/teamSheetRule'
import { SPIKE_ROWS, spikeOwedInputs } from './fixtures'
import { say } from './say'

const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.6rem', verticalAlign: 'top' }
const badge = (ok: boolean): CSSProperties => ({ background: ok ? 'var(--bg-green-tint)' : 'var(--bg-neutral-100)', color: ok ? 'var(--text-green-600)' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', whiteSpace: 'nowrap', marginRight: 4 })

/** People → Subs as the tab draws it, over the made-up roster: the tiles, the line, the rows and one open block. */
export function RosterView({ rule: fixedRule, narrow = false, openId = 'harlan' }: { rule?: TeamSheetRule; narrow?: boolean; openId?: string | null }) {
  const [rule, setRule] = useState<TeamSheetRule>(fixedRule ?? 'payroll')
  const [open, setOpen] = useState<string | null>(openId)
  const breakdown = useMemo(() => buildSubOwedBreakdown(spikeOwedInputs(rule), { rule }), [rule])
  const tiles = owedTiles(breakdown)
  const teamPeople = [...breakdown.people.values()].filter((p) => p.kind === 'team')
  const teamCount = rule === 'owed' ? teamPeople.reduce((n, p) => n + p.sheets.length, 0) : breakdown.payroll.length
  const figure = (id: string) => owedView(owedPersonById(breakdown, id), 'open').open
  const block = (id: string, name: string, team: boolean, onClose?: () => void) => (
    <SubOwedBlock
      person={owedPersonById(breakdown, id)}
      name={name}
      balanceDue={team ? null : figure(id)}
      narrow={narrow}
      onOpenJob={say('Open the job')}
      onOpenSheet={say('Open the sheet')}
      onOpenPayRun={say('Open in the pay run')}
      onByDate={say('By date')}
      onPay={say('Record payment')}
      onBackcharge={say('Back-charge')}
      onStatement={say('Statement of account')}
      onWorkStatement={say('Work statement')}
      onClose={onClose}
    />
  )
  return (
    <div>
      {fixedRule ? null : <TeamSheetRuleSwitch rule={rule} onChange={setRule} />}
      <PeopleSubsReach tiles={tiles} rule={rule} narrow={narrow} onOpenPayRun={say('Open the pay run')} />
      {breakdown.shared.filter((s) => !s.settled).length > 0 ? (
        <div style={{ marginBottom: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.9rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>1 sheet needs one sub · {owedMoney(tiles.shared)} open</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Its money is counted once, here. It is in no Balance due until the sheet names one sub.</div>
        </div>
      ) : null}
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>{teamSheetsLineWords(teamCount, rule === 'owed' ? tiles.teamOpen : tiles.payrollOpen, rule)}</p>
      {narrow ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {SPIKE_ROWS.map((r) => {
            const p = owedPersonById(breakdown, r.personId)
            const v = owedView(p, 'open')
            return (
              <div key={r.personId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <b style={{ color: 'var(--text-link)' }}>{r.name}</b>
                  {v.open > 0 ? (
                    <button type="button" onClick={() => setOpen(r.personId)} style={{ font: 'inherit', fontWeight: 700, border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }}>
                      {owedMoney(v.open)} ›
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {[r.status, v.sheetCount > 0 ? `${v.sheetCount} ${v.sheetCount === 1 ? 'sheet' : 'sheets'} on ${v.jobCount} ${v.jobCount === 1 ? 'job' : 'jobs'}` : r.worked, v.ready > 0 ? `${owedMoney(v.ready)} ready` : ''].filter(Boolean).join(' · ')}
                </div>
                {p?.kind === 'team' ? <div style={{ marginTop: 4, fontSize: '0.7rem', fontWeight: 650, color: 'var(--text-violet-700)' }}>{sheetOwedToChip('team')}</div> : null}
                <div style={{ marginTop: 5 }}>
                  {r.badges.map(([label, state]) => (
                    <span key={label} style={badge(state === 'ok')}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
          {open ? (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', zIndex: 10, paddingTop: 'var(--app-top-chrome, 0px)' }}>
              <div style={{ width: '100%', background: 'var(--surface)', borderRadius: '18px 18px 0 0', padding: '0.7rem 0.8rem 1rem', maxHeight: 'min(88vh, 100%)', overflowY: 'auto', boxSizing: 'border-box' }}>
                {block(open, SPIKE_ROWS.find((r) => r.personId === open)?.name ?? '', owedPersonById(breakdown, open)?.kind === 'team', () => setOpen(null))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              {['Sub', 'Status', 'Open work orders', 'Balance due', 'Compliance', 'Track record'].map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i === 3 ? 'right' : 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SPIKE_ROWS.flatMap((r) => {
              const p = owedPersonById(breakdown, r.personId)
              const amount = figure(r.personId)
              const isOpen = open === r.personId
              const row = (
                <tr key={r.personId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 650, color: 'var(--text-link)' }}>{r.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                  </td>
                  <td style={td}>
                    <b>{r.status}</b>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.worked}</div>
                  </td>
                  <td style={{ ...td, color: 'var(--text-faint)' }}>—</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: amount > 0 ? 700 : 400 }}>
                    {amount > 0 ? (
                      <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.personId)} style={{ font: 'inherit', fontWeight: 'inherit', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                        {owedMoney(amount)} {isOpen ? '▾' : '▸'}
                      </button>
                    ) : (
                      '—'
                    )}
                    {owedUnderFigure(p) ? <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>{owedUnderFigure(p)}</div> : null}
                    {p?.kind === 'team' ? <div style={{ fontSize: '0.7rem', fontWeight: 650, color: 'var(--text-violet-700)' }}>{sheetOwedToChip('team')}</div> : null}
                  </td>
                  <td style={td}>
                    {r.badges.map(([label, state]) => (
                      <span key={label} style={badge(state === 'ok')}>
                        {label}
                      </span>
                    ))}
                  </td>
                  <td style={{ ...td, fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.track}</td>
                </tr>
              )
              return isOpen
                ? [
                    row,
                    <tr key={`${r.personId}-owed`}>
                      <td colSpan={6} style={{ padding: '0 0.6rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
                        {block(r.personId, r.name, p?.kind === 'team')}
                      </td>
                    </tr>,
                  ]
                : [row]
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

