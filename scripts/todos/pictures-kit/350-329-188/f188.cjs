const { open, done } = require('../lib.cjs')
const at = '2026-06-01T15:00:00.000Z'
const house = (n, name, phone) => ({ id: `00000000-0000-4194-8a01-${String(n).padStart(12, '0')}`, name, address: `${n}00 Sample Pkwy, Kyle, TX`, phone, notes: null, website_url: null, vendor_kind: 'supply_house', job_accounts: 'unknown', monthly_payment_day: null, default_lead_time_days: null, created_at: at, updated_at: at })
const extra = { tables: { supply_houses: [house(1, 'Sample Supply Co.', '(512) 555-0131'), house(2, 'Lens Pipe and Valve', '(512) 555-0132'), house(3, 'Example Fixture Supply', '(512) 555-0133')] } }
;(async () => {
  // 1. The Bridge, as the owner (the lens's Leader), light and dark.
  for (const theme of ['light', 'dark']) {
    const p = await open({ as: 'master_technician', theme, width: 1280, height: 900, extra: null })
    await p.go('/bridge', 1500)
    await p.shot(`188-bridge-owner-desk-${theme}.png`, { clip: { x: 0, y: 0, width: 1280, height: 820 } })
    await p.close2()
  }
  // 2. Settings, People & teams, as the owner: the cards that were a dev's.
  let p = await open({ as: 'master_technician', theme: 'light', width: 1280, height: 900, extra: null })
  await p.go('/settings?tab=settings-people', 1500)
  const y = await p.getByText('Find duplicates', { exact: false }).first().evaluate((e) => Math.round(e.getBoundingClientRect().top + scrollY))
  await p.shot('188-people-teams-owner-desk-light.png', { full: true, clip: { x: 262, y: y - 110, width: 1010, height: 1010 } })
  await p.close2()
  // 3. Banking, as the controller: the Stripe segment, the Ledger tab and Nicknames.
  p = await open({ as: 'controller', theme: 'light', width: 1280, height: 900, extra: null })
  await p.go('/banking?tab=ledger', 1500)
  await p.shot('188-banking-ledger-controller-desk-light.png', { clip: { x: 0, y: 0, width: 1280, height: 520 } })
  await p.close2()
  // 4. A typed confirm: the office deletes a supply house.
  p = await open({ as: 'assistant', theme: 'light', width: 1280, height: 900, extra })
  await p.go('/materials?tab=supply-houses', 2000)
  await p.getByRole('button', { name: /Directory/ }).click()
  await p.waitForTimeout(1000)
  await p.getByRole('button', { name: 'Edit', exact: true }).nth(2).click()
  await p.waitForTimeout(1200)
  await p.getByRole('button', { name: 'Delete', exact: true }).click()
  await p.waitForTimeout(800)
  await p.getByRole('dialog').last().locator('input[type="text"], input:not([type])').last().fill('Sample Supply')
  await p.waitForTimeout(400)
  await p.shot('188-typed-confirm-office-desk-light.png', { clip: { x: 0, y: 0, width: 1280, height: 620 } })
  await p.close2()
  // 5. The Dev doors card, as the dev: the map of what is still gated.
  p = await open({ as: 'dev', theme: 'light', width: 1280, height: 900, extra: null })
  await p.go('/settings?tab=settings-dev-doors', 1500)
  await p.shot('188-dev-doors-card-dev-desk-light.png', { clip: { x: 262, y: 60, width: 1010, height: 760 } })
  await p.close2()
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
