// Invented rows for picture agent A. Dates are relative to today.
const HAL = '00000000-0000-4194-8000-000000000009'
const DEV = '00000000-0000-4194-8000-000000000001'
const iso = (d) => d.toISOString()
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const ymd = (d) => d.toISOString().slice(0, 10)
const FIELD = ['helpers', 'subcontractor', 'primary', 'master_technician', 'superintendent']
const courses = [
  { slug: 'osha-30-refresher', title: 'OSHA 30 refresher', enabled: true, required_roles: FIELD, good_for_months: 12, due_soon_days: 30, retake_from: null, offered: false, created_at: '2026-10-15T06:00:00.000Z', updated_at: '2026-10-18T16:04:00.000Z', updated_by: DEV },
  { slug: 'intro-to-plumbing', title: 'Intro to plumbing', enabled: true, required_roles: ['helpers', 'dev'], good_for_months: 120, due_soon_days: 30, retake_from: null, offered: true, created_at: '2026-10-18T01:00:00.000Z', updated_at: '2026-10-18T16:04:00.000Z', updated_by: DEV },
  { slug: 'intro-electrical', title: 'Intro to electrical', enabled: true, required_roles: ['dev'], good_for_months: 120, due_soon_days: 30, retake_from: null, offered: true, created_at: '2026-10-18T02:00:00.000Z', updated_at: '2026-10-18T16:04:00.000Z', updated_by: DEV },
  { slug: 'intro-hvac', title: 'Intro to HVAC', enabled: false, required_roles: [], good_for_months: 120, due_soon_days: 30, retake_from: null, offered: true, created_at: '2026-11-21T07:45:00.000Z', updated_at: '2026-11-21T07:45:00.000Z', updated_by: null },
]
module.exports = { HAL, DEV, iso, daysAgo, ymd, FIELD, courses }
const fs = require('fs'), path = require('path')
const REPO = process.cwd()
const lessonKeys = (slug) => fs.readdirSync(path.join(REPO, 'src/content/training', slug)).filter((f) => /^\d{2}-/.test(f)).sort().map((f) => f.replace(/\.md$/, ''))
const lessonPasses = (user, slug, n, startDaysAgo = 20) => lessonKeys(slug).slice(0, n).map((k, i) => ({ user_id: user, course_slug: slug, lesson_key: k, passed_at: iso(daysAgo(Math.max(1, startDaysAgo - i))), tries: i % 4 === 2 ? 2 : 1 }))
const pass = (user, slug, days, score = 17) => ({ id: `00000000-0000-4194-80c1-${String(Math.abs(days) + (slug.length * 1000)).padStart(12, '0')}`, user_id: user, course_slug: slug, content_version: 'v2.5624', passed_at: iso(daysAgo(days)), passed_on: ymd(daysAgo(days)), score, total: 20, answers: {} })
Object.assign(module.exports, { lessonKeys, lessonPasses, pass, REPO })
// An RPC whose invented answer depends on its argument: the scratch config's rpc answers are static, so this
// sits in front of the frame's sealed fetch and answers that one RPC itself. Everything else goes to the seal.
// Nothing leaves the page: the answer is built here.
async function rpcByArg(page, rpcName, argName, byValue) {
  await page.context().addInitScript(({ rpcName, argName, byValue }) => {
    let inner = window.fetch
    const wrapped = async (input, init) => {
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (href.includes('/rest/v1/rpc/' + rpcName)) {
        let body = init && init.body
        if (body == null && typeof input === 'object' && !(input instanceof URL)) body = await input.clone().text()
        let arg = null
        try { arg = JSON.parse(String(body || '{}'))[argName] } catch {}
        window.__picRpcCalls = (window.__picRpcCalls || []).concat([String(arg)])
        return new Response(JSON.stringify(byValue[arg] ?? []), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return inner.call(window, input, init)
    }
    Object.defineProperty(window, 'fetch', { configurable: true, get: () => wrapped, set: (f) => { inner = f } })
  }, { rpcName, argName, byValue })
}
const PEOPLE = {
  devon: { id: DEV, name: 'Devon Sample', role: 'dev' },
  max: { id: '00000000-0000-4194-8000-000000000002', name: 'Max Sample', role: 'master_technician' },
  rosa: { id: '00000000-0000-4194-8000-000000000003', name: 'Rosa Sample', role: 'assistant' },
  cora: { id: '00000000-0000-4194-8000-000000000004', name: 'Cora Sample', role: 'controller' },
  eli: { id: '00000000-0000-4194-8000-000000000005', name: 'Eli Sample', role: 'estimator' },
  paco: { id: '00000000-0000-4194-8000-000000000006', name: 'Paco Sample', role: 'primary' },
  sid: { id: '00000000-0000-4194-8000-000000000007', name: 'Sid Sample', role: 'superintendent' },
  sam: { id: '00000000-0000-4194-8000-000000000008', name: 'Sam Plumber', role: 'subcontractor' },
  hal: { id: HAL, name: 'Hal Sample', role: 'helpers' },
  // Invented for these pictures only.
  gus: { id: '00000000-0000-4194-8000-000000000021', name: 'Gus Sample', role: 'helpers' },
  nell: { id: '00000000-0000-4194-8000-000000000022', name: 'Nell Sample', role: 'helpers' },
  ty: { id: '00000000-0000-4194-8000-000000000023', name: 'Ty Sample', role: 'helpers' },
}
const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x }
const standing = (who, months, passedDaysAgo) => {
  if (passedDaysAgo == null) return { user_id: who.id, name: who.name, role: who.role, colour: 'red', passed_on: null, due_on: null, days_to_due: null }
  const passed = daysAgo(passedDaysAgo), due = addMonths(passed, months)
  const days = Math.round((due - new Date()) / 86400000)
  return { user_id: who.id, name: who.name, role: who.role, colour: days <= 30 ? 'amber' : 'green', passed_on: ymd(passed), due_on: ymd(due), days_to_due: days }
}
Object.assign(module.exports, { rpcByArg, PEOPLE, standing })
