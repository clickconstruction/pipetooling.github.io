const { open, done } = require('../lib.cjs')
const R = require('./rows.cjs')
const states = {
  red: { training_lesson_passes: R.lessonPasses(R.HAL, 'osha-30-refresher', 12), training_passes: [] },
  amber: { training_lesson_passes: [...R.lessonPasses(R.HAL, 'osha-30-refresher', 30, 400), ...R.lessonPasses(R.HAL, 'intro-to-plumbing', 30, 60)], training_passes: [R.pass(R.HAL, 'osha-30-refresher', 351, 18), R.pass(R.HAL, 'intro-to-plumbing', 24, 19)] },
  green: { training_lesson_passes: [...R.lessonPasses(R.HAL, 'osha-30-refresher', 30, 80), ...R.lessonPasses(R.HAL, 'intro-to-plumbing', 30, 60)], training_passes: [R.pass(R.HAL, 'osha-30-refresher', 38, 18), R.pass(R.HAL, 'intro-to-plumbing', 24, 19)] },
}
;(async () => {
  for (const [name, t] of Object.entries(states)) {
    for (const theme of name === 'red' ? ['light', 'dark'] : ['light']) {
      const p = await open({ as: 'helpers', theme, width: 390, height: 844, phone: true, scale: 2, extra: { tables: { training_courses: R.courses, ...t } } })
      await p.go('/dashboard')
      const card = p.locator('[data-training-card]')
      await card.scrollIntoViewIfNeeded()
      await p.waitForTimeout(400)
      console.log(name, theme, await card.getAttribute('data-training-card'), '|', (await card.innerText()).replace(/\n+/g, ' / '))
      console.log((await p.asks(/training/)).join('\n'))
      await p.shot(`111-dashboard-${name}-phone-${theme}.png`, { locator: card })
      await p.close2()
    }
  }
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
