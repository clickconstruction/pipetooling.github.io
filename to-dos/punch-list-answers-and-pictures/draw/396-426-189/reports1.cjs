const { open, done } = require('../lib.cjs')
const { P, JOB, id, day, QUIET } = require('./world.cjs')
// Chicago is UTC-6 in late November.
const when = (offset, hm) => `${day(offset)}T${hm}:00-06:00`
const R = (n) => id('8c04', n)
const rep = (n, job, num, name, addr, who, at, tpl, fields, link) => ({
  id: R(n), template_id: id('8c05', 1), template_name: tpl, created_at: at, updated_at: at, created_by_name: who.name, created_by_user_id: who.id, field_values: fields,
  job_ledger_id: JOB(job), job_display_name: name, job_hcp_number: num, job_address: addr, job_job_pictures_link: link, job_google_drive_link: null, bid_id: null, project_id: null, reported_at_lat: null, reported_at_lng: null,
})
const SHELL = [2, '1318', 'Sample Retail Shell rough-in', '400 Sample Pkwy, Kyle, TX']
const CEDAR = [3, '1321', 'Cedar Bend Apartments, building C', 'San Marcos, TX']
const LEAK = [5, '1327', 'Leak under slab', '100 Sample St, Kyle, TX']
const HEATER = [1, '1312', 'Water heater replacement', '100 Sample St, Kyle, TX']
const PICS = 'https://example.com/pictures'
const reports = [
  rep(1, ...SHELL, P.primary, when(0, '09:48'), 'Field report', { 'What got done': 'Set the second floor carriers. Water test holds on the east riser.', 'What is in the way': 'Framers still have the west chase closed.' }, `${PICS}/1318`),
  rep(2, ...SHELL, P.helpers, when(0, '07:55'), 'Field report', { 'What got done': 'Unloaded the cast iron and staged it by the east stair.' }, `${PICS}/1318`),
  rep(3, ...CEDAR, P.subcontractor, when(-1, '15:31'), 'Field report', { 'What got done': 'Topped out units 301 to 306.' }, `${PICS}/1321`),
  rep(4, ...LEAK, P.primary, when(-1, '13:02'), 'Field report', { 'What got done': 'Found the leak under the hall bath. Rerouted the hot line overhead.' }, null),
  rep(5, ...SHELL, P.primary, when(-1, '11:20'), 'Field report', { 'What got done': 'Rough-in on the first floor restrooms.' }, `${PICS}/1318`),
  rep(6, ...CEDAR, P.subcontractor, when(-4, '16:05'), 'Field report', { 'What got done': 'Underground inspection passed on building C.' }, `${PICS}/1321`),
  rep(7, ...SHELL, P.helpers, when(-4, '14:40'), 'Field report', { 'What got done': 'Hung the hangers on gridlines 4 to 7.' }, `${PICS}/1318`),
  rep(8, ...HEATER, P.primary, when(-5, '12:15'), 'Field report', { 'What got done': 'New heater is in and lit. Old one hauled off.' }, `${PICS}/1312`),
  rep(9, ...CEDAR, P.subcontractor, when(-6, '15:50'), 'Field report', { 'What got done': 'Set sleeves on the third floor deck.' }, `${PICS}/1321`),
]
const role = process.argv[2] || 'superintendent'
const theme = process.argv[3] || 'light'
const me = P[role]
const extra = {
  tables: {
    report_reads: [
      { id: id('8c06', 1), user_id: me.id, report_id: R(8), read_at: when(-5, '13:00'), done_at: null },
      { id: id('8c06', 2), user_id: me.id, report_id: R(9), read_at: when(-6, '16:30'), done_at: null },
    ],
  },
  rpc: { ...QUIET, list_reports_with_job_info: reports, list_project_board: { reads_wages: false, jobs: [] } },
}
;(async () => {
  const p = await open({ as: role, theme, width: 390, height: 844, phone: true, scale: 2, extra })
  await p.clock.setFixedTime(new Date('2026-11-24T10:20:00-06:00'))
  await p.go('/dashboard')
  console.log((await p.asks(/missing|refused|unread|report/)).join('\n'))
  console.log(JSON.stringify(await p.errs()).slice(0, 800))
  const h = p.getByText(/^Recent Reports$/).first()
  await p.setViewportSize({ width: 390, height: 1500 })
  await p.waitForTimeout(400)
  await h.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await p.evaluate(() => window.scrollBy(0, -20))
  await p.waitForTimeout(500)
  console.log(await p.evaluate(() => { const t = document.body.innerText; const i = t.indexOf('Recent Reports'); return t.slice(i, i + 1300) }))
  const b = await p.evaluate(() => {
    const head = [...document.querySelectorAll('h2,h3,button,div,span,strong')].find((e) => (e.textContent || '').trim() === 'Recent Reports')
    let el = head
    while (el && !(el.getBoundingClientRect().height > 250)) el = el.parentElement
    const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  console.log('BOX', JSON.stringify(b))
  await p.shot(`426-recent-reports-phone-${theme}.png`, { clip: { x: 0, y: Math.max(0, b.y - 8), width: 390, height: Math.min(b.height + 16, 1480) } })
  await p.close2(); await done()
})().catch((e) => { console.error(e); process.exit(1) })
