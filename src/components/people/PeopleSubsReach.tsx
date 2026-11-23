/**
 * People → Subs gets the Pay view's reach (punch list #346, PR 5): the tiles over the roster. Owed, ready to pay
 * now, what sits on nobody's row, and a box that shows the rows and the shared sheets adding up to the total.
 *
 * The figures are `owedTiles` over the same sheets the rows open into, so a tile and a row cannot disagree.
 */
import type { CSSProperties } from 'react'
import { owedMoney, type OwedTiles } from '../../lib/people/subOwedBreakdown'
import type { TeamSheetRule } from '../../lib/subWorkOrders/teamSheetRule'
import { MoneyText } from '../Money'

const tile: CSSProperties = { flex: '1 1 150px', minWidth: 0, border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', background: 'var(--surface)' }
const k: CSSProperties = { fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)' }
const v: CSSProperties = { fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }
const small: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const door: CSSProperties = { padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'var(--text-link)', fontFamily: 'inherit' }

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export function PeopleSubsReach({ tiles, rule, narrow = false, onOpenPayRun }: { tiles: OwedTiles; rule: TeamSheetRule; narrow?: boolean; onOpenPayRun: () => void }) {
  return (
    <div data-testid="subs-reach-tiles" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '0.75rem' }}>
      <div style={tile}>
        <div style={k}>{rule === 'owed' && tiles.teamOpen > 0 ? 'Owed for sub labor' : 'Owed to subs'}</div>
        <div style={v}><MoneyText text={owedMoney(tiles.owed)} /></div>
        <div style={small}>
          {n(tiles.owedPeople, 'person', 'people')} · {n(tiles.owedSheets, 'sheet', 'sheets')}
          {rule === 'owed' && tiles.teamOpen > 0 ? <MoneyText text={` · ${owedMoney(tiles.teamOpen)} of it to teammates`} /> : ''}
        </div>
      </div>
      <div style={{ ...tile, borderColor: tiles.ready > 0 ? 'var(--border-green, var(--border))' : 'var(--border)' }}>
        <div style={k}>Ready to pay now</div>
        <div style={{ ...v, color: tiles.ready > 0 ? 'var(--text-green-700)' : 'var(--text-strong)' }}><MoneyText text={owedMoney(tiles.ready)} /></div>
        <div style={small}>
          {n(tiles.readySheets, 'sheet', 'sheets')} ·{' '}
          <button type="button" style={door} onClick={onOpenPayRun}>
            Open the pay run ›
          </button>
        </div>
      </div>
      {!narrow || tiles.shared > 0 ? (
        <div style={tile}>
          <div style={k}>On nobody's row</div>
          <div style={v}><MoneyText text={owedMoney(tiles.shared)} /></div>
          <div style={small}>{tiles.sharedSheets > 0 ? `${n(tiles.sharedSheets, 'sheet', 'sheets')} with no one sub` : 'every sheet has one sub'}</div>
        </div>
      ) : null}
      {rule === 'payroll' && tiles.payrollOpen > 0 ? (
        <div data-testid="subs-reach-in-no-figure" style={{ ...tile, borderColor: 'var(--border-amber)', background: 'var(--bg-amber-tint)' }}>
          <div style={{ ...k, color: 'var(--text-amber-900)' }}>In no figure</div>
          <div style={{ ...v, color: 'var(--text-amber-900)' }}><MoneyText text={owedMoney(tiles.payrollOpen)} /></div>
          <div style={{ ...small, color: 'var(--text-amber-800)' }}>open on {n(tiles.payrollSheets, 'sheet', 'sheets')} that name a teammate and no sub</div>
        </div>
      ) : null}
      {!narrow ? (
        <div style={{ ...tile, borderStyle: 'dashed' }}>
          <div style={k}>Adds up</div>
          <div style={{ ...small, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            Rows <MoneyText text={owedMoney(tiles.rows)} />
            <br />+ on nobody's row <MoneyText text={owedMoney(tiles.shared)} />
            <br />
            <b style={{ color: tiles.addsUp ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
              = <MoneyText text={owedMoney(tiles.owed)} /> {tiles.addsUp ? '✓' : 'does not add up'}
            </b>
          </div>
        </div>
      ) : null}
    </div>
  )
}

