import { describe, expect, it } from 'vitest'
import { retainageHeldNow, tradeCloseout } from './building'
import { drawsToPay } from './buildingPay'
import { sowMoney } from './bids'
import { drawCameInPayload, drawExtras, linePercents, NO_DRAWS, withDraws, withTradeChanges, type DrawTables } from './drawRows'
import { initialGcState } from './schedule/testState'
import type { ChangeOrder, GcProject, GcState, Sow } from './types'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

/** A line's own row id: a scope line's row carries its scope item, a change order's line is its own. */
const rowIdOf = (sovId: string, changeOrder: boolean) => (changeOrder ? sovId : `row-${sovId}`)

/** A project's statements of work as the tables would hold them, from the prototype's shapes. */
function rowsOf(project: GcProject): DrawTables {
  const t: DrawTables = { sows: [], sowLines: [], draws: [], drawLines: [], reports: [], backCharges: [], tradeSends: [] }
  let seq = 0
  for (const pkg of project.packages) {
    const sow = pkg.sow
    if (!sow) continue
    const sowId = `sow-${pkg.id}`
    t.sows.push({ id: sowId, package_id: pkg.id })
    const rowOf = new Map(sow.sov.map((l) => [l.id, rowIdOf(l.id, Boolean(l.changeOrderId))]))
    sow.sov.forEach((l, i) => {
      t.sowLines.push({ id: rowOf.get(l.id)!, sow_id: sowId, position: i, scope_item_id: l.changeOrderId ? null : l.id })
      if (l.pctReported > 0) t.reports.push({ id: `rep-${l.id}`, sow_line_id: rowOf.get(l.id)!, pct: l.pctReported, reported_on: '2026-09-01', company_id: 'c', recorded_by: null, created_at: '2026-09-01T00:00:00Z', seq: (seq += 1) })
    })
    const taken = (drawId: string) => (sow.backCharges ?? []).filter((c) => c.taken?.drawId === drawId).reduce((s, c) => s + c.amount, 0)
    const push = (d: Sow['draws'][number], status: string, back?: NonNullable<Sow['sentBack']>[number]) => {
      t.draws.push({
        id: d.id,
        sow_id: sowId,
        number: d.number,
        requested_on: d.requestedOn,
        status,
        gross: d.gross,
        retainage: d.retainage,
        net: d.net + taken(d.id),
        final: d.final === true,
        waiver: d.waiver,
        waiver_on: d.waiver === 'unconditional' ? (d.paidOn ?? '2026-09-30') : null,
        approved_on: d.approvedOn ?? null,
        paid_on: d.paidOn ?? null,
        asked: d.asked ? { ...d.asked, lines: d.asked.lines.map((l) => ({ line: rowOf.get(l.sovId), toPct: l.toPct, stored: l.stored ?? 0 })) } : null,
        sent_back_on: back ? back.on : null,
        sent_back_note: back ? back.note : null,
        period_to: d.payApp?.periodTo ?? '',
        address: d.payApp?.address ?? '',
        license: d.payApp?.license ?? '',
        signed_by: d.payApp?.signedBy ?? '',
        signed_title: d.payApp?.signedTitle ?? '',
        signed_on: d.payApp?.signedOn ?? '',
        file_name: null,
        drive_url: null,
        recorded_by: null,
        created_at: '2026-09-01T00:00:00Z',
        seq: (seq += 1),
      })
      for (const l of d.lines) {
        const weSee = back?.lines.find((x) => x.sovId === l.sovId)?.weSee ?? null
        t.drawLines.push({ draw_id: d.id, sow_line_id: rowOf.get(l.sovId)!, to_pct: l.toPct, stored: l.stored ?? 0, we_see: weSee })
      }
    }
    for (const back of sow.sentBack ?? []) push(back.draw, 'sent_back', back)
    for (const d of sow.draws) push(d, d.status)
    for (const c of sow.backCharges ?? []) {
      t.backCharges.push({
        id: c.id, project_id: project.id, package_id: pkg.id, company_id: 'c', sow_id: sowId, amount: c.amount, reason: c.reason, photo_url: c.photo,
        sent_on: c.sentOn, answer_by: c.answerBy, status: c.status, answered_on: c.answer?.on ?? null, answer_note: c.answer?.note ?? null,
        settled_on: c.settled?.on ?? null, settled_note: c.settled?.note ?? null, settled_by: null,
        taken_draw_id: c.taken?.drawId ?? null, taken_on: c.taken?.on ?? null, created_by: null, created_at: '2026-09-01T00:00:00Z',
      })
    }
  }
  // A draw's rows come back in no order, as a read may give them.
  return { ...t, draws: [...t.draws].reverse(), drawLines: [...t.drawLines].reverse(), reports: [...t.reports].reverse() }
}

/** The board's statements of work before the money is laid over them, as `sowOf` maps them. */
function withoutMoney(state: GcState): GcState {
  return {
    ...state,
    projects: state.projects.map((p) => ({
      ...p,
      packages: p.packages.map((k) => {
        if (!k.sow) return k
        const { sentBack: _sentBack, backCharges: _backCharges, ...sow } = k.sow
        return { ...k, sow: { ...sow, draws: [], sov: sow.sov.map((l) => ({ ...l, pctReported: 0, pctBilled: 0 })) } }
      }),
    })),
  }
}

describe('the trades’ money from its rows', () => {
  it('reads Fair Oaks D’s statements of work back as the prototype holds them', () => {
    const state = initialGcState()
    const read = withDraws(withoutMoney(state), rowsOf(fairOaks(state)))
    for (const pkg of fairOaks(state).packages) {
      if (!pkg.sow) continue
      expect(fairOaks(read).packages.find((k) => k.id === pkg.id)?.sow, pkg.trade).toEqual(pkg.sow)
    }
  })

  it('gives the kernels the same money: billed, held, to pay and closeout', () => {
    const state = initialGcState()
    const read = withDraws(withoutMoney(state), rowsOf(fairOaks(state)))
    const words = (s: GcState) =>
      fairOaks(s).packages.flatMap((k) =>
        k.sow ? [`${k.trade}: ${JSON.stringify(sowMoney(k.sow))} held ${retainageHeldNow(k.sow)} next ${tradeCloseout(k.sow, fairOaks(s), s.today).next?.key ?? 'closed'}`] : [],
      )
    expect(words(read)).toEqual(words(state))
    expect(drawsToPay(read, fairOaks(read))).toEqual(drawsToPay(state, fairOaks(state)))
  })

  it('counts a back-charge off the draw it was taken from, as takeBackCharge leaves it', () => {
    const state = initialGcState()
    const tables = rowsOf(fairOaks(state))
    const steelDraw = tables.draws.find((d) => d.sow_id === 'sow-fsteel' && d.number === 1)!
    const charge = tables.backCharges.find((c) => c.sow_id === 'sow-fsteel')!
    const taken = { ...tables, backCharges: tables.backCharges.map((c) => (c.id === charge.id ? { ...c, taken_draw_id: steelDraw.id, taken_on: '2026-10-01' } : c)) }
    const sow = fairOaks(withDraws(withoutMoney(state), taken)).packages.find((k) => k.id === 'fsteel')!.sow!
    const draw = sow.draws.find((d) => d.number === 1)!
    expect(draw.backCharges).toEqual([{ chargeId: charge.id, amount: Number(charge.amount) }])
    expect(draw.net).toBe(Number(steelDraw.net) - Number(charge.amount))
    expect(sow.backCharges?.find((c) => c.id === charge.id)?.taken).toEqual({ drawId: steelDraw.id, on: '2026-10-01' })
  })

  it('leaves a board with no money as it was', () => {
    const state = withoutMoney(initialGcState())
    expect(withDraws(state, NO_DRAWS)).toEqual(state)
    expect(withTradeChanges(state, NO_DRAWS)).toBe(state)
  })

  it('says a status or a waiver the app does not know in words', () => {
    const state = initialGcState()
    const tables = rowsOf(fairOaks(state))
    const bad = { ...tables, draws: tables.draws.map((d, i) => (i === 0 ? { ...d, status: 'lost' } : d)) }
    expect(() => withDraws(withoutMoney(state), bad)).toThrow('A draw\'s status reads "lost", which the app does not know.')
  })
})

describe('a change order’s trade side, and what rides beside the kernel', () => {
  it('lays each sent change over its change order, with the line it became once signed', () => {
    // Two change orders the customer signed on Concrete: a credit, and an add.
    const co = (id: string, number: number, cost: number): ChangeOrder => ({
      id, number, description: 'Leave out the curb', reason: 'owner', schedule: 'none', packageId: 'fconc', cost, price: cost * 1.1,
      status: 'signed', sentOn: '2026-09-28', answeredOn: '2026-09-30', pctDone: 0,
    })
    const base = initialGcState()
    const state: GcState = { ...base, projects: base.projects.map((p) => (p.id === 'fairoaksd' ? { ...p, changeOrders: [co('co-1', 1, -2000), co('co-2', 2, 1500)] } : p)) }
    const [first, second] = fairOaks(state).changeOrders ?? []
    const tables: DrawTables = {
      ...NO_DRAWS,
      sowLines: [{ id: 'co-line-1', sow_id: 'sow-fconc', position: 3, scope_item_id: null }],
      tradeSends: [
        { change_order_id: first!.id, sow_id: 'sow-fconc', sent_on: '2026-10-01', sent_by: null, signed_on: '2026-10-03', sow_line_id: 'co-line-1', recorded_by: null, file_name: null, drive_url: null },
        { change_order_id: second!.id, sow_id: 'sow-fconc', sent_on: '2026-10-05', sent_by: null, signed_on: null, sow_line_id: null, recorded_by: null, file_name: null, drive_url: null },
      ],
    }
    const cos = fairOaks(withTradeChanges(state, tables)).changeOrders ?? []
    expect(cos.find((c) => c.id === first!.id)?.tradeChange).toEqual({ status: 'signed', sentOn: '2026-10-01', signedOn: '2026-10-03', sovLineId: 'co-line-1' })
    expect(cos.find((c) => c.id === second!.id)?.tradeChange).toEqual({ status: 'sent', sentOn: '2026-10-05', signedOn: null, sovLineId: '' })
  })

  it('keeps each draw’s file and who of ours recorded it', () => {
    const tables = rowsOf(fairOaks(initialGcState()))
    const one = tables.draws[0]!
    const extras = drawExtras({ ...tables, draws: [{ ...one, file_name: 'RCC-pay-2.pdf', drive_url: 'https://drive.google.com/x', recorded_by: 'u1' }] })
    expect(extras.get(one.id)).toEqual({ fileName: 'RCC-pay-2.pdf', driveUrl: 'https://drive.google.com/x', recordedBy: 'u1' })
  })
})

describe('what the presses send', () => {
  it('records a pay application that came by email: percents held to 0 to 100, stored in whole dollars, the words trimmed', () => {
    expect(
      drawCameInPayload({
        packageId: 'k',
        lines: [
          { sovId: 'a', toPct: 120, stored: 0 },
          { sovId: 'b', toPct: 40, stored: 2500.4 },
          { sovId: 'c', toPct: Number.NaN, stored: 0 },
        ],
        periodTo: '2026-10-09',
        address: ' 12 Mill Rd ',
        license: ' TX-4471 ',
        signedBy: ' Pat Ridgeway ',
        signedTitle: ' Owner ',
        fileName: ' RCC-pay-2.pdf ',
        driveUrl: '  ',
      }),
    ).toEqual({
      lines: [
        { line: 'a', toPct: 100 },
        { line: 'b', toPct: 40, stored: 2500 },
      ],
      periodTo: '2026-10-09',
      address: '12 Mill Rd',
      license: 'TX-4471',
      signedBy: 'Pat Ridgeway',
      signedTitle: 'Owner',
      fileName: 'RCC-pay-2.pdf',
    })
  })

  it('sends the percents we approve or see, by line, each from 0 to 100', () => {
    expect(linePercents({ a: 90, b: -5, c: 101, d: Number.NaN })).toEqual({ a: 90, b: 0, c: 100 })
  })
})
