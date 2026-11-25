const { open, done } = require('../lib.cjs')
const { P, JOB, id, day, QUIET } = require('./world.cjs')
const HOME = id('8001', 1), OWNER = id('8001', 3), PLUMB = id('8003', 1), MASTER = P.master_technician.id
const job = (n, number, name, customer, customerName, address, status, revenue, paid, pct) => ({
  id: JOB(n), hcp_number: number, click_number: number, job_name: name, job_address: address, customer_id: customer, customer_name: customerName, status, revenue, payments_made: paid,
  service_type_id: PLUMB, master_user_id: MASTER, bill_to_party: 'customer', billing_only: false, bill_copy_other_party: false, show_bills_to_other_party: false, gc_auto_offer_next: false,
  gc_shares_stage_dates: false, lien_last_work_note: '', lien_payment_bond: 'unknown', created_at: '2026-09-01T15:00:00.000Z', pct_complete: pct,
})
const jobs = [
  job(1, '1312', 'Water heater replacement', HOME, 'Sam Sample', '100 Sample St, Kyle, TX 78640', 'paid', 4380, 4380, 100),
  job(2, '1318', 'Sample Retail Shell rough-in', OWNER, 'Sample Owner LLC', '400 Sample Pkwy, Kyle, TX 78640', 'working', 86400, 21600, 45),
  job(5, '1327', 'Leak under slab', HOME, 'Sam Sample', '100 Sample St, Kyle, TX 78640', 'ready_to_bill', 1250, 0, null),
]
const FX = (n) => id('8c07', n)
const extraFor = (role) => ({
  tables: {
    jobs_ledger: role === 'helpers' ? jobs.slice(0, 2) : jobs,
    quick_replies: [{ id: id('8c08', 1), text: 'Hi {first}, this is {me}, your plumber. I am on my way and should be there in about {minutes} minutes.', for_kind: 'customer', step_key: null, scope: 'team', added_by: P.assistant.id, added_at: '2026-10-01T15:00:00.000Z', removed_at: null, phone_order: 1, phone_name: 'On my way', text_es: null, phone_press: 'on_my_way', shortcut: null }],
    contacts: [{ id: id('8009', 1), kind: 'customer', state: 'done', customer_id: HOME, name: 'Sam Sample', created_at: '2026-03-02T15:00:00.000Z' }],
    report_templates: [{ id: id('8c0a', 1), name: 'Status Report', sequence_order: 1, app_managed: true, created_at: '2026-01-05T15:00:00.000Z', updated_at: '2026-01-05T15:00:00.000Z' }],
    report_template_fields: [
      { id: id('8c0b', 1), template_id: id('8c0a', 1), label: 'How complete is this job?', input_type: 'percent_0_100', sequence_order: 1, created_at: '2026-01-05T15:00:00.000Z' },
      { id: id('8c0b', 2), template_id: id('8c0a', 1), label: 'What is the status of the job?', input_type: 'long_text', sequence_order: 2, created_at: '2026-01-05T15:00:00.000Z' },
      { id: id('8c0b', 3), template_id: id('8c0a', 1), label: 'What needs to be done to get to the next stage?', input_type: 'long_text', sequence_order: 3, created_at: '2026-01-05T15:00:00.000Z' },
    ],
    contact_channels: [{ id: id('8c09', 1), contact_id: id('8009', 1), kind: 'phone', value: '(512) 555-0142', opted_out_at: null, usual_at: null, created_at: '2026-03-02T15:00:00.000Z' }],
  },
  add: { app_settings: [{ key: 'messages_texts_on_v1', value_text: 'true' }] },
  rpc: {
    ...QUIET,
    list_job_stage_progress: [
      { fixture_id: FX(1), name: 'Underground', stage_kind: 'order', sequence_order: 1, weight_pct: 30, progress_pct: 100, draw_paid: true },
      { fixture_id: FX(2), name: 'Rough-in', stage_kind: 'order', sequence_order: 2, weight_pct: 45, progress_pct: 35, draw_paid: false },
      { fixture_id: FX(3), name: 'Top out', stage_kind: 'order', sequence_order: 3, weight_pct: 25, progress_pct: null, draw_paid: false },
    ],
  },
})
async function start({ role, theme = 'light', time = '2026-11-24T11:25:00-06:00', geo = false }) {
  const p = await open({ as: role, theme, width: 390, height: 844, phone: true, scale: 2, extra: extraFor(role) })
  if (geo) { await p.context().grantPermissions(['geolocation']); await p.context().setGeolocation({ latitude: 30.0165, longitude: -97.8603 }) }
  await p.clock.setFixedTime(new Date(time))
  await p.go('/dashboard')
  if (role === 'primary') {
    await p.evaluate((k) => { localStorage.setItem(k, '1'); window.dispatchEvent(new Event('dashboard_job_mode_changed')) }, 'dashboard_job_mode_' + P[role].id)
    await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(2500)
  }
  const bad = (await p.asks()).filter((l) => /missing|refused|unread/.test(l))
  if (bad.length) console.log('BAD\n' + bad.join('\n'))
  return p
}
const tail = async (p, n = 1200) => console.log((await p.evaluate(() => document.body.innerText)).slice(-n))
module.exports = { start, tail }
if (require.main === module) (async () => {
  const mode = process.argv[2]
  if (mode === 'report') {
    const p = await start({ role: 'primary' })
    const before = new Set(await p.asks())
    p.on('filechooser', (fc) => console.log('FILECHOOSER', fc.isMultiple()))
    await p.getByRole('button', { name: 'Leave report' }).last().click()
    await p.waitForTimeout(3000)
    console.log('NEW ASKS\n' + (await p.asks()).filter((l) => !before.has(l)).join('\n'))
    await tail(p, 1500)
    await p.shot('C-probe-ph-report.png')
    await p.close2()
  }
  if (mode === 'omw') {
    const p = await start({ role: 'primary', geo: true })
    await p.getByRole('button', { name: 'On my way' }).last().click()
    await p.waitForTimeout(3000)
    await tail(p, 900)
    console.log(JSON.stringify(await p.errs()).slice(0, 500))
    await p.shot('C-probe-ph-omw.png')
    await p.close2()
  }
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
