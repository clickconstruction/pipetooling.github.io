const { open, done } = require('../lib.cjs')
const U = require('./rows284.cjs')
const HAL = '00000000-0000-4194-8000-000000000009'
const mine = U.sessions.filter((s) => s.user_id === HAL)
const clipMyTime = async (p) => {
  const head = p.getByText('My Time', { exact: true }).first()
  await head.scrollIntoViewIfNeeded()
  await p.waitForTimeout(300)
  const a = await head.boundingBox()
  const line = p.locator('[data-testid="my-time-can-work"]').first()
  const b = await line.boundingBox()
  const top = Math.max(0, a.y - 14)
  return { x: 0, y: top, width: 390, height: Math.min(844 - top, b.y + b.height + 22 - top) }
}
;(async () => {
  for (const [state, answers, theme] of [['drawn', U.answers.filter((a) => a.user_id === HAL), 'light'], ['ask', [], 'light']]) {
    const p = await open({ as: 'helpers', theme, width: 390, height: 844, phone: true, scale: 2, extra: { tables: { clock_sessions: mine, person_available_hours: answers } } })
    await p.go('/dashboard')
    const head = p.getByText('My Time', { exact: true }).first()
    const y = await head.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    await p.evaluate((y) => window.scrollTo(0, y - 60), y)
    await p.waitForTimeout(500)
    const clip = await clipMyTime(p)
    console.log(state, clip, (await p.locator('[data-testid="my-time-can-work"]').first().innerText()).replace(/\n/g, ' / '))
    await p.shot(`284-my-time-${state}-phone-${theme}.png`, { clip })
    if (state === 'drawn') {
      await p.locator('[data-testid="my-time-can-work"]').getByRole('button', { name: 'Change' }).click()
      await p.waitForTimeout(900)
      const dlg = p.getByRole('dialog').first()
      console.log((await dlg.innerText()).replace(/\n+/g, ' / ').slice(0, 600), await dlg.boundingBox())
      await p.shot('284-draw-week-phone-light.png')
    }
    console.log(await p.errs())
    await p.close2()
  }
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
