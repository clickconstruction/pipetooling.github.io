const { open, done } = require('../lib.cjs')
const { NOW, extra } = require('./world125.cjs')
;(async () => {
  const p = await open({ as: 'assistant', theme: 'light', width: 1440, height: 860, scale: 1.5, extra: extra() })
  await p.clock.install({ time: new Date(NOW) })
  await p.go('/jobs?tab=stages')
  const box = p.getByLabel('Job activity for Leak under slab').first()
  await box.scrollIntoViewIfNeeded()
  await box.hover()
  await p.waitForTimeout(1200)
  await box.getByLabel('Expand job activity').click()
  await p.waitForTimeout(2000)
  await p.getByRole('tab', { name: /^Customer/ }).click()
  await p.waitForTimeout(600)
  await p.getByRole('button', { name: 'Reply to Sam’s text', exact: true }).click()
  await p.waitForTimeout(2500)
  const rect = await p.getByRole('dialog').last().evaluate((el) => {
    let best = null
    for (const c of el.querySelectorAll('*')) { const r = c.getBoundingClientRect(); if (r.width > 600 && r.width < innerWidth - 100 && r.height > 400) { best = { x: r.x, y: r.y, width: r.width, height: r.height }; break } }
    return best
  })
  console.log(rect)
  await p.shot('125-job-activity-reply-desk-light.png', { clip: { x: rect.x - 8, y: rect.y - 8, width: rect.width + 16, height: rect.height + 16 } })
  await p.close2(); await done()
})().catch((e) => { console.error(e); process.exit(1) })
