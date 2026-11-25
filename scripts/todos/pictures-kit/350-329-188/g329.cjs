const { open, done } = require('../lib.cjs')
const R = require('./rows329.cjs')
const st = R.stickers[0]
const facts = { id: st.id, number: st.number, code: st.code, state: 'blank', container_id: null, container_label: null, container_kind: null, container_retired_at: null, job_id: null, placed_by_name: null, placed_at: null, lost_at: null, run_id: R.RUN, run_job_id: R.JOB, box_name: 'G78' }
async function scan(theme) {
  const p = await open({ as: 'superintendent', theme, width: 390, height: 844, phone: true, scale: 2, extra: { ...R.reserved, rpc: { sticker_by_code: facts } } })
  await p.go(`/tally?tab=on-site&job=${R.JOB}&sticker=${st.code}`)
  await p.getByText('Sticker G78 is new').waitFor({ timeout: 20000 })
  await p.waitForTimeout(800)
  return p
}
;(async () => {
  let p = await scan('light')
  await p.shot('329-first-scan-new-box-phone-light.png')
  await p.getByRole('button', { name: 'It is on a box I know' }).click()
  await p.waitForTimeout(800)
  console.log((await p.locator('input').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label') || e.getAttribute('placeholder') || ''}:${e.value}`))).join('\n'))
  await p.shot('E-tmp-329-know.png')
  await p.close2()
  p = await scan('dark')
  await p.shot('329-first-scan-new-box-phone-dark.png')
  await p.close2(); await done()
})().catch((e) => { console.error(e); process.exit(1) })
