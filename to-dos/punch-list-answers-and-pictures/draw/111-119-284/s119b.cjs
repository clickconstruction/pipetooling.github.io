const { open, done } = require('../lib.cjs')
const R = require('./rows.cjs')
const shots = [
  ['09-ball-gate-and-check-valves', 'light', '119-water-in-valves-phone-light.png'],
  ['13-the-trap-and-its-seal', 'dark', '119-water-out-trap-phone-dark.png'],
  ['21-a-clog', 'light', '119-conditions-clog-strip-phone-light.png'],
  ['17-sanitary-tee-vs-wye', 'light', '119-water-out-fittings-phone-light.png'],
]
;(async () => {
  for (const [k, theme, file] of shots) {
    const p = await open({ as: 'helpers', theme, width: 390, height: 844, phone: true, scale: 2, extra: { tables: { training_courses: R.courses, training_lesson_passes: R.lessonPasses(R.HAL, 'intro-to-plumbing', 8), training_passes: [] } } })
    await p.go('/training/intro-to-plumbing?lesson=' + k, 1500)
    const art = p.locator('article[data-lesson]')
    console.log(k, await art.getAttribute('data-lesson'), await p.errs())
    const y = await art.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    await p.evaluate((y) => window.scrollTo(0, y - 14), y)
    await p.waitForTimeout(500)
    await p.shot(file)
    await p.close2()
  }
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
