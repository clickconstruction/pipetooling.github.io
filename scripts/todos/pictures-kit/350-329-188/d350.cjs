const { open, done } = require('../lib.cjs')
const R = require('./rows350.cjs')
const names = [['dev', 'Devon Sample'], ['master_technician', 'Max Sample'], ['assistant', 'Rosa Sample'], ['controller', 'Cora Sample'], ['estimator', 'Eli Sample'], ['primary', 'Paco Sample'], ['superintendent', 'Sid Sample'], ['subcontractor', 'Sam Plumber'], ['helpers', 'Hal Sample']]
const people = names.map(([role, name], i) => {
  const n = String(i + 1).padStart(2, '0')
  return { id: `00000000-0000-4194-8008-${String(i + 1).padStart(12, '0')}`, name, kind: role === 'subcontractor' ? 'sub' : 'employee', account_user_id: `00000000-0000-4194-8000-0000000000${n}`, master_user_id: '00000000-0000-4194-8000-000000000002',
    email: role === 'subcontractor' ? null : `${name.split(' ')[0].toLowerCase()}@lens.example.com`, phone: `(512) 555-01${n}`, license_asked: false, start_date: '2025-03-03', created_at: '2025-03-03T15:00:00.000Z', archived_at: null, end_date: null, notes: null }
})
const extra = { tables: { ...R.extra.tables, people }, add: { app_settings: [R.issuer] } }
;(async () => {
  const p = await open({ as: 'assistant', theme: 'light', width: 1280, height: 1000, extra })
  await p.go('/people?tab=subs')
  await p.getByRole('button', { name: /\$6,300/ }).click()
  await p.getByRole('button', { name: /Statement of account/ }).first().click()
  await p.getByTestId('sub-paper-preview').waitFor({ timeout: 20000 })
  await p.waitForTimeout(1000)
  await p.getByRole('button', { name: /Send to Sam Plumber/ }).click()
  await p.waitForTimeout(1200)
  console.log('SEND\n' + (await p.getByRole('dialog').last().innerText()))
  await p.shot('350-send-no-email-desk-light.png', { locator: p.getByRole('dialog').last() })
  console.log(JSON.stringify(await p.errs()).slice(0, 800))
  await p.close2(); await done()
})().catch((e) => { console.error(e); process.exit(1) })
