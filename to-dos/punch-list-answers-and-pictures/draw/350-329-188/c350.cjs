const { open, done } = require('../lib.cjs')
const R = require('./rows350.cjs')
const extra = { ...R.extra, add: { app_settings: [R.issuer] } }
async function win(theme, height) {
  const p = await open({ as: 'assistant', theme, width: 1280, height, extra })
  await p.go('/people?tab=subs')
  await p.getByRole('button', { name: /\$6,300/ }).click()
  await p.getByRole('button', { name: /Statement of account/ }).first().click()
  await p.getByTestId('sub-paper-preview').waitFor({ timeout: 20000 })
  await p.waitForTimeout(1200)
  return p
}
;(async () => {
  // The papers, whole: a tall window so the preview does not scroll.
  let p = await win('light', 2600)
  const prev = p.getByTestId('sub-paper-preview')
  await p.shot('350-paper-statement-of-account-desk-light.png', { locator: prev })
  await p.getByLabel('A work statement').selectOption({ label: await p.locator('select[aria-label="A work statement"] option', { hasText: 'WS-1321-2' }).innerText() })
  await p.waitForTimeout(800)
  console.log('WORK\n' + (await prev.innerText()))
  await p.shot('350-paper-work-statement-desk-light.png', { locator: prev })
  await p.getByLabel('A payment record').selectOption({ label: await p.locator('select[aria-label="A payment record"] option', { hasText: 'PR-0017' }).innerText() })
  await p.waitForTimeout(800)
  console.log('PAYMENT\n' + (await prev.innerText()))
  await p.shot('350-paper-payment-record-desk-light.png', { locator: prev })
  console.log(JSON.stringify(await p.errs()).slice(0, 800))
  await p.close2()
  // The window as the office sees it.
  for (const theme of ['light', 'dark']) {
    p = await win(theme, 1000)
    await p.shot(`350-window-desk-${theme}.png`, { locator: p.getByRole('dialog').last() })
    if (theme === 'light') {
      await p.getByRole('button', { name: /Send to Sam Plumber/ }).click()
      await p.waitForTimeout(1200)
      console.log('SEND\n' + (await p.getByRole('dialog').last().innerText()))
      await p.shot('350-send-step-desk-light.png', { locator: p.getByRole('dialog').last() })
    }
    await p.close2()
  }
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
