// Shared invented rows for agent C's cards. Lens people and ids as in src/lib/lens.
const uid = (n) => `00000000-0000-4194-8000-0000000000${n}`
const id = (group, n) => `00000000-0000-4194-${group}-${String(n).padStart(12, '0')}`
const P = {
  dev: { id: uid('01'), role: 'dev', name: 'Devon Sample', label: 'Dev' },
  master_technician: { id: uid('02'), role: 'master_technician', name: 'Max Sample', label: 'Leader' },
  assistant: { id: uid('03'), role: 'assistant', name: 'Rosa Sample', label: 'Assistant' },
  controller: { id: uid('04'), role: 'controller', name: 'Cora Sample', label: 'Controller' },
  estimator: { id: uid('05'), role: 'estimator', name: 'Eli Sample', label: 'Estimator' },
  primary: { id: uid('06'), role: 'primary', name: 'Paco Sample', label: 'Primary' },
  superintendent: { id: uid('07'), role: 'superintendent', name: 'Sid Sample', label: 'Superintendent' },
  subcontractor: { id: uid('08'), role: 'subcontractor', name: 'Sam Plumber', label: 'Subcontractor' },
  helpers: { id: uid('09'), role: 'helpers', name: 'Hal Sample', label: 'Helper' },
}
const n2 = (p) => p.id.slice(-2)
function users(over = {}) {
  return Object.values(P).map((p) => ({
    id: p.id, name: p.name, email: `${p.name.split(' ')[0].toLowerCase()}@lens.example.com`, phone: `(512) 555-01${n2(p)}`, role: p.role, title: p.label,
    read_only: false, is_sample: true, is_digital_twin: false, is_walk_tester: false, calibration_standard: false, needs_supervision: false,
    estimator_prospects_access: false, team_prospects_access: false, dispatch_mode_enabled: false, archived_at: null, created_at: '2026-01-05T15:00:00.000Z',
    ...(over[p.role] || {}),
  }))
}
const JOB = (n) => id('8002', n)
const BID = (n) => id('8006', n)
const TODAY = '2026-11-24'
function day(offset, from = TODAY) { const d = new Date(`${from}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10) }
module.exports = { P, uid, id, users, JOB, BID, TODAY, day }
// Quiet answers for reads the lens has no answer for yet, each in the shape its caller parses as "nothing here".
module.exports.QUIET = {
  start_check_arrival_state: { ok: true, stage: null },
  trip_phone_state: { ok: false },
  on_site_door_facts: { boxes: 0, due: 0, stickers: 0 },
  my_customer_words: [],
  my_week: null,
  superintendent_scores: { rows: [] },
}
