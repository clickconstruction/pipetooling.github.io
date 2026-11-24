// Invented supply house bill lines for #298. Every house, code, number, price and count is made up.
// The parts are real kinds of plumbing parts with invented makers and invented numbers.
const TODAY = '2026-11-24'
const day = (n) => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const gid = (g, n) => `00000000-0000-4194-${g}-${String(n).padStart(12, '0')}`
const PLUMBING = gid('8003', 1)
const JOBS = [1, 2, 3, 4, 5].map((n) => gid('8002', n))
let seed = 298
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const fold = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

const HOUSES = [
  { id: gid('9298', 1), name: 'Sample Supply Co.', prefix: 'SS', phone: '(512) 555-0141' },
  { id: gid('9298', 2), name: 'Invented Pipe & Supply', prefix: 'IP', phone: '(512) 555-0142' },
  { id: gid('9298', 3), name: 'Placeholder Plumbing Supply', prefix: 'PL', phone: '(512) 555-0143' },
]

// Families: the words a house prints, a unit, a price for the smallest size, and how the price grows with size.
const S4 = ['1-1/2', '2', '3', '4'], C4 = ['1/2', '3/4', '1', '1-1/4'], P3 = ['1/2', '3/4', '1'], V5 = ['1/2', '3/4', '1', '1-1/2', '2'], N3 = ['2', '3', '4']
const FAM = [
  ['PVC DWV 90 ELL HXH', S4, 'EA', 1.9, 2.1], ['PVC DWV 45 ELL HXH', S4, 'EA', 1.7, 2.1], ['PVC DWV SAN TEE HXHXH', S4, 'EA', 2.8, 2.2], ['PVC DWV COUPLING HXH', S4, 'EA', 1.1, 2.0],
  ['PVC DWV WYE HXHXH', S4, 'EA', 3.9, 2.2], ['PVC DWV CLEANOUT ADPT W/ PLUG', S4, 'EA', 3.2, 2.0], ['PVC DWV LONG SWEEP 90', S4, 'EA', 3.4, 2.2], ['PVC DWV P-TRAP W/ UNION', ['1-1/2', '2'], 'EA', 6.4, 1.6],
  ['PVC SCH40 DWV PIPE 10FT', S4, 'FT', 1.35, 1.9], ['PVC DWV TEST CAP', S4, 'EA', 0.6, 1.7], ['PVC DWV FEMALE ADPT HXFIP', S4, 'EA', 2.2, 2.0], ['PVC DWV REDUCING BUSHING', ['2', '3', '4'], 'EA', 2.4, 1.9],
  ['COPPER 90 ELL CXC', C4, 'EA', 0.95, 2.2], ['COPPER 45 ELL CXC', C4, 'EA', 1.3, 2.2], ['COPPER TEE CXCXC', C4, 'EA', 1.7, 2.3], ['COPPER COUPLING CXC', C4, 'EA', 0.6, 2.1],
  ['COPPER MALE ADPT CXM', C4, 'EA', 2.1, 2.1], ['COPPER FEMALE ADPT CXF', C4, 'EA', 2.6, 2.1], ['COPPER CAP', C4, 'EA', 0.7, 2.0], ['TYPE L HARD COPPER TUBE 20FT', C4, 'FT', 3.84, 1.8],
  ['TYPE M HARD COPPER TUBE 20FT', C4, 'FT', 2.95, 1.8], ['COPPER TUBE STRAP', C4, 'EA', 0.35, 1.5],
  ['PEX-A TUBING 100FT COIL RED', P3, 'FT', 0.62, 1.8], ['PEX-A TUBING 100FT COIL BLUE', P3, 'FT', 0.62, 1.8], ['PEX EXPANSION SLEEVE', P3, 'EA', 0.55, 1.7], ['PEX BRASS 90 ELL', P3, 'EA', 3.1, 1.8],
  ['PEX BRASS TEE', P3, 'EA', 4.2, 1.8], ['PEX BRASS COUPLING', P3, 'EA', 2.3, 1.8], ['PEX BRASS MALE ADPT', P3, 'EA', 3.6, 1.8], ['PEX DROP EAR 90 ELL', ['1/2', '3/4'], 'EA', 5.9, 1.6],
  ['BRASS BALL VALVE FIP FULL PORT', V5, 'EA', 11.4, 1.7], ['BRASS BALL VALVE SWT FULL PORT', V5, 'EA', 10.9, 1.7], ['BRASS GATE VALVE FIP', V5, 'EA', 14.2, 1.7], ['BRASS CHECK VALVE SWING FIP', V5, 'EA', 16.8, 1.7],
  ['BRASS NIPPLE CLOSE', ['1/2', '3/4', '1'], 'EA', 2.4, 1.6], ['BRASS UNION FIP', ['1/2', '3/4', '1'], 'EA', 9.8, 1.6], ['DIELECTRIC UNION FIP X SWT', ['3/4', '1'], 'EA', 8.6, 1.5],
  ['NO-HUB CAST IRON 1/4 BEND', N3, 'EA', 12.5, 1.7], ['NO-HUB CAST IRON 1/8 BEND', N3, 'EA', 10.9, 1.7], ['NO-HUB CAST IRON SAN TEE', N3, 'EA', 19.8, 1.7], ['NO-HUB COUPLING HEAVY DUTY', N3, 'EA', 7.4, 1.6],
  ['NO-HUB CAST IRON PIPE 10FT', N3, 'FT', 9.6, 1.6], ['NO-HUB CAST IRON WYE', N3, 'EA', 21.4, 1.7],
  ['CLEVIS HANGER GALV', ['2', '3', '4'], 'EA', 2.9, 1.5], ['SPLIT RING HANGER COPPER PLATED', C4, 'EA', 1.2, 1.4], ['RISER CLAMP GALV', ['2', '3', '4'], 'EA', 4.6, 1.5], ['PIPE INSULATION 6FT', C4, 'EA', 3.1, 1.4],
]
const ONE = [
  ['WATER HEATER 50 GAL ELECTRIC TALL', 'EA', 689], ['WATER HEATER 40 GAL GAS SHORT', 'EA', 742], ['TANKLESS WATER HEATER 199K BTU GAS', 'EA', 1389], ['EXPANSION TANK 2 GAL POTABLE', 'EA', 46.5],
  ['T&P RELIEF VALVE 3/4', 'EA', 14.2], ['WATER HEATER PAN 24 IN ALUM', 'EA', 22.4], ['WATER HEATER FLEX CONNECTOR 3/4 X 18', 'EA', 9.8], ['GAS FLEX CONNECTOR 3/4 X 36', 'EA', 28.6],
  ['BACKFLOW PREVENTER RPZ 1', 'EA', 412], ['BACKFLOW PREVENTER DOUBLE CHECK 2', 'EA', 638], ['PRESSURE REDUCING VALVE 1', 'EA', 96.4], ['THERMOSTATIC MIXING VALVE 3/4', 'EA', 148.2],
  ['FLOOR DRAIN 2 ADJUSTABLE NICKEL BRONZE', 'EA', 58.9], ['FLOOR SINK 12 X 12 X 6 PORCELAIN', 'EA', 172.4], ['TRAP PRIMER 1/2', 'EA', 64.3], ['CLEANOUT COVER ROUND NICKEL BRONZE 4', 'EA', 23.8],
  ['CLOSET FLANGE 4 X 3 PVC W/ TEST CAP', 'EA', 7.9], ['WAX RING W/ HORN', 'EA', 3.4], ['CLOSET BOLT SET BRASS', 'EA', 2.9], ['ANGLE STOP 1/2 X 3/8 QTR TURN', 'EA', 8.4],
  ['STRAIGHT STOP 1/2 X 3/8 QTR TURN', 'EA', 8.4], ['SUPPLY LINE BRAIDED 3/8 X 1/2 X 16', 'EA', 5.6], ['SUPPLY LINE BRAIDED 3/8 X 7/8 X 12', 'EA', 5.2], ['LAV P-TRAP 1-1/4 CHROME', 'EA', 13.9],
  ['HOSE BIBB FROST FREE 12 IN', 'EA', 34.8], ['HOSE BIBB BOILER DRAIN 1/2', 'EA', 7.3], ['WASHER OUTLET BOX W/ VALVES', 'EA', 41.2], ['ICE MAKER OUTLET BOX', 'EA', 19.6],
  ['WATER HAMMER ARRESTOR 1/2', 'EA', 17.4], ['SHOWER VALVE ROUGH-IN PRESSURE BALANCE', 'EA', 98.5], ['TUB DRAIN WASTE AND OVERFLOW PVC', 'EA', 31.4], ['SHOWER DRAIN 2 PVC', 'EA', 12.8],
  ['ROOF FLASHING 2 LEAD', 'EA', 26.9], ['ROOF FLASHING 3 LEAD', 'EA', 33.4], ['FIRESTOP COLLAR 2', 'EA', 18.7], ['FIRESTOP COLLAR 3', 'EA', 24.3], ['FIRESTOP COLLAR 4', 'EA', 29.6],
  ['PVC CEMENT MEDIUM CLEAR QT', 'EA', 12.4], ['PVC PRIMER PURPLE QT', 'EA', 11.8], ['SOLDER LEAD FREE 1 LB', 'EA', 31.6], ['FLUX WATER SOLUBLE 8 OZ', 'EA', 6.9], ['THREAD SEAL TAPE 1/2 X 520', 'EA', 1.4],
  ['PIPE DOPE W/ PTFE 16 OZ', 'EA', 9.7], ['PLUMBERS PUTTY 14 OZ', 'EA', 4.3], ['NAIL PLATE 1-1/2 X 5 GALV', 'EA', 0.6], ['HANGER STRAP GALV 3/4 X 100FT', 'EA', 21.5],
  ['SEWAGE EJECTOR PUMP 1/2 HP', 'EA', 486], ['SUMP BASIN 18 X 30 W/ LID', 'EA', 118.4], ['CHECK VALVE 2 PVC QUIET', 'EA', 38.6], ['GREASE INTERCEPTOR 20 GPM', 'EA', 624],
]
const CHARGES = ['FREIGHT', 'FUEL SURCHARGE', 'DELIVERY']

// Every item: a description and a price.
const items = []
for (const [words, sizes, unit, base, grow] of FAM) sizes.forEach((sz, i) => items.push({ desc: `${sz} ${words}`, unit, price: Math.round(base * Math.pow(grow, i) * 100) / 100 }))
for (const [desc, unit, price] of ONE) items.push({ desc, unit, price })
items.forEach((it, i) => { it.n = i + 1 })
const title = (s) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bHxh\b/g, 'HxH').replace(/\bHxhxh\b/g, 'HxHxH').replace(/\bCxc\b/g, 'CxC').replace(/\bCxcxc\b/g, 'CxCxC').replace(/\bPvc\b/g, 'PVC').replace(/\bDwv\b/g, 'DWV').replace(/\bPex\b/g, 'PEX').replace(/\bFip\b/g, 'FIP').replace(/\bSwt\b/g, 'SWT')

// The star of Price over time, and the fittings the crew keeps going back to the counter for.
const find = (d) => items.find((it) => it.desc === d)
const STAR = find('3/4 TYPE L HARD COPPER TUBE 20FT')
const COUNTER = ['1/2 COPPER 90 ELL CXC', '1/2 COPPER COUPLING CXC', '3/4 COPPER 90 ELL CXC', '2 PVC DWV COUPLING HXH', '2 PVC DWV 90 ELL HXH', '1/2 PEX EXPANSION SLEEVE', 'ANGLE STOP 1/2 X 3/8 QTR TURN', 'SUPPLY LINE BRAIDED 3/8 X 1/2 X 16', 'THREAD SEAL TAPE 1/2 X 520', 'WAX RING W/ HORN', '1/2 BRASS BALL VALVE SWT FULL PORT', 'PVC CEMENT MEDIUM CLEAR QT'].map(find)
const TAUGHT = new Set([STAR, ...COUNTER, ...['1 TYPE L HARD COPPER TUBE 20FT', '3 PVC SCH40 DWV PIPE 10FT', '4 PVC SCH40 DWV PIPE 10FT', '3/4 PEX-A TUBING 100FT COIL RED', '3/4 PEX-A TUBING 100FT COIL BLUE', '3 NO-HUB CAST IRON PIPE 10FT', 'WATER HEATER 50 GAL ELECTRIC TALL', '3 PVC DWV SAN TEE HXHXH', '2 PVC DWV SAN TEE HXHXH', '3 NO-HUB COUPLING HEAVY DUTY', '1/2 COPPER TEE CXCXC', 'CLOSET FLANGE 4 X 3 PVC W/ TEST CAP'].map(find)])

// Which houses carry an item: a code each.
const codes = []
for (const it of items) {
  const houses = TAUGHT.has(it) ? HOUSES : HOUSES.filter(() => rnd() < 0.72)
  const carry = houses.length ? houses : [pick(HOUSES)]
  for (const h of carry) codes.push({ it, house: h, code: `${h.prefix}${String(100000 + ((it.n * 7919 + h.prefix.charCodeAt(0) * 131) % 899999))}`, taught: TAUGHT.has(it) })
}

// The parts book: the taught parts, then parts that fit codes with no part.
const parts = []
const partOf = new Map()
const addPart = (name, manufacturer) => { const p = { id: gid('9299', parts.length + 1), name, manufacturer, is_robot: false, service_type_id: PLUMBING, part_type_id: null, notes: null, link: null, order_increment: null, order_increment_unit: null, created_at: '2026-02-02T15:00:00.000Z', updated_at: '2026-02-02T15:00:00.000Z' }; parts.push(p); return p }
const MAKERS = ['Samplex', 'Inventa Brass', 'Placeholder Valve Co', 'Madeup Pipe Works']
for (const it of TAUGHT) partOf.set(it, addPart(title(it.desc), pick(MAKERS)))

// The offers: a part of the same name (sure), a manufacturer's number on the line (sure), the same words in another order (a look), two parts of one name (pick).
const open = codes.filter((c) => !c.taught)
const openItems = [...new Set(open.map((c) => c.it))]
const codesOf = (it) => open.filter((c) => c.it === it).length
const WANT_SURE = 105
let sure = 0
const used = new Set()
const asSame = (it) => { addPart(title(it.desc), pick(MAKERS)); used.add(it); sure += codesOf(it) }
const asMfr = (it) => { it.mfr = `SX${1000 + it.n * 13}${'ABCDEF'[it.n % 6]}`; addPart(`${title(it.desc)} ${it.mfr}`, 'Samplex'); used.add(it); sure += codesOf(it) }
const asLook = (it, name) => { const w = title(it.desc).split(' '); addPart(name ?? [...w.slice(1), w[0]].join(' '), pick(MAKERS)); used.add(it) }
const asRivals = (it) => { addPart(title(it.desc), 'Samplex'); addPart(title(it.desc).toUpperCase(), 'Inventa Brass'); used.add(it) }
// The dear rows at the top of the list show every kind of offer.
asMfr(find('TANKLESS WATER HEATER 199K BTU GAS')); asSame(find('4 NO-HUB CAST IRON PIPE 10FT')); asLook(find('BACKFLOW PREVENTER RPZ 1'), 'RPZ Backflow Preventer 1'); asRivals(find('1 PEX-A TUBING 100FT COIL RED'))
asSame(find('1-1/4 TYPE L HARD COPPER TUBE 20FT')); asMfr(find('SEWAGE EJECTOR PUMP 1/2 HP')); asSame(find('2 PVC SCH40 DWV PIPE 10FT')); asSame(find('SHOWER VALVE ROUGH-IN PRESSURE BALANCE')); used.add(find('GREASE INTERCEPTOR 20 GPM')); used.add(find('WATER HEATER 40 GAL GAS SHORT')); used.add(find('FLOOR SINK 12 X 12 X 6 PORCELAIN'))
const shuffled = [...openItems].sort(() => rnd() - 0.5).filter((it) => !used.has(it))
let k = 0
for (const it of shuffled) {
  if (sure === WANT_SURE) break
  if (sure + codesOf(it) > WANT_SURE) continue
  if (k++ % 4 === 0) asMfr(it); else asSame(it)
}
const rest = shuffled.filter((it) => !used.has(it))
for (const it of rest.slice(0, 5)) asLook(it)
for (const it of rest.slice(5, 8)) asRivals(it)

// Spend by rank: a long tail, the first forty about a third of the dollars. The dear items lead.
const DEAR = new Set(['TANKLESS WATER HEATER 199K BTU GAS', 'WATER HEATER 40 GAL GAS SHORT', '4 NO-HUB CAST IRON PIPE 10FT', '1-1/4 TYPE L HARD COPPER TUBE 20FT', 'BACKFLOW PREVENTER DOUBLE CHECK 2', '1 PEX-A TUBING 100FT COIL RED', 'GREASE INTERCEPTOR 20 GPM', 'SEWAGE EJECTOR PUMP 1/2 HP', '2 PVC SCH40 DWV PIPE 10FT', '1/2 TYPE L HARD COPPER TUBE 20FT', '1 PEX-A TUBING 100FT COIL BLUE', 'BACKFLOW PREVENTER RPZ 1', '2 NO-HUB CAST IRON PIPE 10FT', '1/2 TYPE M HARD COPPER TUBE 20FT', 'SHOWER VALVE ROUGH-IN PRESSURE BALANCE', 'FLOOR SINK 12 X 12 X 6 PORCELAIN'])
const ranked = [...open].sort((a, b) => (DEAR.has(b.it.desc) ? 1 : 0) - (DEAR.has(a.it.desc) ? 1 : 0) || (b.it.price > 20 ? 1 : 0) - (a.it.price > 20 ? 1 : 0) + (rnd() - 0.5) * 1.6)
ranked.forEach((c, i) => { c.spend = Math.round(5200 * Math.pow(i + 1, -0.55) * (0.92 + rnd() * 0.16)) })

// Bills: a house and a day. Lines land on them.
const DAYS = []
for (let n = -176; n <= -4; n++) { const d = new Date(day(n) + 'T12:00:00Z').getUTCDay(); if (d !== 0 && d !== 6) DAYS.push(n) }
const bills = new Map()
const billOf = (house, n, small = false) => {
  const k = `${house.id}|${n}|${small ? 's' : ''}`
  let b = bills.get(k)
  if (!b) { b = { id: gid('9297', bills.size + 1), house, dated_on: day(n), number: `${house.prefix[0]}${String(410000 + bills.size * 37)}`, job: pick(JOBS), small, total: 0 }; bills.set(k, b) }
  return b
}
const lines = []
const addLine = (c, b, qty, price) => {
  const extended_cents = Math.round(qty * price * 100)
  b.total += extended_cents
  lines.push({ id: gid('9296', lines.length + 1), invoice_id: b.id, number: b.number, supply_house_id: c.house.id, dated_on: b.dated_on, line_kind: 'part', house_code: c.code, mfr_number: c.it.mfr ?? null, description: c.it.desc, unit: c.it.unit, pricing_unit: 'each', unit_price: price, part_id: null, quantity: qty, extended_cents })
}
for (const c of open) {
  const n = Math.max(1, Math.min(7, Math.floor(c.spend / c.it.price) || 1, 1 + Math.floor(rnd() * 6)))
  for (let i = 0; i < n; i++) {
    const price = Math.round(c.it.price * (0.96 + rnd() * 0.1) * 100) / 100
    addLine(c, billOf(c.house, pick(DAYS)), Math.max(1, Math.round(c.spend / n / price)), price)
  }
}
// The taught parts: bought often. The star's price climbs over the months at three houses.
for (const c of codes.filter((x) => x.taught)) {
  const isStar = c.it === STAR
  const isCounter = COUNTER.includes(c.it)
  const hi = HOUSES.indexOf(c.house)
  const n = isStar ? [6, 5, 3][hi] : isCounter ? [5, 3, 2][hi] : 2 + Math.floor(rnd() * 4)
  for (let i = 0; i < n; i++) {
    const at = isCounter && i < [4, 2, 1][hi] ? -4 - Math.floor(rnd() * 80) : pick(DAYS)
    const climb = isStar ? 1 + (176 + at) / 176 * 0.19 + hi * 0.035 : 0.97 + rnd() * 0.08
    const price = Math.round(c.it.price * climb * 100) / 100
    const small = isCounter && at > -90
    const qty = small ? 1 + Math.floor(rnd() * 10) : isStar ? 40 + 20 * Math.floor(rnd() * 8) : Math.max(1, Math.round((180 + rnd() * 900) / price))
    addLine(c, billOf(c.house, at, small), qty, price)
  }
}
// A charge on some bills.
for (const b of bills.values()) if (!b.small && rnd() < 0.3) { const cents = 900 + Math.floor(rnd() * 5200); b.total += cents; lines.push({ id: gid('9296', lines.length + 1), invoice_id: b.id, number: b.number, supply_house_id: b.house.id, dated_on: b.dated_on, line_kind: 'charge', house_code: null, mfr_number: null, description: pick(CHARGES), unit: 'EA', pricing_unit: 'each', unit_price: cents / 100, part_id: null, quantity: 1, extended_cents: cents }) }

const teaches = codes.filter((c) => c.taught).map((c, i) => ({ id: gid('9295', i + 1), supply_house_id: c.house.id, code_key: fold(c.code), part_id: partOf.get(c.it).id, not_a_part: false, unit_factor: 1 }))
const supplyHouses = HOUSES.map((h) => ({ id: h.id, name: h.name, phone: h.phone, address: null, notes: null, website_url: null, vendor_kind: 'supply_house', job_accounts: 'none', monthly_payment_day: null, default_lead_time_days: null, created_at: '2026-01-12T15:00:00.000Z', updated_at: '2026-01-12T15:00:00.000Z' }))
const allocations = [...bills.values()].map((b) => ({ invoice_id: b.id, job_id: b.job, pct: 100 }))
const invoices = [...bills.values()].map((b) => ({ id: b.id, supply_house_id: b.house.id, invoice_number: b.number, invoice_date: b.dated_on, amount: b.total / 100, purchase_order_number: null }))
const bookPrices = [{ id: gid('9294', 1), part_id: partOf.get(STAR).id, supply_house_id: HOUSES[0].id, price: 6.95, effective_date: day(-150), updated_at: `${day(-150)}T15:00:00.000Z` }]

module.exports = { HOUSES, items, codes, parts, lines, teaches, supplyHouses, allocations, invoices, bookPrices, STAR, partOf, sure, day, gid,
  stats: () => ({ items: items.length, codes: codes.length, open: open.length, sure, parts: parts.length, lines: lines.length, bills: bills.size, spend: open.reduce((s, c) => s + c.spend, 0) }),
  extra: (more = {}) => ({
    tables: { supply_purchase_lines: lines, supply_part_codes: teaches, supply_houses: supplyHouses, supply_house_invoice_job_allocations: allocations, supply_house_invoices: invoices, material_po_generator_entries: [], material_parts: parts, material_part_prices: bookPrices, ...(more.tables ?? {}) },
    rpc: { ...(more.rpc ?? {}) }, functions: { ...(more.functions ?? {}) },
  }),
}
