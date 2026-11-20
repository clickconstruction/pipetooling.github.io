import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GOOGLE_BACKED_FUNCTIONS, edgeFunctionName, googleBoundLabel, heldSummary, isGoogleBound } from './smokeNoGoogle'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const at = (href: string) => isGoogleBound(new URL(href))

describe('the smoke suite holds what reaches Google', () => {
  it('holds the Maps JavaScript API and everything else on Google’s map hosts', () => {
    expect(at('https://maps.googleapis.com/maps/api/js?key=AIza-made-up&v=weekly&libraries=marker')).toBe(true)
    expect(at('https://maps.googleapis.com/maps/api/staticmap?center=29.4,-98.5&zoom=12&size=600x300')).toBe(true)
    expect(at('https://maps.googleapis.com/maps/api/streetview?size=640x320&location=1%20Main%20St')).toBe(true)
    expect(at('https://maps.gstatic.com/mapfiles/transparent.png')).toBe(true)
    expect(at('https://places.googleapis.com/v1/places:autocomplete')).toBe(true)
    expect(at('https://routes.googleapis.com/directions/v2:computeRoutes')).toBe(true)
  })

  it('holds every edge function that asks Google, with a doubled slash or a query', () => {
    for (const name of GOOGLE_BACKED_FUNCTIONS) {
      expect(at(`https://abc.supabase.co/functions/v1/${name}`), name).toBe(true)
    }
    expect(at('https://abc.supabase.co//functions/v1/street-view-preview?location=1%20Main%20St&meta=1')).toBe(true)
  })

  it('leaves Google’s fonts, the map tiles the app falls back to, links and the rest of the app alone', () => {
    expect(at('https://fonts.googleapis.com/css2?family=Inter')).toBe(false)
    expect(at('https://fonts.gstatic.com/s/inter/v13/a.woff2')).toBe(false)
    expect(at('https://tile.openstreetmap.org/12/940/1680.png')).toBe(false)
    expect(at('https://www.google.com/maps/dir/?api=1&destination=1%20Main%20St')).toBe(false)
    expect(at('https://abc.supabase.co/functions/v1/gmail-sync')).toBe(false)
    expect(at('https://abc.supabase.co/rest/v1/jobs_ledger?select=id')).toBe(false)
    expect(at('https://clicktooling.com/jobs?tab=stages')).toBe(false)
  })

  it('names a function by its path and nothing else', () => {
    expect(edgeFunctionName(new URL('https://abc.supabase.co/functions/v1/geocode-one'))).toBe('geocode-one')
    expect(edgeFunctionName(new URL('https://abc.supabase.co//functions/v1/job-share?t=x'))).toBe('job-share')
    expect(edgeFunctionName(new URL('https://abc.supabase.co/rest/v1/rpc/geocode_one'))).toBeNull()
  })

  it('never puts the query in the report, where an address could sit', () => {
    expect(googleBoundLabel(new URL('https://abc.supabase.co/functions/v1/street-view-preview?location=1%20Main%20St&meta=1'))).toBe('functions/v1/street-view-preview')
    expect(googleBoundLabel(new URL('https://maps.googleapis.com/maps/api/streetview?location=1%20Main%20St'))).toBe('maps.googleapis.com')
  })

  it('sums the held requests, the most first', () => {
    expect(heldSummary(['maps.googleapis.com', 'functions/v1/geocode-address-batch', 'functions/v1/geocode-address-batch'])).toBe('functions/v1/geocode-address-batch × 2, maps.googleapis.com × 1')
    expect(heldSummary([])).toBe('')
  })
})

describe('the list of functions that ask Google', () => {
  it('is every edge function whose source names the Google key, and no other', () => {
    const dir = join(repoRoot, 'supabase', 'functions')
    const asksGoogle = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && existsSync(join(dir, e.name, 'index.ts')))
      .map((e) => e.name)
      .filter((name) => {
        const source = readFileSync(join(dir, name, 'index.ts'), 'utf8')
        return source.includes('GOOGLE_MAPS_API_KEY') || source.includes('_shared/googleGeocode')
      })
      .sort()
    expect([...GOOGLE_BACKED_FUNCTIONS].sort()).toEqual(asksGoogle)
  })
})

describe('every smoke spec runs through the fixture that holds Google', () => {
  const e2eDir = join(repoRoot, 'e2e')
  const files = readdirSync(e2eDir).filter((f) => f.endsWith('.ts') && f !== 'fixtures.ts')

  it('finds the specs and the sign-in', () => {
    expect(files).toContain('auth.setup.ts')
    expect(files.filter((f) => f.endsWith('.spec.ts')).length).toBeGreaterThan(0)
  })

  it.each(files)('%s takes test and expect from ./fixtures, not from @playwright/test', (file) => {
    const source = readFileSync(join(e2eDir, file), 'utf8')
    // A type-only import from Playwright is fine: it brings no `test` that skips the fixture.
    expect(source, file).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+'@playwright\/test'/m)
    expect(source, file).toMatch(/from\s+'\.\/fixtures'/)
  })
})
