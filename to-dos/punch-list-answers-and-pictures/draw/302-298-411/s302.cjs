const { open, done } = require('../lib.cjs')
const { extra } = require('./permits.cjs')
const seal = require('./seal.cjs')
const URL = '/prospects?tab=permits&city=San%20Marcos'
const parcelA = { found: true, cached: true, looked_up_at: '2026-11-23T15:00:00.000Z', error: null, facts: { prop_id: 'R000000', situs: '1400 SAMPLE CROSSING BLVD', owner: 'SAMPLE CROSSING HOLDINGS LLC', owner_address: 'PO Box 000, Kyle, TX 78640', dba: null, land_value: 410000, improvement_value: 0, total_value: 410000, use_code: 'Vacant commercial', year_built: null, building_sf: null, acres: 2.4, detail_url: null } }
const which = process.argv.slice(2)
const want = (k) => which.length === 0 || which.includes(k)
;(async () => {
  let p
  if (want('desk')) {
    p = await open({ as: 'assistant', theme: 'light', width: 1280, height: 930, extra: extra() }); await seal(p)
    await p.go(URL)
    await p.shot('302-skim-desk-light.png', { clip: { x: 0, y: 118, width: 1280, height: 808 } })
    await p.close2()
  }
  if (want('phone')) {
    p = await open({ as: 'assistant', theme: 'light', width: 390, height: 844, phone: true, scale: 2, extra: extra() }); await seal(p)
    await p.go(URL)
    await p.shot('302-skim-phone-light.png')
    await p.getByRole('button', { name: /Pass/ }).last().click()
    await p.waitForTimeout(900)
    await p.shot('302-skim-passed-why-phone-light.png')
    await p.close2()
  }
  if (want('dark')) {
    p = await open({ as: 'assistant', theme: 'dark', width: 390, height: 844, phone: true, scale: 2, extra: extra() }); await seal(p)
    await p.go(URL)
    await p.shot('302-skim-phone-dark.png')
    await p.close2()
  }
  if (want('inv')) {
    p = await open({ as: 'assistant', theme: 'light', width: 1280, height: 1100, extra: extra() }); await seal(p)
    await p.go(URL)
    await p.getByRole('button', { name: /Investigating 4/ }).click()
    await p.waitForTimeout(1200)
    await p.shot('302-investigating-and-count-desk-light.png', { clip: { x: 24, y: 118, width: 1232, height: 870 } })
    await p.close2()
  }
  if (want('dig')) {
    p = await open({ as: 'assistant', theme: 'light', width: 1280, height: 1160, extra: extra({ functions: { 'permit-lookup': parcelA } }) }); await seal(p)
    await p.go(URL)
    await p.getByRole('button', { name: /Investigating 4/ }).click()
    await p.waitForTimeout(800)
    await p.getByText('Sample Crossing Retail, building A', { exact: false }).first().click()
    await p.waitForTimeout(2500)
    const dlg = p.locator('[role="dialog"]').last()
    const b = await dlg.boundingBox(); console.log('dialog', JSON.stringify(b))
    await p.shot('302-dig-in-desk-light.png', { locator: dlg })
    await p.close2()
  }
  if (want('builders')) {
    p = await open({ as: 'assistant', theme: 'light', width: 1280, height: 1000, extra: extra() }); await seal(p)
    await p.go(URL)
    await p.getByRole('button', { name: /^Builders/ }).click()
    await p.waitForTimeout(1500)
    await p.shot('302-builders-desk-light.png', { clip: { x: 24, y: 118, width: 1232, height: 660 } })
    await p.close2()
  }
  await done()
})().catch((e) => { console.error(e); process.exit(1) })
