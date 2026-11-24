const { open, done } = require('../lib.cjs')
const U = require('./rows284.cjs')
const extra = { tables: { roster_people: U.roster, clock_sessions: U.sessions, person_available_hours: U.answers, user_time_off: U.timeOff }, add: { users: U.newUsers }, rpc: { list_people_pay_flags: U.payFlags } }
;(async () => {
  const p = await open({ as: 'controller', theme: 'dark', width: 1280, height: 1300, extra })
  await p.go('/people?tab=utilization')
  console.log(await p.errs())
  await p.shot('284-utilization-desk-dark.png', { clip: { x: 0, y: 170, width: 1280, height: 890 } })
  await p.close2(); await done()
})().catch((e) => { console.error(e); process.exit(1) })
