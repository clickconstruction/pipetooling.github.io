// Invented rows for #284: a roster, eight pay weeks of clock sessions, the answers people gave, a day off.
const R = require('./rows.cjs')
const P = R.PEOPLE
const MASTER = P.max.id
const pid = (n) => `00000000-0000-4194-8008-${String(n).padStart(12, '0')}`
const PERSON_ID = { devon: pid(1), max: pid(2), rosa: pid(3), cora: pid(4), eli: pid(5), paco: pid(6), sid: pid(7), sam: pid(8), hal: pid(9), gus: pid(21), nell: pid(22), ty: pid(23) }

// Chicago wall time to ISO with the right offset (daylight time ended 2026-11-01).
const off = (ymd) => (ymd < '2026-11-01' ? '-05:00' : '-06:00')
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}:00`
const at = (ymd, min) => `${ymd}T${hhmm(min)}${off(ymd)}`
const addDays = (ymd, n) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const TODAY = (() => { const o = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value])); return `${o.year}-${o.month}-${o.day}` })()
const dow = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay()
const THIS_SUNDAY = addDays(TODAY, -dow(TODAY))
const WEEKS = Array.from({ length: 8 }, (_, i) => addDays(THIS_SUNDAY, (i - 7) * 7)) // oldest first, the current week last

const day = (s, e) => [[s * 60, e * 60]]
const WEEK_MAX = [[], day(7, 15), day(7, 15), day(7, 15), day(7, 15), day(7, 15), []] // 40 h
const WEEK_HAL = [[], day(7, 15), day(7, 15), day(7, 15), day(7, 15), day(7, 13), []] // 38 h, off at 1 on Fridays
const WEEK_NELL = [[], day(7, 15), day(7, 15), day(7, 15), day(7, 15), [], []] // 32 h, Monday to Thursday
const WEEK_PACO = [[], day(6.5, 14.5), day(6.5, 14.5), day(6.5, 14.5), day(6.5, 14.5), day(6.5, 14.5), []] // 40 h

// Hours a full week, oldest first (seven full weeks); the current week takes Monday at the last week's day length.
const plan = {
  max: { start: 7, days: [1, 2, 3, 4, 5], weeks: [41, 40, 42, 44.5, 46, 47, 46] },
  hal: { start: 7, days: [1, 2, 3, 4, 5], weeks: [36, 38, 37.5, 38, 39.5, 36, 38], fri: 6 },
  sam: { start: 8, days: [1, 2, 4], weeks: [22, 24, 20, 25, 24, 21, 23] },
  sid: { start: 6.5, days: [1, 2, 3, 4, 5], weeks: [34, 36, 35, 33, 28, 35, 34] },
  gus: { start: 7, days: [1, 2, 3, 4], weeks: [30, 26, 22, 20, 18, 22, 16] },
  nell: { start: 7, days: [1, 2, 3, 4], weeks: [32, 31, 33, 32, 30, 32, 32] },
  ty: { start: 7, days: [1, 2, 3, 4, 5], weeks: [38, 40, 36, 30, 0, 0, 0] },
  rosa: { start: 8, days: [1, 2, 3, 4, 5], weeks: [38, 40, 39, 37.5, 40, 38, 39] },
  eli: { start: 8.5, days: [1, 2, 3, 4], weeks: [28, 30, 31, 29, 30, 27, 29] },
  paco: { start: 6.5, days: [1, 2, 3, 4, 5], weeks: [40, 41, 39, 40, 42, 40, 41] },
  // Salaried: the schedule makes her sessions, 8 to 4 every weekday.
  cora: { start: 8, days: [1, 2, 3, 4, 5], weeks: [40, 40, 40, 40, 40, 40, 40], origin: 'salary_schedule' },
}
const SID_OFF = addDays(WEEKS[4], 5) // a Friday off in the fifth week

let n = 0
const sessions = []
for (const [who, pl] of Object.entries(plan)) {
  WEEKS.forEach((sunday, wi) => {
    const hours = wi < 7 ? pl.weeks[wi] : pl.weeks[6]
    if (!hours) return
    let days = pl.days.slice()
    if (who === 'sid' && wi === 4) days = days.filter((d) => d !== 5)
    const friH = pl.fri && days.includes(5) ? pl.fri : null
    const rest = friH ? (hours - friH) / (days.length - 1) : hours / days.length
    for (const d of days) {
      const ymd = addDays(sunday, d)
      if (ymd >= TODAY) continue
      const h = friH && d === 5 ? friH : rest
      // A few minutes of real life on each punch.
      const jitter = pl.origin ? 0 : ((n * 7) % 9) - 4
      const inMin = pl.start * 60 + jitter
      const outMin = inMin + Math.round(h * 60)
      n += 1
      const old = ymd < addDays(TODAY, -8)
      sessions.push({
        id: `00000000-0000-4194-8005-${String(1000 + n).padStart(12, '0')}`,
        user_id: P[who].id, work_date: ymd, clocked_in_at: at(ymd, inMin), clocked_out_at: at(ymd, outMin),
        approved_at: old ? at(addDays(ymd, 3), 9 * 60) : null, approved_by: old ? P.cora.id : null,
        rejected_at: null, rejected_by: null, revoked_at: null, revoked_by: null,
        origin: pl.origin || 'user_punch', job_ledger_id: pl.origin ? null : '00000000-0000-4194-8002-000000000002', bid_id: null, notes: '', created_at: at(ymd, inMin),
      })
    }
  })
}

const answer = (k, who, hours, days, fromSunday, setBy, note = null) => ({
  id: `00000000-0000-4194-80a1-${String(k).padStart(12, '0')}`, user_id: P[who].id, hours_per_week: hours, days, effective_from: fromSunday,
  set_by: P[setBy].id, created_at: at(addDays(fromSunday, 1), 16 * 60), note, kind: 'answer',
})
const answers = [
  answer(1, 'max', 40, WEEK_MAX, WEEKS[1], 'max'),
  answer(2, 'hal', 38, WEEK_HAL, WEEKS[2], 'hal'),
  answer(3, 'sam', 24, null, WEEKS[1], 'cora', 'Three days a week on our jobs'),
  answer(4, 'gus', 40, null, WEEKS[0], 'gus'),
  answer(5, 'nell', 32, WEEK_NELL, WEEKS[3], 'nell'),
  answer(6, 'eli', 30, null, WEEKS[2], 'eli'),
  answer(7, 'paco', 40, WEEK_PACO, WEEKS[4], 'paco'),
]

const roster = Object.keys(PERSON_ID).filter((k) => k !== 'devon').map((k) => {
  const p = P[k]
  const left = k === 'ty'
  return {
    user_id: p.id, person_id: PERSON_ID[k], row_key: `u:${p.id}`, pay_name: p.name, account_name: p.name, roster_name: p.name,
    role: p.role, kind: p.role === 'subcontractor' ? 'sub' : 'employee', account_kind: 'person',
    is_digital_twin: false, is_sample: false, is_walk_tester: false, is_dev: false, read_only: false, needs_supervision: false,
    user_archived_at: left ? at(addDays(WEEKS[3], 6), 17 * 60) : null, person_archived_at: null, is_archived: left,
    is_pay_roster: !left, is_active_roster: !left, has_login: true, has_roster_row: true,
    start_date: k === 'nell' ? addDays(WEEKS[0], -20) : '2025-03-03', end_date: left ? addDays(WEEKS[3], 5) : null, master_user_id: MASTER,
  }
})

const timeOff = [{ id: '00000000-0000-4194-80b1-000000000001', user_id: P.sid.id, start_date: SID_OFF, end_date: SID_OFF, kind: 'time_off', note: 'Day off', created_at: at(addDays(SID_OFF, -7), 600), updated_at: at(addDays(SID_OFF, -7), 600) }]
const payFlags = [{ person_name: 'Cora Sample', person_id: PERSON_ID.cora, is_salary: true, record_hours_but_salary: false, show_in_hours: false, salaried_week_hours: null }]
const newUsers = ['gus', 'nell', 'ty'].map((k) => ({ id: P[k].id, name: P[k].name, email: `${k}@lens.example.com`, phone: `(512) 555-01${P[k].id.slice(-2)}`, role: 'helpers', title: 'Helper', read_only: false, is_sample: true, is_digital_twin: false, is_walk_tester: false, calibration_standard: false, needs_supervision: false, estimator_prospects_access: false, team_prospects_access: false, dispatch_mode_enabled: false, archived_at: null, created_at: '2026-01-05T15:00:00.000Z' }))

module.exports = { sessions, answers, roster, timeOff, payFlags, newUsers, WEEKS, TODAY, WEEK_HAL, PERSON_ID, at, addDays }
if (require.main === module) console.log(TODAY, WEEKS, sessions.length, sessions[0], sessions[sessions.length - 1])
