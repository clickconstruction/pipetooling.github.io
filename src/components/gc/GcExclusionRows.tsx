import { Fragment, useState, type Dispatch } from 'react'
import {
  exclusionRows,
  exclusionsFor,
  unitPriceWords,
  type GcAction,
  type Invite,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input, td } from './gcUi'

/**
 * GC mode design spike: Compare quotes' "Their exclusions" (the owner, 2026-10-04: "track those
 * exclusions on a per vendor basis"). One row per exclusion any company named, each company's
 * answer in its column, a cover cost that goes into All in, and a way to type one in from an
 * emailed quote. Rows of the leveling table, between the scope lines and All in.
 */
export function GcExclusionRows({
  pkg,
  bidders,
  ids,
  dispatch,
}: {
  pkg: TradePackage
  bidders: Invite[]
  ids: { projectId: string; packageId: string }
  dispatch: Dispatch<GcAction>
}) {
  const rows = exclusionRows(pkg)
  const small = { display: 'block', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' } as const
  const linkBtn = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8rem', color: 'var(--text-blue-500)', cursor: 'pointer' } as const
  return (
    <>
      <tr>
        <td colSpan={bidders.length + 1} style={{ ...td, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>
          Their exclusions · what each company wrote its quote leaves out
        </td>
      </tr>
      {rows.length === 0 && (
        <tr>
          <td colSpan={bidders.length + 1} style={{ ...td, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No company has listed an exclusion yet. Their quote form asks, and you can add one from an emailed quote below.
          </td>
        </tr>
      )}
      {rows.map((row) => (
        <tr key={row.name}>
          <td style={td}>
            {row.name}
            {row.known && <span style={small}>a Known exclusion · {row.known.by} does it</span>}
          </td>
          {row.cells.map((cell) => {
            const inviteIds = { ...ids, inviteId: cell.invite.id }
            return (
              <td key={cell.invite.id} style={td}>
                {cell.state === 'expected' && <Chip tone="violet">expected</Chip>}
                {cell.state === 'included' && <span style={{ color: 'var(--text-green-700)' }}>✓ included</span>}
                {cell.state === 'unsaid' && (
                  <>
                    <Chip tone="amber" title="Their quote does not say. Ask them, then record what they said.">not said</Chip>
                    <span style={{ ...small, display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        style={linkBtn}
                        onClick={() => dispatch({ type: 'nudge', ...inviteIds, about: `does your quote include ${row.name.toLowerCase()}?` })}
                      >
                        Ask them
                      </button>
                      <button type="button" style={linkBtn} onClick={() => dispatch({ type: 'setQuoteExclusion', ...inviteIds, name: row.name, excluded: false })}>
                        It is in their price
                      </button>
                      <button type="button" style={linkBtn} onClick={() => dispatch({ type: 'setQuoteExclusion', ...inviteIds, name: row.name, excluded: true })}>
                        They leave it out
                      </button>
                    </span>
                  </>
                )}
                {cell.state === 'excluded' && (
                  <>
                    <Chip tone="red">excluded</Chip>
                    {cell.exclusion?.said && <span style={small}>"{cell.exclusion.said}"</span>}
                    {cell.exclusion?.unitPrice ? (
                      <span style={small}>{unitPriceWords(cell.exclusion.unitPrice)} if it comes up</span>
                    ) : (
                      <label style={small}>
                        cost to cover it ${' '}
                        <input
                          type="number"
                          min={0}
                          step={250}
                          value={cell.cover ?? 0}
                          onChange={(e) => dispatch({ type: 'setExclusionCover', ...inviteIds, name: row.name, amount: Number(e.target.value) || 0 })}
                          style={{ ...input, width: '6rem' }}
                          aria-label={`Cost to cover ${row.name}`}
                        />
                      </label>
                    )}
                    <button type="button" style={{ ...linkBtn, display: 'block', marginTop: '0.25rem' }} onClick={() => dispatch({ type: 'setQuoteExclusion', ...inviteIds, name: row.name, excluded: false })}>
                      They now include it
                    </button>
                  </>
                )}
              </td>
            )
          })}
        </tr>
      ))}
      <tr>
        <td style={{ ...td, fontSize: '0.85rem', color: 'var(--text-muted)' }}>From an emailed quote</td>
        {bidders.map((inv) => (
          <td key={inv.id} style={td}>
            <AddExclusion trade={pkg.trade} onAdd={(name, unitPrice) => dispatch({ type: 'setQuoteExclusion', ...ids, inviteId: inv.id, name, excluded: true, ...(unitPrice ? { unitPrice } : {}) })} />
          </td>
        ))}
      </tr>
    </>
  )
}

/** "+ Exclusion from their quote": a name (the trade's usual ones offered) and an optional unit price. */
function AddExclusion({ trade, onAdd }: { trade: string; onAdd: (name: string, unitPrice?: { amount: number; unit: string }) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const listId = `gc-exclusions-${trade.replace(/\W+/g, '-')}`
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8rem', color: 'var(--text-blue-500)', cursor: 'pointer' }}>
        + Exclusion from their quote
      </button>
    )
  }
  const price = Number(amount) > 0 && unit.trim() ? { amount: Number(amount), unit: unit.trim() } : undefined
  return (
    <span style={{ display: 'grid', gap: '0.3rem' }}>
      <input list={listId} style={{ ...input, width: '100%', boxSizing: 'border-box' }} placeholder="What it leaves out" value={name} onChange={(e) => setName(e.target.value)} aria-label="What their quote leaves out" />
      <datalist id={listId}>
        {exclusionsFor(trade).map((n) => (
          <Fragment key={n}>
            <option value={n} />
          </Fragment>
        ))}
      </datalist>
      <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        $<input type="number" min={0} style={{ ...input, width: '4.5rem' }} placeholder="price" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Unit price if it comes up" />
        per
        <input style={{ ...input, width: '3.5rem' }} placeholder="cy" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit" />
        <span>(optional)</span>
      </span>
      <span style={{ display: 'flex', gap: '0.3rem' }}>
        <Btn
          kind="primary"
          disabled={name.trim() === ''}
          onClick={() => {
            onAdd(name.trim(), price)
            setName('')
            setAmount('')
            setUnit('')
            setOpen(false)
          }}
        >
          Add
        </Btn>
        <Btn kind="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Btn>
      </span>
    </span>
  )
}
