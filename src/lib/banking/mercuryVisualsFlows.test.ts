import { describe, expect, it } from 'vitest'
import {
  buildCardsJobsSankey,
  buildMoneyFlowSankey,
  buildTransferSankey,
  filterVisualsTxs,
  pairInternalTransfers,
  visualsPeriodStartYmd,
  type VisualsTxRow,
} from './mercuryVisualsFlows'

function tx(partial: Partial<VisualsTxRow> & Pick<VisualsTxRow, 'id' | 'amount'>): VisualsTxRow {
  return { kind: 'debitCardTransaction', postedYmd: '2026-08-10', accountId: 'acct-1', isDuplicate: false, ...partial }
}

describe('visualsPeriodStartYmd / filterVisualsTxs', () => {
  it('computes month, quarter, and ytd starts from the app-tz wall date', () => {
    expect(visualsPeriodStartYmd('month', '2026-08-16')).toBe('2026-08-01')
    expect(visualsPeriodStartYmd('quarter', '2026-08-16')).toBe('2026-07-01')
    expect(visualsPeriodStartYmd('quarter', '2026-01-05')).toBe('2026-01-01')
    expect(visualsPeriodStartYmd('ytd', '2026-08-16')).toBe('2026-01-01')
    expect(visualsPeriodStartYmd('all', '2026-08-16')).toBeNull()
  })

  it('always drops duplicates; bounded periods drop unknown dates', () => {
    const rows = [
      tx({ id: 'keep', amount: -5, postedYmd: '2026-08-02' }),
      tx({ id: 'dup', amount: -5, isDuplicate: true }),
      tx({ id: 'old', amount: -5, postedYmd: '2026-06-30' }),
      tx({ id: 'undated', amount: -5, postedYmd: '' }),
    ]
    expect(filterVisualsTxs(rows, 'quarter', '2026-08-16').map((t) => t.id)).toEqual(['keep'])
    expect(filterVisualsTxs(rows, 'all', '2026-08-16').map((t) => t.id)).toEqual(['keep', 'old', 'undated'])
  })
})

describe('buildMoneyFlowSankey', () => {
  const labelOf = (entries: [string, string][]) => new Map(entries)

  it('routes labeled spend through its family to the label, skipping transfers', () => {
    const txs = [
      tx({ id: 'i1', amount: 1000 }),
      tx({ id: 'e1', amount: -600 }),
      tx({ id: 'e2', amount: -100 }),
      tx({ id: 't1', amount: -50 }),
    ]
    const r = buildMoneyFlowSankey({
      txs,
      labelNameByTxId: labelOf([
        ['i1', 'Income'],
        ['e1', 'Contract Labor'],
        ['e2', 'Fuel / Gas'],
        ['t1', 'Internal Transfers'],
      ]),
    })
    expect(r.totalIn).toBe(1000)
    expect(r.totalOut).toBe(700)
    expect(r.kept).toBe(300)
    expect(r.fromReserves).toBe(0)
    const ids = r.input.nodes.map((n) => n.id)
    expect(ids).toContain('fam:People')
    expect(ids).toContain('label:Contract Labor')
    expect(ids).toContain('fam:kept')
    expect(ids.some((id) => id.includes('Internal'))).toBe(false)
    // Family and its label carry the same tone (color follows the entity).
    const fam = r.input.nodes.find((n) => n.id === 'fam:People')!
    const label = r.input.nodes.find((n) => n.id === 'label:Contract Labor')!
    expect(label.tone).toBe(fam.tone)
    // Click-through: fam→label and in→fam ribbons both carry the expense tx ids.
    expect(r.input.links.find((l) => l.target === 'label:Contract Labor')?.txIds).toEqual(['e1'])
    expect(r.input.links.find((l) => l.source === 'in:income' && l.target === 'fam:People')?.txIds).toEqual(['e1'])
  })

  it('grows a From reserves inflow when spend exceeds money in', () => {
    const r = buildMoneyFlowSankey({
      txs: [tx({ id: 'i1', amount: 100 }), tx({ id: 'e1', amount: -180 })],
      labelNameByTxId: labelOf([
        ['i1', 'Income'],
        ['e1', 'Wages'],
      ]),
    })
    expect(r.fromReserves).toBe(80)
    expect(r.input.nodes.find((n) => n.id === 'in:reserves')?.value).toBe(80)
    // Inflow links conserve: sum of col0→col1 links equals total out.
    const inflowLinks = r.input.links.filter((l) => l.source.startsWith('in:'))
    expect(inflowLinks.reduce((s, l) => s + l.value, 0)).toBeCloseTo(180, 5)
  })

  it('buckets unlabeled and unknown-label spend without breaking', () => {
    const r = buildMoneyFlowSankey({
      txs: [tx({ id: 'e1', amount: -40 }), tx({ id: 'e2', amount: -60 })],
      labelNameByTxId: labelOf([['e2', 'Custom Org Label']]),
    })
    expect(r.unlabeledOut).toBe(40)
    expect(r.input.nodes.find((n) => n.id === 'fam:Unlabeled')?.value).toBe(40)
    expect(r.input.nodes.find((n) => n.id === 'fam:Other')?.value).toBe(60)
  })

  it('folds labels beyond the family top-4 into an Other band', () => {
    const labels: [string, string][] = [
      ['a', 'Advertising'],
      ['b', 'Insurance'],
      ['c', 'Utilities'],
      ['d', 'Travel'],
      ['e', 'Meals'],
      ['f', 'Office Expense'],
    ]
    const txs = labels.map(([id], i) => tx({ id, amount: -(100 - i) }))
    const r = buildMoneyFlowSankey({ txs, labelNameByTxId: labelOf(labels) })
    const overheadLabels = r.input.nodes.filter((n) => n.col === 2)
    expect(overheadLabels).toHaveLength(5)
    const other = r.input.nodes.find((n) => n.id === 'label:other-Overhead')!
    expect(other.value).toBeCloseTo(96 + 95, 5)
  })
})

describe('pairInternalTransfers / buildTransferSankey', () => {
  it('pairs opposite legs of the same amount across accounts within the day gap', () => {
    const txs = [
      tx({ id: 'o1', kind: 'internalTransfer', amount: -500, accountId: 'A', postedYmd: '2026-08-01' }),
      tx({ id: 'i1', kind: 'internalTransfer', amount: 500, accountId: 'B', postedYmd: '2026-08-02' }),
      tx({ id: 'o2', kind: 'internalTransfer', amount: -75.25, accountId: 'B', postedYmd: '2026-08-05' }),
      tx({ id: 'i2', kind: 'internalTransfer', amount: 75.25, accountId: 'C', postedYmd: '2026-08-05' }),
    ]
    const p = pairInternalTransfers(txs)
    expect(p.pairs).toHaveLength(2)
    expect(p.pairs.find((x) => x.amount === 500)).toMatchObject({ fromAccountId: 'A', toAccountId: 'B' })
    expect(p.unpairedOut).toHaveLength(0)
    expect(p.unpairedIn).toHaveLength(0)
  })

  it('never pairs same-account or far-apart legs; leftovers are reported', () => {
    const txs = [
      tx({ id: 'o1', kind: 'internalTransfer', amount: -100, accountId: 'A', postedYmd: '2026-08-01' }),
      tx({ id: 'i1', kind: 'internalTransfer', amount: 100, accountId: 'A', postedYmd: '2026-08-01' }),
      tx({ id: 'o2', kind: 'internalTransfer', amount: -200, accountId: 'A', postedYmd: '2026-08-01' }),
      tx({ id: 'i2', kind: 'internalTransfer', amount: 200, accountId: 'B', postedYmd: '2026-08-20' }),
    ]
    const p = pairInternalTransfers(txs)
    expect(p.pairs).toHaveLength(0)
    expect(p.unpairedOut).toHaveLength(2)
    expect(p.unpairedIn).toHaveLength(2)
  })

  it('nets edges per direction and keeps one stable tone per account', () => {
    const rows = [
      tx({ id: 'o1', kind: 'internalTransfer', amount: -500, accountId: 'A', postedYmd: '2026-08-01' }),
      tx({ id: 'i1', kind: 'internalTransfer', amount: 500, accountId: 'B', postedYmd: '2026-08-01' }),
      tx({ id: 'o2', kind: 'internalTransfer', amount: -300, accountId: 'A', postedYmd: '2026-08-03' }),
      tx({ id: 'i2', kind: 'internalTransfer', amount: 300, accountId: 'B', postedYmd: '2026-08-03' }),
    ]
    const r = buildTransferSankey({ txs: rows, pairing: pairInternalTransfers(rows), accountLabelById: (id) => `Acct ${id}` })
    expect(r.pairedTotal).toBe(800)
    const edge = r.input.links.find((l) => l.source === 'acct-in:A' && l.target === 'acct-out:B')
    expect(edge?.value).toBe(800)
    // Click-through: the edge carries only the OUT leg of each transfer, so the
    // drill-down total matches the ribbon value instead of doubling it.
    expect([...(edge?.txIds ?? [])].sort()).toEqual(['o1', 'o2'])
    // Tones are assigned alphabetically and follow the account on both sides.
    const inA = r.input.nodes.find((n) => n.id === 'acct-in:A')!
    const outB = r.input.nodes.find((n) => n.id === 'acct-out:B')!
    expect(inA.tone).toBe('series1')
    expect(outB.tone).toBe('series2')
    // A funded its transfers from nowhere visible → an explicit From balances band.
    expect(r.input.links.find((l) => l.source === 'in:balance' && l.target === 'acct-in:A')?.value).toBe(800)
    // B received and spent nothing externally → the money shows as kept.
    expect(r.input.links.find((l) => l.source === 'acct-out:B' && l.target === 'out:kept')?.value).toBe(800)
  })

  it('flanks the transfer core with external in/out and a same-account passthrough', () => {
    const rows = [
      // $1,000 check lands in A; $600 transfers A→B; A spends $150 on a card;
      // B pays out $500. A's leftover $250 passes through A and is kept.
      tx({ id: 'd1', kind: 'checkDeposit', amount: 1000, accountId: 'A', postedYmd: '2026-08-01' }),
      tx({ id: 'o1', kind: 'internalTransfer', amount: -600, accountId: 'A', postedYmd: '2026-08-02' }),
      tx({ id: 'i1', kind: 'internalTransfer', amount: 600, accountId: 'B', postedYmd: '2026-08-02' }),
      tx({ id: 'c1', kind: 'debitCardTransaction', amount: -150, accountId: 'A', postedYmd: '2026-08-03' }),
      tx({ id: 'p1', kind: 'outgoingPayment', amount: -500, accountId: 'B', postedYmd: '2026-08-04' }),
    ]
    const r = buildTransferSankey({ txs: rows, pairing: pairInternalTransfers(rows), accountLabelById: (id) => `Acct ${id}` })
    expect(r.externalInTotal).toBe(1000)
    expect(r.externalOutTotal).toBe(650)
    // Source → account, clickable with the deposit tx.
    const dep = r.input.links.find((l) => l.source === 'in:Check deposits' && l.target === 'acct-in:A')
    expect(dep?.value).toBe(1000)
    expect(dep?.txIds).toEqual(['d1'])
    // Account → use, grouped by kind.
    expect(r.input.links.find((l) => l.source === 'acct-out:A' && l.target === 'out:Card spend')?.txIds).toEqual(['c1'])
    expect(r.input.links.find((l) => l.source === 'acct-out:B' && l.target === 'out:Payments out')?.value).toBe(500)
    // A's passthrough carries what it kept + spent itself: 1000 − 600 = 400.
    expect(r.input.links.find((l) => l.source === 'acct-in:A' && l.target === 'acct-out:A')?.value).toBe(400)
    // Kept: A 400 − 150 = 250; B 600 − 500 = 100.
    const keptLinks = r.input.links.filter((l) => l.target === 'out:kept')
    expect(keptLinks.find((l) => l.source === 'acct-out:A')?.value).toBe(250)
    expect(keptLinks.find((l) => l.source === 'acct-out:B')?.value).toBe(100)
    // Both sides of every account balance — no From balances band needed here.
    expect(r.input.nodes.find((n) => n.id === 'in:balance')).toBeUndefined()
    // Synthetic bands are not clickable.
    expect(r.input.links.find((l) => l.source === 'acct-in:A' && l.target === 'acct-out:A')?.txIds).toBeUndefined()
  })

  it('unpaired transfer legs surface as their own source/use group', () => {
    const rows = [
      tx({ id: 'o1', kind: 'internalTransfer', amount: -200, accountId: 'A', postedYmd: '2026-08-01' }),
    ]
    const r = buildTransferSankey({ txs: rows, pairing: pairInternalTransfers(rows), accountLabelById: (id) => `Acct ${id}` })
    const un = r.input.links.find((l) => l.source === 'acct-out:A' && l.target === 'out:Unmatched transfer legs')
    expect(un?.value).toBe(200)
    expect(un?.txIds).toEqual(['o1'])
    // Unmatched legs are not counted as external money out.
    expect(r.externalOutTotal).toBe(0)
  })
})

describe('buildCardsJobsSankey', () => {
  it('splits card spend to jobs by allocation and sends the remainder to No job yet', () => {
    const r = buildCardsJobsSankey({
      txs: [
        tx({ id: 't1', amount: -100 }),
        tx({ id: 't2', amount: -50 }),
        tx({ id: 'not-card', amount: -75, kind: 'outgoingPayment' }),
      ],
      personLabelByTxId: new Map([
        ['t1', 'Abraham'],
        ['t2', null],
      ]),
      allocationsByTxId: new Map([['t1', [{ jobId: 'j1', amount: 60 }]]]),
      jobLabelById: (id) => `Job ${id}`,
    })
    expect(r.spendTotal).toBe(150)
    expect(r.txCount).toBe(2)
    expect(r.noJobTotal).toBe(90)
    const abraham = r.input.links.filter((l) => l.source === 'person:Abraham')
    expect(abraham.find((l) => l.target === 'job:j1')?.value).toBe(60)
    expect(abraham.find((l) => l.target === 'job:none')?.value).toBe(40)
    expect(r.input.links.find((l) => l.source === 'person:No person')?.target).toBe('job:none')
    // Click-through: each ribbon knows its transactions, deduplicated.
    expect(abraham.find((l) => l.target === 'job:j1')?.txIds).toEqual(['t1'])
    expect(abraham.find((l) => l.target === 'job:none')?.txIds).toEqual(['t1'])
    expect(r.input.links.find((l) => l.source === 'person:No person')?.txIds).toEqual(['t2'])
  })

  it('allocation amounts never exceed the transaction total', () => {
    const r = buildCardsJobsSankey({
      txs: [tx({ id: 't1', amount: -100 })],
      personLabelByTxId: new Map([['t1', 'Paige']]),
      allocationsByTxId: new Map([['t1', [{ jobId: 'j1', amount: 80 }, { jobId: 'j2', amount: 80 }]]]),
      jobLabelById: (id) => id,
    })
    const links = r.input.links
    expect(links.find((l) => l.target === 'job:j1')?.value).toBe(80)
    expect(links.find((l) => l.target === 'job:j2')?.value).toBe(20)
    expect(r.noJobTotal).toBe(0)
  })

  it('No job yet pins last and wears the warn tone; extra jobs fold with a count', () => {
    const txs = [
      tx({ id: 'p', amount: -700 }),
      ...Array.from({ length: 7 }, (_, i) => tx({ id: `t${i}`, amount: -100 })),
    ]
    const personLabelByTxId = new Map<string, string | null>(txs.map((t) => [t.id, 'Abraham']))
    const allocationsByTxId = new Map<string, { jobId: string; amount: number }[]>(
      Array.from({ length: 7 }, (_, i) => [`t${i}`, [{ jobId: `j${i}`, amount: 100 }]]),
    )
    const r = buildCardsJobsSankey({ txs, personLabelByTxId, allocationsByTxId, jobLabelById: (id) => id })
    const jobNodes = r.input.nodes.filter((n) => n.col === 1)
    expect(jobNodes[jobNodes.length - 1]!.id).toBe('job:none')
    expect(jobNodes[jobNodes.length - 1]!.tone).toBe('warn')
    expect(jobNodes[jobNodes.length - 2]!.label).toBe('Other jobs (2)')
  })
})
