const { done } = require('../lib.cjs')
const { start, tail } = require('./ph3.cjs')
const modes = process.argv.slice(2)
;(async () => {
  for (const mode of modes) {
    console.log('=====', mode)
    if (mode === 'card') {
      const p = await start({ role: 'primary' })
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300)
      await p.shot('189-job-mode-press-bar-phone-light.png')
      await p.close2()
    }
    if (mode === 'omw') {
      const p = await start({ role: 'primary', geo: true })
      await p.getByRole('button', { name: 'On my way' }).last().click()
      await p.waitForTimeout(3000)
      await p.shot('189-on-my-way-sheet-phone-light.png', { clip: { x: 0, y: 0, width: 390, height: 730 } })
      await p.close2()
    }
    if (mode === 'report') {
      const p = await start({ role: 'primary' })
      await p.evaluate(() => window.scrollTo(0, 0))
      p.on('filechooser', () => console.log('FILECHOOSER: the press asked for the camera'))
      await p.getByRole('button', { name: 'Leave report' }).last().click()
      await p.waitForTimeout(3000)
      console.log(await p.evaluate(() => { const t = document.body.innerText; const i = t.lastIndexOf('Take a photo'); return t.slice(Math.max(0, i - 200), i + 900) }))
      await p.shot('189-field-report-phone-light.png')
      await p.close2()
    }
    if (mode === 'stepper') {
      const p = await start({ role: 'helpers' })
      const b = p.getByRole('button', { name: 'Update % done' }).first()
      const head = p.getByText(/^My Schedule$/).first()
      await head.scrollIntoViewIfNeeded()
      await p.evaluate(() => window.scrollBy(0, 260))
      await p.waitForTimeout(600)
      console.log('SCROLL', await p.evaluate(() => window.scrollY), JSON.stringify(await b.boundingBox()))
      await p.shot('189-my-schedule-phone-light.png')
      await b.click()
      await p.waitForTimeout(2500)
      await p.shot('189-my-schedule-stepper-phone-light.png')
      await p.close2()
    }
    if (mode === 'window') {
      const p = await start({ role: 'helpers', theme: 'dark' })
      await p.evaluate(() => window.scrollTo(0, 0))
      const before = new Set(await p.asks())
      await p.getByRole('button', { name: 'Job details' }).first().click()
      await p.waitForTimeout(3500)
      console.log('NEW ASKS\n' + (await p.asks()).filter((l) => !before.has(l) && !/ world | rule /.test(l)).join('\n'))
      // The frame's badge sits on the bar's first press at this height, so it is lifted above the bar for this one picture. It stays in the picture.
      console.log('BADGE', await p.evaluate(() => { const el = [...document.querySelectorAll('body *')].filter((e) => (e.textContent || '').trim().startsWith('Lens · invented data') && e.children.length === 0).pop(); if (!el) return null; let box = el; while (box.parentElement && getComputedStyle(box).position !== 'fixed') box = box.parentElement; box.style.bottom = '72px'; return getComputedStyle(box).position }))
      await p.waitForTimeout(300)
      await p.shot('189-job-window-bar-phone-dark.png')
      await p.close2()
    }
  }
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
