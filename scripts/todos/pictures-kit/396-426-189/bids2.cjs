const { open, done } = require('../lib.cjs')
const { P, BID, id, day, QUIET } = require('./world.cjs')
const GC = id('8001', 2), HOME = id('8001', 1), OWNER = id('8001', 3), PLUMB = id('8003', 1)
const at = (d, t = '15:00:00') => `${d}T${t}.000Z`
const base = { service_type_id: PLUMB, estimator_id: P.estimator.id, created_by: P.estimator.id, accepted_alternate_tags: [], alternate_group_tags: [], declined_alternate_tags: [], itb_links: [], holdout: false, bid_to_marked_plans: false, include_materials_by_stage: false, include_payment_schedule: false, include_schedule_of_values: false, materials_model: 'standard', robot_opt_out: false, sov_letter_total_only: false, sov_shape: 'standard', sov_split_labor_material: false }
const moreBids = [
  { ...base, id: BID(6), bid_number: 'B1296', project_name: 'Sample Clinic tenant finish', address: 'Kyle, TX', customer_id: GC, bid_due_date: day(-6), created_at: at(day(-30)) },
  { ...base, id: BID(7), bid_number: 'B1305', project_name: 'Hays Street duplex', address: 'Kyle, TX', customer_id: HOME, bid_due_date: null, created_at: at(day(-19)) },
  { ...base, id: BID(8), bid_number: 'B1271', project_name: 'Sample Owner LLC warehouse restrooms', address: 'Kyle, TX', customer_id: OWNER, bid_value: 64300, agreed_value: 64300, outcome: 'started_or_complete', outcome_at: at(day(-100)), bid_date_sent: day(-120), created_at: at(day(-140)) },
  { ...base, id: BID(9), bid_number: 'B1299', project_name: 'Sample Contracting office remodel', address: 'San Marcos, TX', customer_id: GC, bid_due_date: day(15), created_at: at(day(-12)) },
]
const extra = {
  add: { bids: moreBids },
  tables: {
    // One bid hidden earlier, on another device: it is in Hidden when the card loads.
    user_bid_notes_read_state: [{ user_id: P.estimator.id, bid_id: BID(9), last_seen_bid_submission_at: null, last_seen_customer_contact_at: null, hidden_at: at(day(-2)), updated_at: at(day(-2)) }],
    // A note someone else wrote on a sent bid: its group shows it though folded.
    bids_submission_entries: [{ id: id('8c03', 1), bid_id: BID(4), created_at: at(day(0), '14:35:00'), created_by: P.assistant.id, notes: 'Sam called. He wants to start the week of Dec 7 if the price holds.', occurred_at: at(day(0), '14:30:00'), contact_method: 'phone' }],
  },
  rpc: { ...QUIET },
}
const theme = process.argv[2] || 'light'
;(async () => {
  const p = await open({ as: 'estimator', theme, width: 390, height: 844, phone: true, scale: 2, extra })
  await p.clock.setFixedTime(new Date('2026-11-24T10:20:00-06:00'))
  await p.go('/dashboard')
  console.log((await p.asks(/missing|refused|unread/)).join('\n'))
  console.log(JSON.stringify(await p.errs()).slice(0, 800))
  const h = p.getByText(/^My Bids/).first()
  await h.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await p.evaluate(() => window.scrollBy(0, -16))
  await p.waitForTimeout(500)
  console.log(await p.evaluate(() => { const t = document.body.innerText; const i = t.indexOf('My Bids'); return t.slice(i, i + 1400) }))
  // The whole card at the phone's width: a tall window, cropped to the card.
  const cardBox = async () => p.evaluate(() => {
    const head = [...document.querySelectorAll('h2,h3,button,div,span')].find((e) => /^My Bids \(\d+\)$/.test((e.textContent || '').trim()))
    let el = head
    while (el && !(el.getBoundingClientRect().height > 300)) el = el.parentElement
    const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, tag: el.tagName, cls: el.className }
  })
  await p.setViewportSize({ width: 390, height: 1500 })
  await p.waitForTimeout(400)
  await h.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await p.evaluate(() => window.scrollBy(0, -16))
  await p.waitForTimeout(400)
  const b = await cardBox()
  console.log('BOX', JSON.stringify(b))
  await p.shot(`426-my-bids-groups-phone-${theme}.png`, { clip: { x: 0, y: Math.max(0, b.y - 8), width: 390, height: Math.min(b.height + 16, 1480) } })
  if (theme === 'light') {
    await p.setViewportSize({ width: 390, height: 844 })
    await p.waitForTimeout(400)
    await h.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await p.evaluate(() => window.scrollBy(0, -16))
    await p.waitForTimeout(400)
    const row = p.locator('[data-swipe-away-row]').filter({ hasText: 'Hays Street duplex' }).first()
    const rb = await row.boundingBox()
    console.log('ROWBOX', JSON.stringify(rb))
    const cdp = await p.context().newCDPSession(p)
    const y = rb.y + rb.height / 2
    let x = rb.x + rb.width - 50
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let i = 0; i < 18; i++) { x -= 8; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await p.waitForTimeout(25) }
    await p.waitForTimeout(250)
    console.log('STRIP', await row.locator('[data-swipe-away-strip]').getAttribute('data-swipe-away-strip'), await row.locator('[data-swipe-away-slide]').evaluate((e) => e.style.transform))
    await p.shot('426-my-bids-mid-swipe-phone-light.png', { clip: { x: 0, y: Math.max(0, rb.y - 250), width: 390, height: 560 } })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await p.waitForTimeout(500)
    // The folded group at the foot, opened, while the Undo is still up.
    const hid = p.getByText(/^Hidden$/).first()
    await hid.click()
    await p.waitForTimeout(300)
    await hid.evaluate((el) => { const r = el.getBoundingClientRect(); window.scrollBy(0, r.top - 330) })
    await p.waitForTimeout(350)
    console.log(await p.evaluate(() => { const t = document.body.innerText; const i = t.lastIndexOf('Hidden'); return t.slice(i, i + 600) }))
    console.log('TOAST', await p.evaluate(() => { const u = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Undo'); if (!u) return null; const r = u.getBoundingClientRect(); return { y: r.y, text: u.parentElement.innerText } }))
    await p.shot('426-my-bids-undo-phone-light.png')
  }
  await p.close2(); await done()
})().catch((e) => { console.error(e); process.exit(1) })
