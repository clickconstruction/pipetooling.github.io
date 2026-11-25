const { open, done } = require('../lib.cjs')
const R = require('./rows329.cjs')
const st = R.stickers[0]
const facts = { id: st.id, number: st.number, code: st.code, state: 'blank', container_id: null, container_label: null, container_kind: null, container_retired_at: null, job_id: null, placed_by_name: null, placed_at: null, lost_at: null, run_id: R.RUN, run_job_id: R.JOB, box_name: 'G78' }
;(async () => {
  const p = await open({ as: 'superintendent', theme: 'light', width: 390, height: 844, phone: true, scale: 2, extra: { ...R.reserved, rpc: { sticker_by_code: facts } } })
  await p.go(`/tally?tab=on-site&job=${R.JOB}&sticker=${st.code}`)
  await p.getByText('Sticker G78 is new').waitFor({ timeout: 20000 })
  await p.getByRole('button', { name: 'It is on a box I know' }).click()
  await p.getByPlaceholder('Stencil, place or part').fill('76')
  await p.waitForTimeout(600)
  console.log(await p.getByTestId('sticker-match-list').innerText())
  await p.getByTestId('sticker-match-list').getByRole('button').first().click()
  await p.waitForTimeout(600)
  await p.shot('329-first-scan-known-box-phone-light.png')
  console.log(JSON.stringify(await p.errs()).slice(0, 500))
  await p.close2(); await done()
})().catch((e) => { console.error(e); process.exit(1) })
