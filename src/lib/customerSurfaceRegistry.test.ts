/**
 * The guard behind Settings → What customers see (v2.3505): every public route in App.tsx and
 * every email-sending edge function must have a journey step or a named exemption. This test
 * reads the real files, so a new room or sender cannot ship without a place on the tab.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { customerJourneys } from './customerJourneys'
import { EMAIL_CATALOG } from './emailCatalog'
import {
  CUSTOMER_SURFACES,
  coverageLine,
  journeyCoverage,
  publicRoutesFromAppSource,
  resendSendersFromSources,
  surfaceRegistryProblems,
} from './customerSurfaceRegistry'

const APP_TSX = resolve(__dirname, '../App.tsx')
const FUNCTIONS_DIR = resolve(__dirname, '../../supabase/functions')

function realFunctions(): { name: string; source: string }[] {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => ({ name: d.name, path: join(FUNCTIONS_DIR, d.name, 'index.ts') }))
    .filter((f) => existsSync(f.path))
    .map((f) => ({ name: f.name, source: readFileSync(f.path, 'utf8') }))
}

describe('customerSurfaceRegistry — every outside surface has a place on What customers see', () => {
  const journeys = customerJourneys()
  const publicRoutes = publicRoutesFromAppSource(readFileSync(APP_TSX, 'utf8'))
  const senders = resendSendersFromSources(realFunctions())

  it('reads the real route table and the real functions folder', () => {
    expect(publicRoutes).toContain('/estimate/accept')
    expect(publicRoutes).toContain('/legal')
    expect(publicRoutes).not.toContain('/')
    expect(publicRoutes).not.toContain('/estimate/customer-accept-preview/:id') // ProtectedRoute
    expect(publicRoutes.some((p) => !p.startsWith('/'))).toBe(false)
    expect(senders).toContain('send-estimate-to-customer')
    expect(senders).toContain('legal-notify-dispatch')
    expect(senders.length).toBeGreaterThan(20)
  })

  it('the registry, the routes, the senders and the journeys agree', () => {
    expect(surfaceRegistryProblems({ journeys, entries: CUSTOMER_SURFACES, publicRoutes, senders })).toEqual([])
  })

  it('every outside audience is placed, not exempt', () => {
    for (const e of CUSTOMER_SURFACES) {
      if (e.audience !== 'staff') expect((e.steps ?? []).length, `${e.kind} ${e.ref}`).toBeGreaterThan(0)
    }
  })

  it('every customer-audience email in the catalog is placed on a journey, not exempt', () => {
    const placed = new Set(CUSTOMER_SURFACES.filter((e) => e.kind === 'sender' && (e.steps ?? []).length > 0).map((e) => e.ref))
    for (const row of EMAIL_CATALOG) {
      if (row.audience === 'customer') expect(placed.has(row.sender), `${row.id} (${row.sender})`).toBe(true)
    }
  })

  it('the parser reads single-line and multi-line routes and skips protected and nested ones', () => {
    const src = `
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/room" element={<Room />} />
        <Route
          path="/preview/:id"
          element={
            <ProtectedRoute>
              <Preview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>`
    expect(publicRoutesFromAppSource(src)).toEqual(['/sign-in', '/room'])
    expect(publicRoutesFromAppSource('no routes here')).toEqual([])
  })

  it('finds senders by the shared Resend helper or a direct Resend call', () => {
    expect(
      resendSendersFromSources([
        { name: 'b', source: "import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'" },
        { name: 'a', source: "fetch('https://api.resend.com/emails', …)" },
        { name: 'c', source: 'no email here' },
      ]),
    ).toEqual(['a', 'b'])
  })

  it('the count line names five audiences and says how many steps still wait on a release', () => {
    const c = journeyCoverage(journeys)
    expect(c.audiences).toBe(5)
    expect(c.steps).toBe(c.rendered + c.paper + c.soon + c.external)
    const parts = [`${c.steps} steps across 5 audiences`, `${c.rendered} rendered live`]
    if (c.paper > 0) parts.push(`${c.paper} open as the PDF`)
    if (c.soon > 0) parts.push(`${c.soon} next release`)
    if (c.external > 0) parts.push(`${c.external} sent by another system`)
    expect(coverageLine(c)).toBe(parts.join(' · '))
    expect(coverageLine({ audiences: 5, steps: 10, rendered: 4, paper: 2, soon: 3, external: 1 })).toBe('10 steps across 5 audiences · 4 rendered live · 2 open as the PDF · 3 next release · 1 sent by another system')
    expect(coverageLine({ audiences: 3, steps: 4, rendered: 4, paper: 0, soon: 0, external: 0 })).toBe('4 steps across 3 audiences · 4 rendered live')
  })

  it('catches every kind of disagreement', () => {
    const problems = surfaceRegistryProblems({
      journeys,
      entries: [
        { kind: 'route', ref: '/gone', audience: 'homeowner', steps: [{ journeyId: 'homeowner', stepId: 'nope' }] },
        { kind: 'sender', ref: 'x', audience: 'staff' },
        { kind: 'sender', ref: 'x', audience: 'staff', exempt: 'twice', steps: [{ journeyId: 'homeowner', stepId: 'estimate-email' }] },
      ],
      publicRoutes: ['/new-room'],
      senders: ['x', 'send-new-thing'],
    })
    expect(problems.some((p) => p.includes('/new-room has no entry'))).toBe(true)
    expect(problems.some((p) => p.includes('send-new-thing has no entry'))).toBe(true)
    expect(problems.some((p) => p.includes('/gone is not a public route'))).toBe(true)
    expect(problems.some((p) => p.includes('names step homeowner/nope'))).toBe(true)
    expect(problems.some((p) => p.includes('neither a journey step nor an exempt reason'))).toBe(true)
    expect(problems.some((p) => p.includes('both placed and exempt'))).toBe(true)
    expect(problems.some((p) => p.includes('listed twice'))).toBe(true)
  })
})
