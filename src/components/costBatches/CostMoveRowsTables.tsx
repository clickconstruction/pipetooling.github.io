/**
 * A job's cost rows by stream, each with its checkbox — bank allocations, supply-house invoice
 * allocations, clock sessions grouped by person, Other job charges (listed, never movable: the
 * batch RPC has no op for them) — on the job window's Costs tab (`JobWindowCostMovePanel`). Totals
 * per stream in each heading, a press that ticks a whole stream or a person's sessions, and a click
 * anywhere on a movable row ticks it (the owner's "click on something"). The rules (which rows a
 * batch can move, the keys, the totals) live in `lib/costBatches/costMoveRows.ts`.
 */
import { Fragment, type CSSProperties } from 'react'
import {
  COST_MOVE_SOURCE_LABELS,
  OTHER_CHARGE_HOLD,
  costMoveHold,
  costMoveHoursWords,
  costMoveRowDollars,
  costMoveRowKey,
  costMoveTotals,
  groupClockRowsByPerson,
  type CostMoveBankRow,
  type CostMoveOtherRow,
  type CostMoveRow,
  type CostMoveSource,
  type CostMoveSupplyRow,
} from '../../lib/costBatches/costMoveRows'
import { usd } from '../../lib/costBatches/costMovePlan'
import { countedLabel } from '../../lib/batchWords'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { formatWorkDateYmdFriendly } from '../../utils/dateUtils'

const section: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.4rem' }
const headRow: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }
const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }
const totalsWords: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }
const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }
const th: CSSProperties = { textAlign: 'left', padding: '0.3rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const thNum: CSSProperties = { ...th, textAlign: 'right' }
const td: CSSProperties = { padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-base)', verticalAlign: 'top' }
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const tdMuted: CSSProperties = { ...td, color: 'var(--text-muted)' }
const smallButton: CSSProperties = { padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 600 }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const holdWords: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-amber-800)' }

function ymdWords(ymd: string | null): string {
  return ymd ? formatWorkDateYmdFriendly(ymd) : '—'
}

function cardWords(row: CostMoveBankRow): string {
  if (!row.cardId) return '—'
  return row.cardNickname ?? formatMercuryDebitCardIdCompact(row.cardId)
}

export type CostMoveRowsTablesProps = {
  rows: readonly CostMoveRow[]
  selected: ReadonlySet<string>
  onToggle: (key: string) => void
  /** Tick or untick many keys at once (a heading's select press). */
  onSetMany: (keys: readonly string[], on: boolean) => void
}

function SelectPress({ keys, selected, onSetMany, noun }: { keys: string[]; selected: ReadonlySet<string>; onSetMany: CostMoveRowsTablesProps['onSetMany']; noun: string }) {
  if (keys.length === 0) return null
  const allOn = keys.every((k) => selected.has(k))
  return (
    <button type="button" style={smallButton} onClick={() => onSetMany(keys, !allOn)}>
      {allOn ? countedLabel('Untick', keys.length, noun) : countedLabel('Tick', keys.length, noun)}
    </button>
  )
}

function SourceHeading({ source, rows, dollars, minutes, children }: { source: CostMoveSource; rows: number; dollars: number; minutes: number; children?: React.ReactNode }) {
  const bits = [`${rows} ${rows === 1 ? 'row' : 'rows'}`]
  if (source === 'clock') bits.push(costMoveHoursWords(minutes))
  else bits.push(usd(dollars))
  return (
    <div style={headRow}>
      <h3 style={heading}>{COST_MOVE_SOURCE_LABELS[source]}</h3>
      <span style={totalsWords}>{bits.join(' · ')}</span>
      {children}
    </div>
  )
}

function Check({ row, selected, onToggle, label }: { row: CostMoveRow; selected: ReadonlySet<string>; onToggle: (key: string) => void; label: string }) {
  const key = costMoveRowKey(row)
  const hold = costMoveHold(row)
  return <input type="checkbox" aria-label={label} checked={selected.has(key)} disabled={!hold.movable} title={hold.movable ? undefined : hold.why} onChange={() => onToggle(key)} onClick={(e) => e.stopPropagation()} />
}

/** A click anywhere on a movable row ticks it; a held row (a rejected session) does nothing. */
function rowPress(row: CostMoveRow, onToggle: (key: string) => void): { onClick?: () => void; style?: CSSProperties } {
  if (!costMoveHold(row).movable) return {}
  return { onClick: () => onToggle(costMoveRowKey(row)), style: { cursor: 'pointer' } }
}

export function CostMoveRowsTables({ rows, selected, onToggle, onSetMany }: CostMoveRowsTablesProps) {
  const totals = costMoveTotals(rows)
  const bank = rows.filter((r): r is CostMoveBankRow => r.source === 'bank')
  const supply = rows.filter((r): r is CostMoveSupplyRow => r.source === 'supply')
  const clockGroups = groupClockRowsByPerson(rows)
  const other = rows.filter((r): r is CostMoveOtherRow => r.source === 'other')
  const movableKeys = (list: readonly CostMoveRow[]) => list.filter((r) => costMoveHold(r).movable).map(costMoveRowKey)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section aria-labelledby="move-cost-bank" style={section}>
        <SourceHeading source="bank" {...totals.bySource.bank}>
          <SelectPress keys={movableKeys(bank)} selected={selected} onSetMany={onSetMany} noun="bank row" />
        </SourceHeading>
        {bank.length === 0 ? (
          <p style={quiet}>This job carries no bank allocations.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={table} id="move-cost-bank">
              <thead>
                <tr>
                  <th style={th} aria-label="Tick" />
                  <th style={th}>Date</th>
                  <th style={th}>Counterparty</th>
                  <th style={th}>Card</th>
                  <th style={th}>Category</th>
                  <th style={thNum}>Transaction</th>
                  <th style={thNum}>Allocated</th>
                  <th style={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {bank.map((r) => (
                  <tr key={r.allocationId} {...rowPress(r, onToggle)}>
                    <td style={td}>
                      <Check row={r} selected={selected} onToggle={onToggle} label={`Tick ${r.counterparty ?? 'bank charge'} ${ymdWords(r.postedYmd)} ${usd(r.allocationAmount)}`} />
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{ymdWords(r.postedYmd)}</td>
                    <td style={td}>{r.counterparty ?? '—'}</td>
                    <td style={td}>{cardWords(r)}</td>
                    <td style={tdMuted}>{r.category ?? '—'}</td>
                    <td style={tdNum}>{usd(r.txAmount)}</td>
                    <td style={tdNum}>{usd(r.allocationAmount)}</td>
                    <td style={tdMuted}>{r.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="move-cost-supply" style={section}>
        <SourceHeading source="supply" {...totals.bySource.supply}>
          <SelectPress keys={movableKeys(supply)} selected={selected} onSetMany={onSetMany} noun="invoice" />
        </SourceHeading>
        {supply.length === 0 ? (
          <p style={quiet}>This job carries no supply-house invoice allocations.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={table} id="move-cost-supply">
              <thead>
                <tr>
                  <th style={th} aria-label="Tick" />
                  <th style={th}>Supply house</th>
                  <th style={th}>Invoice</th>
                  <th style={th}>Date</th>
                  <th style={th}>PO</th>
                  <th style={thNum}>Amount</th>
                  <th style={thNum}>Share</th>
                  <th style={thNum}>This job</th>
                  <th style={th}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {supply.map((r) => (
                  <tr key={r.invoiceId} {...rowPress(r, onToggle)}>
                    <td style={td}>
                      <Check row={r} selected={selected} onToggle={onToggle} label={`Tick invoice ${r.invoiceNumber} ${r.supplyHouse ?? ''}`} />
                    </td>
                    <td style={td}>{r.supplyHouse ?? '—'}</td>
                    <td style={td}>{r.invoiceNumber || '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{ymdWords(r.invoiceYmd || null)}</td>
                    <td style={tdMuted}>{r.purchaseOrder ?? ''}</td>
                    <td style={tdNum}>{usd(r.amount)}</td>
                    <td style={tdNum}>{`${r.pct}%`}</td>
                    <td style={tdNum}>{usd(costMoveRowDollars(r))}</td>
                    <td style={tdMuted}>{r.isPaid ? 'paid' : 'unpaid'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="move-cost-clock" style={section}>
        <SourceHeading source="clock" {...totals.bySource.clock}>
          <SelectPress keys={movableKeys(clockGroups.flatMap((g) => g.rows))} selected={selected} onSetMany={onSetMany} noun="session" />
        </SourceHeading>
        {clockGroups.length === 0 ? (
          <p style={quiet}>This job carries no clock sessions.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={table} id="move-cost-clock">
              <thead>
                <tr>
                  <th style={th} aria-label="Tick" />
                  <th style={th}>Person</th>
                  <th style={th}>Work date</th>
                  <th style={thNum}>Hours</th>
                  <th style={th}>Standing</th>
                </tr>
              </thead>
              <tbody>
                {clockGroups.map((g) => (
                  <Fragment key={g.userId}>
                    <tr>
                      <td style={{ ...td, background: 'var(--bg-subtle)' }} />
                      <td colSpan={2} style={{ ...td, background: 'var(--bg-subtle)', fontWeight: 600, color: 'var(--text-strong)' }}>
                        {g.personName} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {g.rows.length} {g.rows.length === 1 ? 'session' : 'sessions'}</span>
                      </td>
                      <td style={{ ...tdNum, background: 'var(--bg-subtle)', fontWeight: 600 }}>{costMoveHoursWords(g.minutes)}</td>
                      <td style={{ ...td, background: 'var(--bg-subtle)' }}>
                        <SelectPress keys={movableKeys(g.rows)} selected={selected} onSetMany={onSetMany} noun="session" />
                      </td>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.sessionId} {...rowPress(r, onToggle)}>
                        <td style={td}>
                          <Check row={r} selected={selected} onToggle={onToggle} label={`Tick ${g.personName} ${ymdWords(r.workYmd)}`} />
                        </td>
                        <td style={tdMuted}>{g.personName}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{ymdWords(r.workYmd)}</td>
                        <td style={tdNum}>{costMoveHoursWords(r.minutes)}</td>
                        <td style={r.rejected ? { ...td, color: 'var(--text-red-700)' } : tdMuted}>{r.rejected ? 'rejected · stays' : r.approved ? 'approved' : 'waiting for approval'}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="move-cost-other" style={section}>
        <SourceHeading source="other" {...totals.bySource.other} />
        <p style={holdWords}>{OTHER_CHARGE_HOLD}</p>
        {other.length === 0 ? (
          <p style={quiet}>This job carries no Other job charges.</p>
        ) : (
          <table style={table} id="move-cost-other">
            <thead>
              <tr>
                <th style={th}>Description</th>
                <th style={thNum}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {other.map((r) => (
                <tr key={r.chargeId}>
                  <td style={td}>{r.description}</td>
                  <td style={tdNum}>{usd(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
