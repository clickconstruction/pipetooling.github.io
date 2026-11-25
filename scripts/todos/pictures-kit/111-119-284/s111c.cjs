const { open, done } = require('../lib.cjs')
const R = require('./rows.cjs')
const P = R.PEOPLE
const order = { red: 0, amber: 1, green: 2 }
const worst = (rows) => rows.sort((a, b) => order[a.colour] - order[b.colour])
const standings = {
  'osha-30-refresher': worst([R.standing(P.max, 12, 36), R.standing(P.paco, 12, 352), R.standing(P.sid, 12, 35), R.standing(P.sam, 12, null), R.standing(P.hal, 12, null), R.standing(P.gus, 12, 30), R.standing(P.nell, 12, 372), R.standing(P.ty, 12, null)]),
  'intro-to-plumbing': worst([R.standing(P.hal, 120, null), R.standing(P.gus, 120, 22), R.standing(P.nell, 120, 19), R.standing(P.ty, 120, null), R.standing(P.devon, 120, 37)]),
  'intro-electrical': worst([R.standing(P.devon, 120, null)]),
}
const passes = [R.pass(P.max.id, 'osha-30-refresher', 36), R.pass(P.sid.id, 'osha-30-refresher', 35), R.pass(P.gus.id, 'osha-30-refresher', 30), R.pass(P.paco.id, 'osha-30-refresher', 352), R.pass(P.nell.id, 'osha-30-refresher', 372),
  R.pass(P.gus.id, 'intro-to-plumbing', 22), R.pass(P.nell.id, 'intro-to-plumbing', 19), R.pass(P.devon.id, 'intro-to-plumbing', 37), R.pass(P.rosa.id, 'intro-to-plumbing', 12), R.pass(P.eli.id, 'intro-to-plumbing', 9),
  R.pass(P.max.id, 'intro-electrical', 15), R.pass(P.eli.id, 'intro-electrical', 6)]
;(async () => {
  for (const theme of ['light']) {
    const p = await open({ as: 'dev', theme, width: 1280, height: 900, extra: { tables: { training_courses: R.courses, training_lesson_passes: [], training_passes: passes } } })
    await R.rpcByArg(p, 'training_standings', 'p_course_slug', standings)
    await p.go('/settings?tab=settings-training')
    console.log((await p.asks(/training/)).join(' ; '), await p.errs())
    const tab = p.locator('[data-settings-training]')
    const osha = p.locator('[data-training-policy="osha-30-refresher"]')
    await osha.getByText('See who').click()
    await p.waitForTimeout(400)
    console.log((await osha.innerText()).replace(/\n+/g, ' / '))
    await p.shot('111-settings-training-desk-light.png', { locator: tab })
    await p.shot('111-settings-osha-who-desk-light.png', { locator: osha })
    await p.close2()
  }
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
