const { open, done } = require('../lib.cjs')
const { NOW, extra, CONTACT } = require('./world421.cjs')
async function thread(theme, contact, scale = 1.5) {
  const p = await open({ as: 'assistant', theme, width: 1280, height: 1120, scale, extra: extra() })
  await p.clock.install({ time: new Date(NOW) })
  await p.go('/messages?thread=' + CONTACT(contact))
  await p.waitForTimeout(1500)
  return p
}
;(async () => {
  for (const theme of ['light', 'dark']) {
    const p = await thread(theme, 4)
    await p.shot(`421-trade-thread-desk-${theme}.png`, { clip: { x: 91, y: 41, width: 1034, height: 712 } })
    if (theme === 'light') {
      await p.getByRole('button', { name: 'Another day' }).first().click()
      await p.waitForTimeout(600)
      await p.shot('421-voicemail-another-day-desk-light.png', { clip: { x: 91, y: 590, width: 1034, height: 200 } })
    }
    await p.close2()
  }
  const q = await thread('light', 1)
  await q.shot('421-customer-choice-desk-light.png', { clip: { x: 91, y: 41, width: 675, height: 420 } })
  await q.close2(); await done()
})().catch((e) => { console.error(e); process.exit(1) })
