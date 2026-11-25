// Invented permits for #302. Every name, address, number and amount is made up.
const TODAY = '2026-11-24'
const day = (n) => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const at = (n, t = '15:10:00') => `${day(n)}T${t}.000Z`
const U = (n) => `00000000-0000-4194-8000-0000000000${n}`
const ROSA = U('03'), MAX = U('02'), ELI = U('05'), CORA = U('04')
const pid = (n) => `00000000-0000-4194-9302-${String(n).padStart(12, '0')}`
const key = (s) => s.toLowerCase().replace(/\b(llc|inc|co|corp|ltd|company)\b\.?/g, '').replace(/[^a-z0-9]+/g, '')
const CITY = 'San Marcos'

function permit(n, o) {
  const company = o.company
  return {
    id: pid(n), city: CITY, source: 'sample_feed', permit_number: `SMP-2026-${String(4100 + n * 7)}`, permit_type: 'Commercial Building',
    stage: o.stage ?? 'applied', residential: false, work_type: o.work ?? 'New Commercial', project_name: o.name ?? null,
    address: o.address, zip: o.zip ?? '78666', lat: o.lat, lng: o.lng,
    submitted_on: day(o.filed), issued_on: o.stage === 'issued' ? day(o.filed + 3 > 0 ? 0 : o.filed + 3) : null, filed_on: day(o.filed),
    declared_value: o.value ?? null, area_sf: o.sf ?? null, contact: o.person ? `${o.person}, ${company}` : company,
    plumber: o.plumber ?? null, plumber_permit_on: o.plumberOn != null ? day(o.plumberOn) : null,
    verdict: o.verdict ?? null, verdict_reason: o.reason ?? null, verdict_look_again_on: o.again != null ? day(o.again) : null,
    verdict_prospect_id: o.lead ?? null, verdict_by: o.by ?? null, verdict_by_name: o.byName ?? null, verdict_at: o.verdictAt != null ? at(o.verdictAt) : null,
    verdict_reason_code: o.code ?? null, verdict_for_user: o.forUser ?? null, verdict_for_name: o.forName ?? null, verdict_pursue_for: o.pursueFor ?? null,
    builder_key: key(company), builder_name: null, builder_kind: o.kind ?? null, builder_mark: o.mark ?? null, builder_mark_reason: o.markWhy ?? null,
    builder_mark_by_name: o.mark ? 'Max Sample' : null, builder_mark_at: o.mark ? at(-9) : null,
    builder_permits: o.permits ?? 1, builder_open: o.open ?? 1,
    plumbing_nearby: 0, plumbing_nearby_on: null, plumbing_nearby_by: null, plumbing_nearby_what: null, plumber_first_permit_on: o.plumberOn != null ? day(o.plumberOn) : null,
  }
}

const HOMES = { company: 'Sample Homes LLC', person: 'Jordan Sample', kind: 'general_contractor', mark: 'good', markWhy: 'Paid on time on two jobs.', permits: 6, open: 4 }
const CEDAR = { company: 'Cedar Bend Builders Inc', person: 'Riley Sample', kind: 'general_contractor', permits: 4, open: 3 }
const OAK = { company: 'Live Oak Sample Development LLC', person: 'Casey Sample', kind: 'developer', permits: 3, open: 2 }
const MESA = { company: 'Sample Mesa Construction Co', person: 'Avery Sample', kind: 'general_contractor', mark: 'avoid', markWhy: 'Slow pay on a retail shell.', permits: 5, open: 2 }
const PERMITCO = { company: 'Sample Permit Runners LLC', person: 'Quinn Sample', kind: 'files_for_others', permits: 9, open: 6 }
const CREEK = { company: 'Blanco Creek Sample Builders LLC', person: 'Morgan Sample', permits: 2, open: 2 }
const RIDGE = { company: 'Sample Ridge Contracting Inc', person: 'Taylor Sample', kind: 'general_contractor', permits: 3, open: 1 }

const rows = [
  // Skim: no answer yet, no plumber on file
  permit(1, { ...HOMES, name: 'Sample Crossing Retail, building B', work: 'New Commercial', address: '1420 Sample Crossing Blvd', lat: 29.8571, lng: -97.9514, filed: -2, value: 2400000, sf: 18500 }),
  permit(2, { ...CEDAR, name: 'Cedar Bend Medical Office', work: 'New Commercial', address: '805 Invented Oak Pkwy', lat: 29.8907, lng: -97.9122, filed: -4, value: 1650000, sf: 12200 }),
  permit(3, { ...OAK, name: 'Live Oak Sample Lofts, phase 2', work: 'New Commercial', address: '310 Placeholder Mill Rd', lat: 29.8744, lng: -97.9301, filed: -6, value: 5200000, sf: 64000 }),
  permit(4, { ...CREEK, name: 'Sample Taproom finish-out', work: 'Commercial Remodel', address: '212 Example Square', lat: 29.8829, lng: -97.9408, filed: -3, value: 310000, sf: 4200 }),
  permit(5, { ...RIDGE, name: null, work: 'Commercial Addition', address: '2750 Sample Ranch Rd 12', lat: 29.9012, lng: -97.9833, filed: -9, value: null, sf: 6800 }),
  permit(6, { ...PERMITCO, name: 'Sample Car Wash', work: 'New Commercial', address: '4015 Madeup Hwy 123', lat: 29.8402, lng: -97.9267, filed: -12, value: 890000, sf: 3900 }),
  permit(7, { ...MESA, name: 'Sample Storage, building 3', work: 'New Commercial', address: '1190 Fictional Loop', lat: 29.8655, lng: -97.9689, filed: -15, value: 720000, sf: 22000 }),
  // Investigating
  permit(8, { ...HOMES, name: 'Sample Crossing Retail, building A', address: '1400 Sample Crossing Blvd', lat: 29.8566, lng: -97.9509, filed: -11, value: 2100000, sf: 16400, verdict: 'look', reason: 'Kept on the skim.', again: 0, by: MAX, byName: 'Max Sample', verdictAt: -6, forUser: ROSA, forName: 'Rosa Sample' }),
  permit(9, { ...CEDAR, name: 'Cedar Bend Dental Suites', work: 'Commercial Remodel', address: '640 Invented Oak Pkwy', lat: 29.8899, lng: -97.9131, filed: -14, value: 540000, sf: 5100, verdict: 'look', reason: 'Kept on the skim.', again: 2, by: MAX, byName: 'Max Sample', verdictAt: -5, forUser: ELI, forName: 'Eli Sample' }),
  permit(10, { ...OAK, name: 'Live Oak Sample Lofts, phase 1', address: '300 Placeholder Mill Rd', lat: 29.8741, lng: -97.9297, filed: -20, value: 4800000, sf: 58000, verdict: 'look', reason: 'Kept on the skim.', again: -1, by: MAX, byName: 'Max Sample', verdictAt: -8 }),
  permit(11, { ...CREEK, name: 'Sample Bakery and Cafe', work: 'Commercial Remodel', address: '118 Example Square', lat: 29.8832, lng: -97.9412, filed: -8, value: 185000, sf: 2600, verdict: 'look', reason: 'Kept on the skim.', again: 5, by: ROSA, byName: 'Rosa Sample', verdictAt: -2 }),
  // Pursuing
  permit(12, { ...RIDGE, name: 'Sample Ridge Daycare', address: '905 Sample Ranch Rd 12', lat: 29.8951, lng: -97.9722, filed: -24, value: 1300000, sf: 9800, verdict: 'approach', reason: 'Pursuing: this job.', by: ELI, byName: 'Eli Sample', verdictAt: -10, forUser: ELI, forName: 'Eli Sample', pursueFor: 'this_job' }),
  permit(13, { ...HOMES, name: 'Sample Homes Clubhouse', address: '77 Sample Vista Dr', lat: 29.8612, lng: -97.9580, filed: -30, value: 960000, sf: 7400, verdict: 'approach', reason: 'Pursuing: this job and their next ones.', by: ROSA, byName: 'Rosa Sample', verdictAt: -12, forUser: ROSA, forName: 'Rosa Sample', pursueFor: 'both' }),
  // Closed
  permit(14, { ...MESA, name: 'Sample Mesa Tire Shop', address: '3320 Fictional Loop', lat: 29.8660, lng: -97.9701, filed: -18, value: 410000, sf: 5200, verdict: 'not_for_us', reason: 'Not this builder', code: 'not_this_builder', by: MAX, byName: 'Max Sample', verdictAt: -7 }),
  permit(15, { ...PERMITCO, name: 'Sample Sign Shop repair', work: 'Commercial Remodel', address: '15 Madeup Hwy 123', lat: 29.8421, lng: -97.9271, filed: -16, value: 28000, sf: 900, verdict: 'not_for_us', reason: 'Too small', code: 'too_small', by: ROSA, byName: 'Rosa Sample', verdictAt: -4 }),
  permit(16, { ...CEDAR, name: 'Cedar Bend Pharmacy', address: '820 Invented Oak Pkwy', lat: 29.8911, lng: -97.9117, filed: -33, value: 1150000, sf: 8800, stage: 'issued', plumber: 'Sample Rival Plumbing LLC', plumberOn: -5 }),
  permit(17, { ...OAK, name: 'Live Oak Sample Fitness', address: '355 Placeholder Mill Rd', lat: 29.8749, lng: -97.9306, filed: -40, value: 1750000, sf: 14200, verdict: 'not_for_us', reason: 'Could not reach anyone', code: 'np_no_answer', by: ELI, byName: 'Eli Sample', verdictAt: -3 }),
]

const funnel = {
  since: day(-23), arrived: 17, skimmed: 10, kept: 6, passed: 3, pursuing: 2, has_plumber: 1, bid: 1, won: 0,
  by_person: [{ name: 'Max Sample', n: 5 }, { name: 'Rosa Sample', n: 3 }, { name: 'Eli Sample', n: 2 }],
  pass_reasons: [{ code: 'not_this_builder', n: 1 }, { code: 'too_small', n: 1 }, { code: 'np_no_answer', n: 1 }],
  pursue_for: [{ code: 'this_job', n: 1 }, { code: 'both', n: 1 }],
}
const history = [
  { key: key('Sample Homes LLC'), bids: 3, won: 2, last_bid_on: day(-48), on_deck: false },
  { key: key('Cedar Bend Builders Inc'), bids: 2, won: 0, last_bid_on: day(-120), on_deck: false },
]
const pulls = [
  { id: pid(901), city: CITY, source: 'sample_feed', ran_at: `${TODAY}T11:30:00.000Z`, error: null, since: day(-340), seen: 41, kept: 3 },
]
const permitsTable = rows.map((r) => ({ id: r.id, city: r.city, source: r.source, permit_number: r.permit_number, permit_type: r.permit_type, kind: 'building', stage: r.stage, work_type: r.work_type, submitted_on: r.submitted_on, issued_on: r.issued_on, contact: r.contact, address: r.address, declared_value: r.declared_value, builder_key: r.builder_key, address_key: key(r.address), raw: { note: 'Invented row' }, pulled_at: at(0, '11:30:00'), first_seen_at: at(-2, '11:30:00') }))
const office = { key: 'office_address_v1', value_text: JSON.stringify({ address: '100 Sample Way, Kyle, TX 78640', lat: 29.9891, lng: -97.8772 }) }
const parcel = { found: true, cached: true, looked_up_at: at(-1), error: null, facts: { prop_id: 'R000000', situs: '1420 SAMPLE CROSSING BLVD', owner: 'SAMPLE CROSSING HOLDINGS LLC', owner_address: 'PO Box 000, Kyle, TX 78640', dba: null, land_value: 410000, improvement_value: 0, total_value: 410000, use_code: 'Vacant commercial', year_built: null, building_sf: null, acres: 2.4, detail_url: null } }

const B = (o, more) => ({ key: key(o.company), name: null, sample_contact: `${o.person}, ${o.company}`, kind: o.kind ?? null, mark: o.mark ?? null, mark_reason: o.markWhy ?? null, mark_by_name: o.mark ? 'Max Sample' : null, mark_at: o.mark ? at(-9) : null, permits: o.permits, open: o.open, plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null, ...more })
const builders = [
  B(PERMITCO, { last_permit_on: day(-12) }),
  B(HOMES, { last_permit_on: day(-2), bids: 3, won: 2, last_bid_on: day(-48) }),
  B(MESA, { last_permit_on: day(-15), plumber: 'Sample Rival Plumbing LLC', plumber_jobs: 3 }),
  B(CEDAR, { last_permit_on: day(-4), bids: 2, won: 0, last_bid_on: day(-120), plumber: 'Sample Rival Plumbing LLC', plumber_jobs: 1 }),
  B(OAK, { last_permit_on: day(-6) }),
  B(RIDGE, { last_permit_on: day(-9) }),
  B(CREEK, { last_permit_on: day(-3) }),
]
const vid = (n) => `00000000-0000-4194-9303-${String(n).padStart(12, '0')}`
const verdicts = [
  { id: vid(1), permit_id: pid(8), verdict: 'look', reason: 'Kept on the skim.', reason_code: null, decided_at: at(-6), decided_by: MAX, for_user_id: ROSA, pursue_for: null, look_again_on: day(0), prospect_id: null },
  { id: vid(2), permit_id: pid(10), verdict: 'look', reason: 'Kept on the skim.', reason_code: null, decided_at: at(-8), decided_by: MAX, for_user_id: null, pursue_for: null, look_again_on: day(-1), prospect_id: null },
  { id: vid(3), permit_id: pid(9), verdict: 'look', reason: 'Kept on the skim.', reason_code: null, decided_at: at(-5), decided_by: MAX, for_user_id: ELI, pursue_for: null, look_again_on: day(2), prospect_id: null },
]
function extra(more = {}) {
  return {
    add: { app_settings: [office] },
    tables: { permit_pulls: pulls, permits: permitsTable, permit_verdicts: verdicts, ...(more.tables ?? {}) },
    rpc: { research_permits_v4: rows, permit_funnel: funnel, research_contact_history: history, research_builders: builders, ...(more.rpc ?? {}) },
    functions: { 'permit-lookup': parcel, ...(more.functions ?? {}) },
  }
}
module.exports = { rows, extra, day, at, U, pid, key, CITY, TODAY, funnel }
