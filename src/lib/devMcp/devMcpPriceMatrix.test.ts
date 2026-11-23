import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  PRICER_KEY_SELECT,
  PRICER_SEAT_SELECT,
  PRICE_MATRIX_ASK_SELECT,
  PRICE_MATRIX_RFQ_SELECT,
  isPriceMatrixVerb,
  priceMatrixAppliedWords,
  priceMatrixDryRun,
  priceMatrixInput,
  priceMatrixTakeBackPatch,
  priceMatrixTakeBackQuery,
  pricerSeats,
  readPriceMatrixWorld,
  type PriceMatrixAskRow,
  type PriceMatrixPayload,
  type PriceMatrixWorld,
} from '../../../supabase/functions/_shared/devMcpPriceMatrix'
import type { BidPricesWorld } from '../../../supabase/functions/_shared/devMcpBidPrices'
import { openPricing, type PricingReader } from '../../../supabase/functions/_shared/devMcpBidPricing'
import type { PriceRequestLinkRow } from '../../../supabase/functions/_shared/priceMatrixAsk'
import * as sharedAsk from '../../../supabase/functions/_shared/priceMatrixAsk'
import { WRITE_VERBS, alreadyApplied, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import * as clientAsk from '../rfq/priceMatrixRequest'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const MODAL = readFileSync('src/components/bids/PriceWithRobotModal.tsx', 'utf8')

// A made-up bid, made-up houses and made-up links: no real name, number or address.
const BID = 'eeeeeeee-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const TRADE = 'bbbbbbbb-1111-4111-8111-111111111111'
const OWN = 'aaaaaaaa-0000-4000-8000-00000000000a'
const HOUSE_A = 'cccccccc-0000-4000-8000-00000000000a'
const HOUSE_B = 'cccccccc-0000-4000-8000-00000000000b'
const rfqId = (n: number) => `dddddddd-0000-4000-8000-00000000000${n}`
const ASK = '99999999-0000-4000-8000-000000000001'

const bidRow = { id: BID, bid_number: '9001', project_name: 'Made-up office', created_by: DEV, service_type_id: TRADE, selected_bid_version_id: null, selected_price_book_version_id: null, alternate_group_tags: [], bid_date_sent: null }
const ownOpen = openPricing({ bid: bidRow, versions: [], pricings: [{ id: OWN, name: 'Default (this bid)', bid_version_id: null, is_robot: false }], templates: [], legacyRefs: [] })
const countRow = (id: string, fixture: string, count: number) => ({ id, fixture, count, unit: 'ea', page: null, group_tag: null, sequence_order: 1 })
const prices = (over: Partial<BidPricesWorld> = {}): BidPricesWorld => ({ bid: bidRow, open: ownOpen, countRows: [countRow('c1', 'Water closet', 4), countRow('c2', 'Lavatory', 3), countRow('c3', 'Spare row', 0)], entries: [], assignments: [], customPrices: [], ...over })
const rfq = (n: number, over: Partial<PriceRequestLinkRow> = {}): PriceRequestLinkRow => ({ id: rfqId(n), status: 'quoted', sent_via: 'outside', supply_house_id: HOUSE_A, sent_to: null, created_at: '2026-11-10T15:00:00Z', requested_on: '2026-11-10', request_url: null, quote_url: `https://drive.example.com/quote-${n}`, ...over })
const RFQS = [rfq(1), rfq(2, { supply_house_id: HOUSE_B }), rfq(3, { supply_house_id: null, sent_to: 'Corner Supply', quote_url: null }), rfq(4, { status: 'closed' })]
const ask = (over: Partial<PriceMatrixAskRow> = {}): PriceMatrixAskRow => ({ id: ASK, status: 'queued', requested_at: '2026-11-18T15:00:00Z', requested_by: DEV, reviewed_at: null, ...over })
const PRICER = { email: 'twin-pricer-1@twins.pipetooling.local', name: 'Twin Pricer 1', live_keys: 1 }
const world = (over: Partial<PriceMatrixWorld> = {}): PriceMatrixWorld => ({ prices: prices(), rfqs: RFQS, houseNames: { [HOUSE_A]: 'Alpha Supply', [HOUSE_B]: 'Beta Supply' }, asks: [], pricers: [PRICER], ...over })
const p = (request: Record<string, unknown> = {}): PriceMatrixPayload => {
  const built = priceMatrixInput('plan_price_matrix_request', { request: { bid_id: BID, ...request } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const queue = (request: Record<string, unknown> = {}, w: Partial<PriceMatrixWorld> = {}) => {
  const dry = priceMatrixDryRun(p(request), world(w), { userId: DEV })
  if (!dry.ok) throw new Error(dry.refused)
  if (dry.action !== 'queue') throw new Error('expected a queue plan')
  return { row: dry.row, reply: dry.reply as { scope: { rows: number; lines: unknown[]; more: number }; sources: Array<{ rfq_id: string; house_name: string }>; not_ticked: unknown[]; skipped_houses: Array<{ house_name: string }>; pricing: unknown; warnings: string[]; then: string } }
}
const refusal = (request: Record<string, unknown> = {}, w: Partial<PriceMatrixWorld> = {}): string => {
  const dry = priceMatrixDryRun(p(request), world(w), { userId: DEV })
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('an ask for the pricing robot from the dev seat (v2.7958)', () => {
  it('is two write verbs on the allowlist with no wrapper RPC', () => {
    expect(WRITE_VERBS.plan_price_matrix_request).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_price_matrix_request).toEqual({ rpc: null, step: 'apply' })
    expect(isPriceMatrixVerb('apply_price_matrix_request')).toBe(true)
    expect(isPriceMatrixVerb('plan_robot_book_price')).toBe(false)
    expect(planVerbFor('apply_price_matrix_request')).toBe('plan_price_matrix_request')
  })

  it('takes a bid and either nothing more, the links to tick, or take_back, and never a row or a link of the caller’s', () => {
    expect(p()).toEqual({ action: 'queue', bid_id: BID, sources: null })
    expect(p({ sources: [rfqId(1).toUpperCase()] })).toEqual({ action: 'queue', bid_id: BID, sources: [rfqId(1)] })
    expect(p({ take_back: true })).toEqual({ action: 'take_back', bid_id: BID })
    const bad = (request: unknown): string => {
      const built = priceMatrixInput('plan_price_matrix_request', { request } as Record<string, unknown>)
      if (built.ok) throw new Error('expected a refusal')
      return built.error
    }
    expect(bad(undefined)).toContain('plan_price_matrix_request needs request — { bid_id')
    expect(bad({ bid_id: 'b9001' })).toContain('needs request')
    expect(bad({ bid_id: BID, scope: [{ fixture: 'x', count: 1 }] })).toContain('a request is a snapshot of it, never a list you give')
    expect(bad({ bid_id: BID, sources: [] })).toContain('sources is a list of bid_rfqs ids')
    expect(bad({ bid_id: BID, sources: ['https://drive.example.com/x'] })).toContain('every source is a bid_rfqs.id')
    expect(bad({ bid_id: BID, sources: [rfqId(1), rfqId(1)] })).toContain('named twice')
    expect(bad({ bid_id: BID, take_back: false })).toContain('take_back is true, or left out')
    expect(bad({ bid_id: BID, take_back: true, sources: [rfqId(1)] })).toContain('take_back takes no sources')
    const built = writeRpcBody('apply_price_matrix_request', { request: { bid_id: BID }, plan_hash: 'd'.repeat(64) })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { action: 'queue', bid_id: BID, sources: null } }, dryRunBody: null, target: BID, planHash: 'd'.repeat(64) })
  })

  it('queues by the window’s own rules: one kernel, and the client re-exports it', () => {
    expect(clientAsk.buildPriceMatrixScope).toBe(sharedAsk.buildPriceMatrixScope)
    expect(clientAsk.buildPriceMatrixSources).toBe(sharedAsk.buildPriceMatrixSources)
    expect(clientAsk.activePriceMatrixRequest).toBe(sharedAsk.activePriceMatrixRequest)
    expect(clientAsk.canTakeBack).toBe(sharedAsk.canTakeBack)
    expect(MODAL).toContain('const sources = useMemo(() => buildPriceMatrixSources(rfqs, houseNames), [rfqs, houseNames])')
    expect(MODAL).toContain('const scope = useMemo(() => buildPriceMatrixScope(rows), [rows])')
    expect(MODAL).toContain('disabled={busy || !supported || !loaded || selected.length === 0 || scope.length === 0}')
  })

  it('plans the snapshot the window would write: counted rows, every readable link ticked, a house with nothing linked skipped', () => {
    const { row, reply } = queue()
    expect(row).toEqual({
      bid_id: BID,
      bid_version_id: OWN, // the open pricing's id rides in bid_version_id, as the window writes it
      requested_by: DEV,
      scope: [{ count_row_id: 'c1', fixture: 'Water closet', count: 4, unit: 'ea' }, { count_row_id: 'c2', fixture: 'Lavatory', count: 3, unit: 'ea' }],
      sources: [
        { rfq_id: rfqId(1), supply_house_id: HOUSE_A, house_name: 'Alpha Supply', url: 'https://drive.example.com/quote-1', requested_on: '2026-11-10' },
        { rfq_id: rfqId(2), supply_house_id: HOUSE_B, house_name: 'Beta Supply', url: 'https://drive.example.com/quote-2', requested_on: '2026-11-10' },
      ],
      status: 'queued',
    })
    // The window's own insert carries the same six keys.
    for (const key of Object.keys(row)) expect(MODAL, key).toMatch(new RegExp(`\\n      ${key}[:,]`))
    expect(MODAL).toContain('bid_version_id: bidVersionId,')
    expect(reply.scope).toMatchObject({ rows: 2, more: 0 })
    expect(reply.pricing).toEqual({ id: OWN, name: 'Default (this bid)', version: null })
    expect(reply.not_ticked).toEqual([])
    expect(reply.skipped_houses.map((h) => h.house_name)).toEqual(['Corner Supply'])
    expect(reply.warnings).toEqual(['1 house was asked with nothing linked yet and is skipped: Corner Supply. The link goes in at Edit Bid → Files & Links → Price requests.'])
    expect(reply.then).toContain('apply writes one ask as you, as Queue it on the Price it with the robot window does: 2 quotes and 2 fixture rows, names and counts only, as they read now.')
    expect(reply.then).toContain('Nothing else is written: no email, no cost, no change to the bid.')
    expect(reply.then).toContain('Twin Pricer 1 holds a live key and claims the oldest queued ask at its next round.')
    expect(reply.then).toContain('take_back: true')
  })

  it('ticks fewer when the caller names them, and refuses a source the bid does not offer', () => {
    const { row, reply } = queue({ sources: [rfqId(2)] })
    expect((row.sources as Array<{ rfq_id: string }>).map((s) => s.rfq_id)).toEqual([rfqId(2)])
    expect(reply.not_ticked).toEqual([{ rfq_id: rfqId(1), house_name: 'Alpha Supply' }])
    // A house with nothing linked, a closed request and an id from nowhere are none of them readable.
    for (const n of [3, 4, 9]) expect(refusal({ sources: [rfqId(n)] })).toContain(`not a readable link on b9001 Made-up office: ${rfqId(n)}. The readable ones: Alpha Supply (${rfqId(1)}), Beta Supply (${rfqId(2)}).`)
  })

  it('warns when no pricing robot can claim the ask, and says so when it could not look', () => {
    const noKey = queue({}, { pricers: [{ ...PRICER, live_keys: 0 }], rfqs: [rfq(1)] })
    expect(noKey.reply.warnings).toEqual(['No pricing robot holds a live key (twin-pricer-1@twins.pipetooling.local), so the ask would wait in the queue until one is minted: mint_twin_setup_code { label, twin: "twin-pricer-1@twins.pipetooling.local" }.'])
    expect(queue({}, { pricers: [], rfqs: [rfq(1)] }).reply.warnings[0]).toContain('No pricing robot stands in the fleet')
    const blind = queue({}, { pricers: null, rfqs: [rfq(1)] })
    expect(blind.reply.warnings).toEqual([])
    expect(blind.reply.then).toContain('Whether a pricing robot holds a live key could not be read: read_twin_keys says.')
    expect(pricerSeats([{ id: 'u1', name: 'Twin Pricer 1', email: PRICER.email }, { id: 'u2', name: null, email: 'twin-pricer-2@twins.pipetooling.local' }], [{ twin_user_id: 'u1' }, { twin_user_id: 'u1' }])).toEqual([{ ...PRICER, live_keys: 2 }, { email: 'twin-pricer-2@twins.pipetooling.local', name: null, live_keys: 0 }])
    expect(PRICER_KEY_SELECT).toBe('id,twin_user_id')
    expect(`${PRICER_KEY_SELECT},${PRICER_SEAT_SELECT}`).not.toMatch(/token|hash/)
  })

  it('refuses in words: no bid, an ask already open, no counted rows, no readable link', () => {
    expect(refusal({}, { prices: prices({ bid: null }) })).toBe(`No bid ${BID} is visible to you — find_bid resolves a number or a name.`)
    expect(refusal({}, { asks: [ask()] })).toContain(`b9001 Made-up office has an ask open with the robot already: queued, waiting on the robot (asked 2026-11-18T15:00:00Z, request ${ASK}). One at a time`)
    expect(refusal({}, { asks: [ask()] })).toContain('take_back: true takes it back while it is queued.')
    expect(refusal({}, { asks: [ask({ status: 'working' })] })).toContain('It is past taking back.')
    expect(refusal({}, { asks: [ask({ status: 'ready' })] })).toContain('ready and not reviewed yet')
    // A reviewed, a done and a cancelled ask are not open: the next one may queue.
    for (const a of [ask({ status: 'ready', reviewed_at: '2026-11-19T00:00:00Z' }), ask({ status: 'done' }), ask({ status: 'cancelled' })]) expect(queue({}, { asks: [a] }).row.status).toBe('queued')
    expect(refusal({}, { prices: prices({ countRows: [countRow('c3', 'Spare row', 0)] }) })).toContain('has no counted fixture rows yet: the window\'s Queue it is dead until the takeoff has rows with a count.')
    expect(refusal({}, { prices: prices({ countRows: [], open: { ...ownOpen, pricingId: null } }) })).toContain(', and no pricing the tab would open on')
    expect(refusal({}, { rfqs: [RFQS[2]!] })).toContain('has no readable quote link: Corner Supply was asked with nothing linked yet.')
    expect(refusal({}, { rfqs: [] })).toContain('has no readable quote link: no price request is on the bid.')
  })

  it('takes a queued ask back, and nothing later', () => {
    const dry = priceMatrixDryRun(p({ take_back: true }), world({ asks: [ask()] }), { userId: DEV })
    if (!dry.ok || dry.action !== 'take_back') throw new Error('expected a take-back plan')
    expect(dry.ask.id).toBe(ASK)
    expect(dry.reply).toMatchObject({ action: 'take_back', request: { id: ASK, status: 'queued' } })
    expect(String(dry.reply.then)).toContain('as Take it back on the Price it with the robot window does')
    expect(refusal({ take_back: true })).toBe('Nothing to take back: b9001 Made-up office has no ask open with the robot.')
    expect(refusal({ take_back: true }, { asks: [ask({ status: 'working' })] })).toContain("ask is being worked by the robot. Take it back is only honest before the robot starts writing")
    expect(priceMatrixTakeBackPatch('2026-11-19T12:00:00.000Z')).toEqual({ status: 'cancelled', updated_at: '2026-11-19T12:00:00.000Z' })
    expect(priceMatrixTakeBackQuery({ id: ASK })).toBe(`id=eq.${ASK}&status=eq.queued`)
    expect(MODAL).toContain(".update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', activeRequest.id).eq('status', 'queued')")
  })

  it('the plan commits to the snapshot: a count changed, a link added or an ask made since changes the hash', async () => {
    const payload = p()
    const plan = (w: Partial<PriceMatrixWorld> = {}) => {
      const dry = priceMatrixDryRun(payload, world(w), { userId: DEV })
      if (!dry.ok) throw new Error(dry.refused)
      return dry.reply
    }
    const hash = await planHash('plan_price_matrix_request', payload, plan())
    expect(await planHash('apply_price_matrix_request', payload, plan())).toBe(hash)
    expect(await planHash('apply_price_matrix_request', payload, plan({ prices: prices({ countRows: [countRow('c1', 'Water closet', 5), countRow('c2', 'Lavatory', 3)] }) }))).not.toBe(hash)
    expect(await planHash('apply_price_matrix_request', payload, plan({ rfqs: [...RFQS, rfq(5)] }))).not.toBe(hash)
    expect(await planHash('apply_price_matrix_request', payload, plan({ pricers: [{ ...PRICER, live_keys: 0 }] }))).not.toBe(hash)
    expect(priceMatrixDryRun(payload, world({ asks: [ask()] }), { userId: DEV }).ok).toBe(false)
  })

  it('reads the bid’s price requests and asks, and the names of the houses they name', async () => {
    const asked: string[] = []
    const reader: PricingReader = {
      rows: (table, query) => {
        asked.push(`${table} ${JSON.stringify(query.filters ?? [])}`)
        if (table === 'bids') return Promise.resolve([bidRow])
        if (table === 'price_book_versions') return Promise.resolve(query.filters?.some((f) => f.column === 'bid_id' && f.op === 'eq') ? [{ id: OWN, name: 'Default (this bid)', bid_version_id: null, is_robot: false }] : [])
        if (table === 'bids_count_rows') return Promise.resolve([countRow('c1', 'Water closet', 4)])
        if (table === 'bid_rfqs') return Promise.resolve(RFQS as unknown as Record<string, unknown>[])
        if (table === 'bid_price_matrix_requests') return Promise.resolve([ask({ status: 'cancelled' })] as unknown as Record<string, unknown>[])
        if (table === 'supply_houses') return Promise.resolve([{ id: HOUSE_A, name: 'Alpha Supply' }, { id: HOUSE_B, name: 'Beta Supply' }])
        return Promise.resolve([])
      },
    }
    const w = await readPriceMatrixWorld(reader, BID)
    expect(w.rfqs).toHaveLength(4)
    expect(w.houseNames).toEqual({ [HOUSE_A]: 'Alpha Supply', [HOUSE_B]: 'Beta Supply' })
    expect(w.asks.map((a) => a.status)).toEqual(['cancelled'])
    expect(asked).toContain(`bid_rfqs ${JSON.stringify([{ column: 'bid_id', op: 'eq', value: BID }])}`)
    expect(asked).toContain(`bid_price_matrix_requests ${JSON.stringify([{ column: 'bid_id', op: 'eq', value: BID }])}`)
    expect(asked).toContain(`supply_houses ${JSON.stringify([{ column: 'id', op: 'in', value: [HOUSE_A, HOUSE_B] }])}`)
    // The columns are the tables' own, and the window reads the same of a price request.
    const cols = (t: string) => Object.keys(CATALOG_TABLES[t]?.columns ?? {})
    for (const c of PRICE_MATRIX_RFQ_SELECT.split(',')) expect(cols('bid_rfqs'), c).toContain(c)
    for (const c of [...PRICE_MATRIX_ASK_SELECT.split(','), 'bid_id', 'bid_version_id', 'scope', 'sources', 'updated_at']) expect(cols('bid_price_matrix_requests'), c).toContain(c)
    expect(MODAL).toContain('`${BASE}, sent_via, requested_on, request_url, quote_url`')
    // No bid: nothing past the bid is asked.
    asked.length = 0
    const none = await readPriceMatrixWorld({ rows: (table) => { asked.push(table); return Promise.resolve([]) } }, BID)
    expect(none.prices.bid).toBeNull()
    expect(asked).toEqual(['bids'])
  })

  it('the closing line is the window’s own toast, and says so when a robot got there first', () => {
    expect(priceMatrixAppliedWords('queue', true, { label: 'b9001 Made-up office', quotes: 2, rows: 2, requestId: ASK })).toBe(`Queued for the robot — 2 quotes, 2 fixture rows, on b9001 Made-up office (request ${ASK}). The Pricing header's chip reads Robot pricing · queued. The pricing robot claims it with next_price_matrix on the twin seat; take_back: true takes it back while it is queued.`)
    expect(MODAL).toContain("showToast(`Queued for the robot — ${selected.length} quote${selected.length === 1 ? '' : 's'}, ${scope.length} fixture rows.`, 'success')")
    expect(priceMatrixAppliedWords('queue', false, { label: 'b9001 Made-up office', heldWords: 'RLS let no row through' })).toBe('Nothing queued for b9001 Made-up office: RLS let no row through.')
    expect(priceMatrixAppliedWords('take_back', true, { label: 'b9001 Made-up office' })).toBe('Taken back — the robot will not pick this up. b9001 Made-up office has no ask open now.')
    expect(MODAL).toContain("showToast('Taken back — the robot will not pick this up.', 'success')")
    expect(priceMatrixAppliedWords('take_back', false, { label: 'x', heldWords: 'no queued row changed' })).toBe('Not taken back (no queued row changed): a robot may have claimed it a moment ago. Plan again to read where it stands.')
    expect(alreadyApplied('apply_price_matrix_request', { target: BID, at: null })).toContain('Nothing written: this plan was already applied')
  })

  it('the server declares the pair, writes the ask’s own table alone, and the docs carry the door', () => {
    for (const verb of ['plan_price_matrix_request', 'apply_price_matrix_request']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    const from = SERVER.indexOf("case 'plan_price_matrix_request':")
    const branch = SERVER.slice(from, SERVER.indexOf("case 'plan_twin_archive':", from))
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    expect(branch).toContain('world = await readPriceMatrixWorld(readerAs(session), p.bid_id)')
    expect(branch).toContain("await restRows(session, 'POST', 'bid_price_matrix_requests', 'select=id', dry.row, 'return=representation')")
    expect(branch).toContain("await restRows(session, 'PATCH', 'bid_price_matrix_requests', `${priceMatrixTakeBackQuery(dry.ask)}&select=id`, priceMatrixTakeBackPatch(new Date().toISOString()), 'return=representation')")
    expect(branch.match(/restRows\(/g)).toHaveLength(2) // the ask and its take-back: no bid, no quote, no cost
    expect(branch).toContain("await restGet(session, 'twin_credentials', `select=${PRICER_KEY_SELECT}&twin_user_id=in.(")
    expect(branch).not.toContain('token_hash')
    expect(branch).toContain('if (fresh !== built.planHash) return refused(planMismatch(')
    expect(branch).toContain('const prior = await hooks.priorApply(name, fresh)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.129.0'")
    expect(SERVER).toContain('Writes are one hundred and fifty-six verbs and nothing else')
    expect(SERVER).toContain('plan_price_matrix_request → apply_price_matrix_request (a bid put on the pricing robot\'s queue')
    expect(README).toContain('| `plan_price_matrix_request(request)` · `apply_price_matrix_request(request, plan_hash)` |')
    expect(README).toContain("one hundred and forty-one since v2.7958's price matrix pair")
    expect(README).toContain('one hundred and fifty-six `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain('v2.7958 (server 0.114.0) — a bid put on the pricing robot\'s queue')
  })
})
