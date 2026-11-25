const { open, done } = require('../lib.cjs')
const U = require('./rows284.cjs')
const extra = { tables: { roster_people: U.roster, clock_sessions: U.sessions, person_available_hours: U.answers, user_time_off: U.timeOff }, add: { users: U.newUsers }, rpc: { list_people_pay_flags: U.payFlags } }
;(async () => {
  {
    const p = await open({ as: 'controller', theme: 'light', width: 1280, height: 1500, extra })
    await p.go('/people?tab=utilization')
    console.log(await p.errs())
    await p.shot('284-utilization-desk-light.png')
    const row = (name) => p.locator('tr', { hasText: name }).first()
    await row('Sid Sample').getByRole('button', { name: 'Weeks' }).click()
    await p.waitForTimeout(500)
    const a = await row('Sid Sample').boundingBox()
    const b = await row('Ty Sample').boundingBox()
    await p.shot('284-utilization-weeks-desk-light.png', { clip: { x: a.x, y: a.y - 4, width: a.width, height: b.y - a.y + 4 } })
    await row('Hal Sample').getByRole('button', { name: 'Change' }).click()
    await p.waitForTimeout(800)
    const dlg = p.getByRole('dialog').first()
    await p.shot('284-set-hours-desk-light.png', { locator: dlg })
    await p.close2()
  }
  {
    const p = await open({ as: 'controller', theme: 'dark', width: 1280, height: 1060, extra })
    await p.go('/people?tab=utilization')
    await p.shot('284-utilization-desk-dark.png', { clip: { x: 0, y: 170, width: 1280, height: 890 } })
    await p.close2()
  }
  {
    const p = await open({ as: 'helpers', theme: 'light', width: 390, height: 844, phone: true, scale: 1, extra: { tables: { clock_sessions: U.sessions, person_available_hours: U.answers.filter((a) => a.user_id === '00000000-0000-4194-8000-000000000009') } } })
    await p.go('/dashboard')
    console.log((await p.asks(/clock_sessions|available|missing|refused|unread/)).join(' ; '), await p.errs())
    await p.shot('A-t7.png', { full: true })
    await p.close2()
  }
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
