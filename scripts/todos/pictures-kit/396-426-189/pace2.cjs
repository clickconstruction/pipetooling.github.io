const { open, done } = require('../lib.cjs')
const { P, users, JOB, id, QUIET } = require('./world.cjs')
const FX = (n) => id('8c01', n)
function board({ pct, values, labor, planned }) {
  return {
    reads_wages: false,
    jobs: [{
      id: JOB(3), hcp_number: '1321', click_number: '1321', job_name: 'Cedar Bend Apartments, building C', job_address: 'San Marcos, TX', status: 'working',
      pct_complete: pct, revenue: 212950, kind: 'project', bid_id: null, project_id: null, first_work_date: '2026-11-09', billing_only: false,
      fixtures: [
        { id: FX(1), name: 'Underground', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 42000, count: 1, progress_pct: 100, sequence_order: 1 },
        { id: FX(2), name: 'Rough-in', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 78000, count: 1, progress_pct: 60, sequence_order: 2 },
        { id: FX(3), name: 'Top out', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 52950, count: 1, progress_pct: null, sequence_order: 3 },
        { id: FX(4), name: 'Trim', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 40000, count: 1, progress_pct: null, sequence_order: 4 },
      ],
      budget_kind: 'bid', budget_hours: 560, planned_finish: planned, labor, values, spent_pct: 41,
    }],
  }
}
const crewDays = (days, crew) => days.flatMap((d) => crew.map(([who, hours]) => ({ ymd: d, who, hours })))
const workdays = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23']
const WORLDS = {
  track: {
    board: board({ pct: 48, planned: '2026-12-11', labor: crewDays(workdays, [['Paco Sample', 8], ['Hal Sample', 8], ['Sam Plumber', 8]]), values: [{ ymd: '2026-11-13', pct: 20, kind: 'report' }, { ymd: '2026-11-20', pct: 40, kind: 'report' }, { ymd: '2026-11-23', pct: 48, kind: 'manual' }] }),
    calls: [{ id: id('8c02', 1), job_id: JOB(3), user_id: P.superintendent.id, finish_on: '2026-12-14', plan_was: '2026-12-11', why: 'Waiting on the inspector for the underground.', created_at: '2026-11-19T21:10:00.000Z' }],
  },
  behind: {
    board: board({ pct: 48, planned: '2026-12-11', labor: crewDays(workdays, [['Paco Sample', 8], ['Hal Sample', 8], ['Sam Plumber', 8], ['Sid Sample', 8]]), values: [{ ymd: '2026-11-13', pct: 20, kind: 'report' }, { ymd: '2026-11-20', pct: 40, kind: 'report' }, { ymd: '2026-11-24', pct: 48, kind: 'manual' }] }),
    calls: [],
  },
}
const which = process.argv[2] || 'track'
const theme = process.argv[3] || 'light'
const W = WORLDS[which]
const extra = {
  tables: { users: users({ superintendent: { dashboard_view: 'short' } }), job_finish_calls: W.calls },
  rpc: {
    ...QUIET,
    list_project_board: W.board,
    job_note_taggable: [
      { user_id: P.master_technician.id, name: 'Max Sample', role: 'master_technician', on_job: true },
      { user_id: P.assistant.id, name: 'Rosa Sample', role: 'assistant', on_job: false },
      { user_id: P.primary.id, name: 'Paco Sample', role: 'primary', on_job: true },
    ],
  },
}
;(async () => {
  const p = await open({ as: 'superintendent', theme, width: 390, height: 844, phone: true, scale: 2, extra })
  await p.clock.setFixedTime(new Date('2026-11-24T10:20:00-06:00'))
  await p.go('/dashboard')
  await p.evaluate((k) => { localStorage.setItem(k, '1'); window.dispatchEvent(new Event('dashboard_job_mode_changed')) }, 'dashboard_job_mode_' + P.superintendent.id)
  await p.waitForLoadState('networkidle').catch(() => {})
  await p.waitForTimeout(2500)
  console.log((await p.asks(/missing|refused|unread/)).join('\n'))
  console.log(JSON.stringify(await p.errs()).slice(0, 800))
  const row = p.getByTestId('superintendent-line-short')
  await row.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await p.waitForTimeout(400)
  console.log('ROW', await row.innerText())
  if (which === 'track' && theme === 'light') await p.shot('396-folded-row-phone-light.png')
  await row.click()
  await p.waitForTimeout(800)
  const card = p.getByTestId('superintendent-line')
  console.log('CARD', await card.innerText())
  await p.getByText('What is this?').click()
  await p.waitForTimeout(400)
  // A tall window at the phone's width, so the whole card stands clear of the pinned bar; then cropped to the card.
  await p.setViewportSize({ width: 390, height: 1700 })
  await p.waitForTimeout(500)
  await card.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await p.evaluate(() => window.scrollBy(0, -12))
  await p.waitForTimeout(400)
  const b = await card.boundingBox()
  console.log('BOX', JSON.stringify(b))
  await p.shot(`396-open-card-${which}-phone-${theme}.png`, { clip: { x: 0, y: Math.max(0, b.y - 10), width: 390, height: b.height + 20 } })
  if (which === 'track' && theme === 'light') {
    await p.setViewportSize({ width: 390, height: 844 })
    await p.waitForTimeout(300)
    await p.getByTestId('pace-finish-date').click()
    await p.waitForTimeout(900)
    console.log('SHEET1', (await p.evaluate(() => document.body.innerText)).slice(-900))
    await p.shot('396-my-finish-date-phone-light.png')
    await p.getByRole('button', { name: /close|×/i }).first().click().catch(async () => { await p.getByText('×').first().click() })
    await p.waitForTimeout(600)
    await p.getByTestId('pace-ask-master').click()
    await p.waitForTimeout(1200)
    console.log('SHEET2', (await p.evaluate(() => document.body.innerText)).split('All projects')[1].slice(0, 900))
    await p.shot('396-ask-a-master-phone-light.png')
  }
  await p.close2(); await done()
})().catch((e) => { console.error(e); process.exit(1) })
