// Invented licensees for #411. Every person, number, company and day is made up.
const TODAY = '2026-11-24'
const day = (n) => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const gid = (g, n) => `00000000-0000-4194-${g}-${String(n).padStart(12, '0')}`
const U = (n) => `00000000-0000-4194-8000-0000000000${n}`
let seed = 411
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]

const PEOPLE = [['01', 'dev', 'Devon Sample', 'Dev'], ['02', 'master_technician', 'Max Sample', 'Leader'], ['03', 'assistant', 'Rosa Sample', 'Assistant'], ['04', 'controller', 'Cora Sample', 'Controller'], ['05', 'estimator', 'Eli Sample', 'Estimator'], ['06', 'primary', 'Paco Sample', 'Primary'], ['07', 'superintendent', 'Sid Sample', 'Superintendent'], ['08', 'subcontractor', 'Sam Plumber', 'Subcontractor'], ['09', 'helpers', 'Hal Sample', 'Helper']]
const users = (viewerRole) => PEOPLE.map(([n, role, name, title]) => ({ id: U(n), name, email: `${name.split(' ')[0].toLowerCase()}@lens.example.com`, phone: `(512) 555-01${n}`, role, title, read_only: false, is_sample: true, is_digital_twin: false, is_walk_tester: false, calibration_standard: false, needs_supervision: false, estimator_prospects_access: false, team_prospects_access: role === viewerRole, dispatch_mode_enabled: false, archived_at: null, created_at: '2026-01-05T15:00:00.000Z' }))

const COUNTIES = ['BEXAR', 'COMAL', 'GUADALUPE', 'HAYS', 'TRAVIS']
const FIRST = ['JORDAN', 'RILEY', 'CASEY', 'AVERY', 'MORGAN', 'QUINN', 'TAYLOR', 'DREW', 'REESE', 'SKYLER', 'PARKER', 'ROWAN', 'HARPER', 'EMERY', 'FINLEY', 'DAKOTA', 'SAGE', 'ARDEN', 'BLAIR', 'KIT']
const LAST = ['SAMPLE', 'EXAMPLE', 'PLACEHOLDER', 'MADEUP', 'INVENTED', 'TESTCASE', 'FICTION', 'DEMOSON', 'NOTREAL', 'MOCKLEY']
const ZIPS = { BEXAR: '78200', COMAL: '78130', GUADALUPE: '78155', HAYS: '78666', TRAVIS: '78700' }
const roll = []
const row = (o) => {
  const r = { id: gid('9411', roll.length + 1), source: 'tsbpe', trade: 'plumbing', license_class: o.cls, license_number: String(o.num), status: o.status ?? 'current', licensed_on: o.since ?? null, expires_on: o.exp ?? null, last_name: o.last, first_name: o.first, middle_name: o.mid ?? '', suffix: o.suffix ?? '', name_key: `${o.last}|${o.first}|${o.zip ?? ''}`.toLowerCase(), zip: o.zip ?? '', county: o.county, endorsements: o.end ?? [], company: o.company ?? '', insurance_ends_on: o.ins ?? null, ours: !!o.ours, first_seen_on: '2026-11-21', last_seen_on: '2026-11-23', gone_on: o.gone ?? null, created_at: '2026-11-21T13:00:00.000Z', updated_at: '2026-11-23T12:40:00.000Z' }
  roll.push(r); return r
}
// The person whose sheet is opened: a journeyman who made master, with medical gas.
const STAR = row({ cls: 'master', num: 99214, first: 'JORDAN', mid: 'Q', last: 'SAMPLE', county: 'HAYS', zip: '78666', since: '2026-10-30', exp: '2027-10-31', end: ['medical_gas'] })
row({ cls: 'journeyman', num: 99107, first: 'JORDAN', mid: 'Q', last: 'SAMPLE', county: 'HAYS', zip: '78666', since: '2015-04-17', exp: '2027-04-30', end: ['medical_gas'] })
let n = 99300
for (const last of LAST) for (const first of FIRST) {
  if (rnd() < 0.62) continue
  if (first === 'JORDAN' && last === 'SAMPLE') continue
  const cls = pick(['journeyman', 'journeyman', 'journeyman', 'master', 'tradesman', 'responsible_master'])
  const county = pick(COUNTIES)
  const lapsed = rnd() < 0.16
  const years = 1 + Math.floor(rnd() * 24)
  row({ cls, num: n += 7 + Math.floor(rnd() * 20), first, last, mid: rnd() < 0.4 ? pick(['A', 'B', 'J', 'L', 'R']) : '', suffix: rnd() < 0.05 ? 'JR' : '', county, zip: cls === 'responsible_master' && rnd() < 0.5 ? '' : ZIPS[county], since: day(-365 * years - Math.floor(rnd() * 300)), exp: lapsed ? day(-20 - Math.floor(rnd() * 400)) : day(20 + Math.floor(rnd() * 340)), status: lapsed ? 'expired' : 'current', end: rnd() < 0.18 ? ['medical_gas'] : rnd() < 0.08 ? ['water_supply'] : [], company: cls === 'responsible_master' ? `${first[0]}${first.slice(1).toLowerCase()} ${last[0]}${last.slice(1).toLowerCase()} Plumbing LLC` : '', ins: cls === 'responsible_master' ? day(30 + Math.floor(rnd() * 300)) : null })
}
// Our own people on the roll, whatever the county.
row({ cls: 'responsible_master', num: 99102, first: 'MAX', last: 'SAMPLE', county: 'HAYS', zip: '78640', since: '2009-06-12', exp: '2027-06-30', ours: true, company: 'Sample Plumbing Co', ins: day(190) })
row({ cls: 'journeyman', num: 99106, first: 'PACO', last: 'SAMPLE', county: 'HAYS', zip: '78640', since: '2019-03-08', exp: '2027-03-31', ours: true })
row({ cls: 'journeyman', num: 99117, first: 'SID', last: 'SAMPLE', county: 'TRAVIS', zip: '78700', since: '2017-12-01', exp: day(23), ours: true })
row({ cls: 'apprentice', num: 99109, first: 'HAL', last: 'SAMPLE', county: 'HAYS', zip: '78640', since: '2025-08-20', exp: day(-12), status: 'expired', ours: true })
row({ cls: 'responsible_master', num: 99108, first: 'SAM', last: 'PLUMBER', county: 'COMAL', zip: '78130', since: '2012-02-02', exp: '2027-02-28', ours: true, company: 'Sample Sub Plumbing LLC', ins: day(11) })

const personLicenses = [
  { id: gid('9412', 1), person_name: 'Max Sample', license_type: 'Master Plumber #99102', date_of_expiry: '2027-06-30', note: null, created_at: '2026-01-10T15:00:00.000Z', expiry_dispatch_notified_at: null },
  { id: gid('9412', 2), person_name: 'Paco Sample', license_type: 'Journeyman Plumber #99106', date_of_expiry: '2026-03-31', note: null, created_at: '2026-01-10T15:00:00.000Z', expiry_dispatch_notified_at: null },
  { id: gid('9412', 3), person_name: 'Sid Sample', license_type: 'Journeyman Plumber #99117', date_of_expiry: day(23), note: null, created_at: '2026-01-10T15:00:00.000Z', expiry_dispatch_notified_at: null },
  { id: gid('9412', 4), person_name: 'Hal Sample', license_type: 'Plumber Apprentice #99109', date_of_expiry: day(-12), note: null, created_at: '2026-01-10T15:00:00.000Z', expiry_dispatch_notified_at: null },
  { id: gid('9412', 5), person_name: 'Eli Sample', license_type: 'Tradesman Plumber #99133', date_of_expiry: '2027-01-31', note: null, created_at: '2026-01-10T15:00:00.000Z', expiry_dispatch_notified_at: null },
  { id: gid('9412', 6), person_name: 'Cora Sample', license_type: 'Notary #99000111', date_of_expiry: '2028-05-31', note: null, created_at: '2026-01-10T15:00:00.000Z', expiry_dispatch_notified_at: null },
]
const people = [{ id: gid('9413', 1), name: 'Sam Plumber', kind: 'sub', license: 'Master Plumber #99108', archived_at: null }]

// The pulls: invented counts, with what each file kept equal to the rows above.
const CLS = { RMP: 'responsible_master', MP: 'master', JP: 'journeyman', TP: 'tradesman', PA: 'apprentice' }
const FILES = [['RMP', 151], ['MP', 73], ['JP', 437], ['TP', 61], ['PA', 702]]
const pulls = []
FILES.forEach(([file, seen], i) => {
  const kept = roll.filter((r) => r.license_class === CLS[file]).length
  pulls.push({ id: gid('9414', i + 1), source: 'tsbpe', trade: 'plumbing', file, started_at: `2026-11-23T12:${30 + i * 5}:00.000Z`, finished_at: `2026-11-23T12:${30 + i * 5}:41.000Z`, rows_seen: seen, rows_kept: kept, added: i === 2 ? 2 : 0, changed: [3, 1, 0, 1, 0][i], gone: 0, error: '', pulled_by: null })
  if (file !== 'PA') pulls.push({ id: gid('9414', 10 + i), source: 'tsbpe', trade: 'plumbing', file, started_at: `2026-11-21T19:0${i}:00.000Z`, finished_at: `2026-11-21T19:0${i}:38.000Z`, rows_seen: seen - 2, rows_kept: kept - (i === 2 ? 2 : 0), added: kept - (i === 2 ? 2 : 0), changed: 0, gone: 0, error: '', pulled_by: U('01') })
})
const counties = COUNTIES.map((county, i) => ({ id: gid('9415', i + 1), county }))
const changes = [
  { id: gid('9416', 1), roll_id: STAR.id, pull_id: null, seen_on: '2026-11-21', kind: 'first_seen', was: {}, now_is: {}, created_at: '2026-11-21T19:01:00.000Z' },
  { id: gid('9416', 2), roll_id: STAR.id, pull_id: null, seen_on: '2026-11-23', kind: 'endorsement', was: { endorsements: [] }, now_is: { endorsements: ['medical_gas'] }, created_at: '2026-11-23T12:35:00.000Z' },
  { id: gid('9416', 3), roll_id: STAR.id, pull_id: null, seen_on: '2026-11-23', kind: 'moved', was: { zip: '78130', county: 'COMAL' }, now_is: { zip: '78666', county: 'HAYS' }, created_at: '2026-11-23T12:35:00.000Z' },
]
const noteOn = (r, i, body, by, byName, at) => ({ id: gid('9417', i), source: r.source, license_class: r.license_class, license_number: r.license_number, name_key: r.name_key, body, noted_by: by, noted_by_name: byName, noted_at: at })
const others = roll.filter((r) => !r.ours && r !== STAR && r.license_class !== 'apprentice')
const notes = [
  noteOn(STAR, 1, 'Worked a retail shell beside us last spring. Clean work.', U('02'), 'Max Sample', '2026-11-23T16:20:00.000Z'),
  noteOn(STAR, 2, 'Made master on October 30. Worth a call once the list is ready.', U('01'), 'Devon Sample', '2026-11-23T21:05:00.000Z'),
  noteOn(roll[1], 3, 'Held journeyman since 2015.', U('03'), 'Rosa Sample', '2026-11-22T15:00:00.000Z'),
  noteOn(others[4], 4, 'Asked about us at the supply house counter.', U('03'), 'Rosa Sample', '2026-11-23T17:45:00.000Z'),
  noteOn(others[11], 5, 'Used to run service calls nearby.', U('02'), 'Max Sample', '2026-11-23T18:10:00.000Z'),
]
const leftOff = [{ id: gid('9418', 1), source: 'tsbpe', license_class: 'journeyman', license_number: '99291', name_key: 'testcase|blair|78155', shown_as: 'Blair Testcase', note: 'Asked by phone not to be listed.', noted_by: U('03'), noted_by_name: 'Rosa Sample', noted_at: '2026-11-23T19:30:00.000Z' }]

module.exports = { STAR, roll, users, day,
  extra: (viewerRole = 'dev', more = {}) => ({
    tables: { users: users(viewerRole), license_roll: roll, license_roll_counties: counties, license_roll_pulls: pulls, license_roll_changes: changes, license_roll_notes: notes, license_roll_left_off: leftOff, person_licenses: personLicenses, people, ...(more.tables ?? {}) },
    rpc: { ...(more.rpc ?? {}) }, functions: { ...(more.functions ?? {}) },
  }),
}
