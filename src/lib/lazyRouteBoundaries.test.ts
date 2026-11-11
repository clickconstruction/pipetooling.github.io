import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  lazyComponentNames,
  lazyRoutesWithoutSuspense,
  lazyRouteWithoutSuspenseWords,
  routesOutsideLayout,
  routesSitInChunkBoundary,
} from './lazyRouteBoundaries'

/** A small App.tsx: the imports, the routes under test above the Layout route, and one lazy page inside the Layout. */
const app = (routes: string): string => `
import { lazy, Suspense } from 'react'
import SignIn from './pages/SignIn'
const BoxCode = lazy(() => import('./pages/BoxCode'))
const Preview = lazy(() => import('./pages/Preview'))
const Jobs = lazy(() => import('./pages/Jobs'))

function AppContent() {
  return (
    <Routes>
      ${routes}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="jobs" element={<Jobs />} />
      </Route>
    </Routes>
  )
}
`

describe('lazyComponentNames', () => {
  it('reads the names declared with lazy(), and not a plain import', () => {
    expect(lazyComponentNames(app(''))).toEqual(['BoxCode', 'Preview', 'Jobs'])
  })

  it('reads React.lazy too, and skips a declaration inside a comment', () => {
    expect(lazyComponentNames("const A = React.lazy(() => import('./A'))\n// const B = lazy(() => import('./B'))\n")).toEqual(['A'])
  })
})

describe('routesOutsideLayout', () => {
  it('stops at the Layout route and leaves out the routes nested in it', () => {
    const routes = routesOutsideLayout(app('<Route path="/sign-in" element={<SignIn />} />\n<Route path="/b" element={<BoxCode />} />'))
    expect(routes.map((r) => r.path)).toEqual(['/sign-in', '/b'])
    expect(routes[1]?.element).toBe('<BoxCode />')
  })

  it('answers nothing for a file with no <Routes>', () => {
    expect(routesOutsideLayout('const BoxCode = lazy(() => import("./BoxCode"))')).toEqual([])
  })
})

describe('lazyRoutesWithoutSuspense', () => {
  it('names a bare lazy route by its path', () => {
    expect(lazyRoutesWithoutSuspense(app('<Route path="/b/:code" element={<BoxCode />} />'))).toEqual(['/b/:code'])
  })

  it('passes a lazy route wrapped in Suspense', () => {
    const wrapped = `
      <Route
        path="/b/:code"
        element={
          <Suspense fallback={null}>
            <BoxCode />
          </Suspense>
        }
      />`
    expect(lazyRoutesWithoutSuspense(app(wrapped))).toEqual([])
  })

  it('passes a lazy route wrapped in Suspense inside ProtectedRoute', () => {
    const wrapped = `
      <Route
        path="/preview/:id"
        element={
          <ProtectedRoute>
            <Suspense fallback={null}>
              <Preview />
            </Suspense>
          </ProtectedRoute>
        }
      />`
    expect(lazyRoutesWithoutSuspense(app(wrapped))).toEqual([])
  })

  it('names a lazy route that ProtectedRoute alone wraps', () => {
    const bare = `
      <Route
        path="/preview/:id"
        element={
          <ProtectedRoute>
            <Preview />
          </ProtectedRoute>
        }
      />`
    expect(lazyRoutesWithoutSuspense(app(bare))).toEqual(['/preview/:id'])
  })

  it('passes a plain import', () => {
    expect(lazyRoutesWithoutSuspense(app('<Route path="/sign-in" element={<SignIn />} />'))).toEqual([])
  })

  it('names only the routes at fault, in the order the file has them', () => {
    const mixed = `
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/b/:code" element={<BoxCode />} />
      <Route path="/b" element={<Suspense fallback={null}><BoxCode /></Suspense>} />
      <Route path="/preview/:id" element={<ProtectedRoute><Preview /></ProtectedRoute>} />`
    expect(lazyRoutesWithoutSuspense(app(mixed))).toEqual(['/b/:code', '/preview/:id'])
  })

  it('is not fooled by a Suspense that sits beside the lazy page instead of around it', () => {
    const beside = '<Route path="/b" element={<><Suspense fallback={null}><SignIn /></Suspense><BoxCode /></>} />'
    expect(lazyRoutesWithoutSuspense(app(beside))).toEqual(['/b'])
  })

  it('is not fooled by a comment that mentions <Suspense>, nor by a lazy name inside one', () => {
    const commented = `
      <Route path="/b" element={<BoxCode />} />
      {/* The next route is plain, so it needs no <Suspense fallback={null}>. BoxCode is the lazy one. */}
      <Route path="/sign-in" element={<SignIn />} />`
    expect(lazyRoutesWithoutSuspense(app(commented))).toEqual(['/b'])
  })

  it('does not read a lazy name inside a quoted path as the page', () => {
    expect(lazyRoutesWithoutSuspense(app('<Route path="/old" element={<Navigate to="/Jobs" replace />} />'))).toEqual([])
  })

  it('does not look inside the Layout, whose Outlet has its own boundary', () => {
    expect(lazyRoutesWithoutSuspense(app(''))).toEqual([])
  })
})

describe('lazyRouteWithoutSuspenseWords', () => {
  it('names the route and the fix, with a wrapped route as the example', () => {
    const words = lazyRouteWithoutSuspenseWords('/b/:code')
    expect(words).toContain('"/b/:code"')
    expect(words).toContain('<Suspense fallback={null}>')
    expect(words).toContain('as /t/:token is')
    expect(lazyRouteWithoutSuspenseWords('/t/:token')).toContain('as /f/:link is')
  })
})

describe('src/App.tsx', () => {
  const source = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')

  it('is read as it is written: lazy pages, routes above the Layout, the Layout left out', () => {
    // A parser that found nothing would pass the check below without checking anything.
    expect(lazyComponentNames(source)).toEqual(expect.arrayContaining(['GcTradePortal', 'Jobs']))
    const paths = routesOutsideLayout(source).map((r) => r.path)
    expect(paths).toEqual(expect.arrayContaining(['/sign-in', '/t/:token']))
    expect(paths).not.toContain('/')
    expect(paths).not.toContain('dashboard')
  })

  it('wraps every lazy route outside the Layout in a Suspense', () => {
    const atFault = lazyRoutesWithoutSuspense(source)
    expect(atFault, atFault.map(lazyRouteWithoutSuspenseWords).join('\n')).toEqual([])
  })

  it('keeps every route inside a chunk boundary, so a lost chunk never leaves an empty page', () => {
    expect(
      routesSitInChunkBoundary(source),
      'src/App.tsx draws <Routes> with no <RouteChunkBoundary> around it. A page outside the Layout whose chunk the ' +
        'newest deploy no longer serves then unmounts the whole app. Wrap <Routes> in <RouteChunkBoundary resetKey={pathname}>.',
    ).toBe(true)
  })
})

describe('routesSitInChunkBoundary', () => {
  const routes = '<Routes><Route path="/b/:code" element={<Suspense fallback={null}><BoxCode /></Suspense>} /></Routes>'

  it('passes when the boundary opens before the routes and closes after them', () => {
    expect(routesSitInChunkBoundary(`<><RouteChunkBoundary resetKey={pathname}>${routes}</RouteChunkBoundary></>`)).toBe(true)
  })

  it('fails with no boundary, with one that closed before the routes, and with one only in a comment', () => {
    expect(routesSitInChunkBoundary(`<>${routes}</>`)).toBe(false)
    expect(routesSitInChunkBoundary(`<><RouteChunkBoundary><Toast /></RouteChunkBoundary>${routes}</>`)).toBe(false)
    expect(routesSitInChunkBoundary(`<>{/* <RouteChunkBoundary> */}${routes}{/* </RouteChunkBoundary> */}</>`)).toBe(false)
  })

  it('does not take the Layout\'s own boundary, which sits inside a route, for one around the routes', () => {
    expect(routesSitInChunkBoundary('<Routes><Route path="/" element={<RouteChunkBoundary><Outlet /></RouteChunkBoundary>} /></Routes>')).toBe(false)
  })

  it('fails when there are no routes to read', () => {
    expect(routesSitInChunkBoundary('<RouteChunkBoundary><Page /></RouteChunkBoundary>')).toBe(false)
  })
})
