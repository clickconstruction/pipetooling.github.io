import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  lazyComponentNames,
  lazyRouteInPlainErrorBoundaryWords,
  lazyRoutesInPlainErrorBoundary,
  lazyRoutesWithoutSuspense,
  lazyRouteWithoutSuspenseWords,
  onDemandImports,
  publicRouteNotOnDemandWords,
  publicRoutesNotOnDemand,
  ROUTES_KEPT_IN_THE_ENTRY,
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

/** The same small App.tsx with routes below the Layout's closing tag, ending in the catch-all redirect. */
const below = (routes: string): string =>
  app('<Route path="/sign-in" element={<SignIn />} />').replace('</Routes>', `${routes}\n<Route path="*" element={<Navigate to="/" replace />} />\n</Routes>`)

describe('lazyComponentNames', () => {
  it('reads the names declared with lazy(), and not a plain import', () => {
    expect(lazyComponentNames(app(''))).toEqual(['BoxCode', 'Preview', 'Jobs'])
  })

  it('reads React.lazy too, and skips a declaration inside a comment', () => {
    expect(lazyComponentNames("const A = React.lazy(() => import('./A'))\n// const B = lazy(() => import('./B'))\n")).toEqual(['A'])
  })

  it('reads a page held through lazyWindow, which is lazy too', () => {
    expect(lazyComponentNames("const PayLink = lazyWindow(() => import('./pages/PayLink'))\nconst plain = lazyish()\n")).toEqual(['PayLink'])
  })
})

describe('routesOutsideLayout', () => {
  it('leaves out the Layout route and the routes nested in it', () => {
    const routes = routesOutsideLayout(app('<Route path="/sign-in" element={<SignIn />} />\n<Route path="/b" element={<BoxCode />} />'))
    expect(routes.map((r) => r.path)).toEqual(['/sign-in', '/b'])
    expect(routes[1]?.element).toBe('<BoxCode />')
  })

  it('answers nothing for a file with no <Routes>', () => {
    expect(routesOutsideLayout('const BoxCode = lazy(() => import("./BoxCode"))')).toEqual([])
  })

  it('reads the routes after the Layout’s closing tag too, where the catch-all sits', () => {
    const routes = routesOutsideLayout(below('<Route path="/promo" element={<BoxCode />} />'))
    expect(routes.map((r) => r.path)).toEqual(['/sign-in', '/promo', '*'])
    expect(routes[1]?.element).toBe('<BoxCode />')
  })

  it('reads a route after a Layout route that has no children', () => {
    const source = '<Routes><Route path="/" element={<Layout />} /><Route path="/promo" element={<BoxCode />} /></Routes>'
    expect(routesOutsideLayout(source).map((r) => r.path)).toEqual(['/promo'])
  })
})

describe('a route below the Layout', () => {
  it('is named when it draws a lazy page with no Suspense', () => {
    expect(lazyRoutesWithoutSuspense(below('<Route path="/promo" element={<BoxCode />} />'))).toEqual(['/promo'])
    expect(lazyRoutesWithoutSuspense(below('<Route path="/promo" element={<Suspense fallback={null}><BoxCode /></Suspense>} />'))).toEqual([])
  })

  it('is named when it is a public page imported plainly, and the redirect beside it is left alone', () => {
    expect(publicRoutesNotOnDemand(below('<Route path="/promo" element={<SignIn />} />'), { '/sign-in': 'the first page' })).toEqual(['/promo'])
    expect(publicRoutesNotOnDemand(below(''), { '/sign-in': 'the first page' })).toEqual([])
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

  it('passes a lazy route wrapped in PublicPage, which holds the Suspense, with its props or without', () => {
    const wrapped = `
      <Route path="/b/:code" element={<PublicPage tone="landing" compact><BoxCode /></PublicPage>} />
      <Route
        path="/b"
        element={
          <PublicPage>
            <BoxCode />
          </PublicPage>
        }
      />`
    expect(lazyRoutesWithoutSuspense(app(wrapped))).toEqual([])
  })

  it('is not fooled by a PublicPage that closed before the lazy page', () => {
    const beside = '<Route path="/b" element={<><PublicPage><SignIn /></PublicPage><BoxCode /></>} />'
    expect(lazyRoutesWithoutSuspense(app(beside))).toEqual(['/b'])
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
    expect(words).toContain('<PublicPage>')
    expect(words).toContain('<Suspense fallback={null}>')
    expect(words).toContain('as /t/:token is')
    expect(lazyRouteWithoutSuspenseWords('/t/:token')).toContain('as /f/:link is')
  })
})

describe('onDemandImports', () => {
  it('reads each lazy and lazyWindow page with what it imports, and skips a plain import and a comment', () => {
    const source = `
      import SignIn from './pages/SignIn'
      const Jobs = lazy(() => import('./pages/Jobs'))
      const PayLink = lazyWindow(() => import("./pages/PayLink"))
      const Old = React.lazy(
        () => import('./pages/Old'),
      )
      // const Gone = lazy(() => import('./pages/Gone'))
    `
    expect(onDemandImports(source)).toEqual([
      { name: 'Jobs', how: 'lazy', specifier: './pages/Jobs' },
      { name: 'PayLink', how: 'lazyWindow', specifier: './pages/PayLink' },
      { name: 'Old', how: 'lazy', specifier: './pages/Old' },
    ])
  })
})

describe('publicRoutesNotOnDemand', () => {
  /** A small App.tsx with one page held through lazyWindow, one through lazy and one imported plainly. */
  const publicApp = (routes: string): string => `
import SignIn from './pages/SignIn'
import Rating from './pages/Rating'
const PayLink = lazyWindow(() => import('./pages/PayLink'))
const Preview = lazy(() => import('./pages/Preview'))
<Routes>
  ${routes}
  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
    <Route path="rating" element={<Rating />} />
  </Route>
</Routes>
`
  const kept = { '/sign-in': 'the first page' }

  it('passes a page held through lazyWindow inside PublicPage, with props or on lines of its own', () => {
    const routes = `
      <Route path="/pay/:id" element={<PublicPage tone="plain" compact><PayLink /></PublicPage>} />
      <Route
        path="/p"
        element={
          <PublicPage>
            <PayLink />
          </PublicPage>
        }
      />`
    expect(publicRoutesNotOnDemand(publicApp(routes), kept)).toEqual([])
  })

  it('names a public page imported plainly, bare or inside PublicPage', () => {
    const routes = `
      <Route path="/rate" element={<Rating />} />
      <Route path="/rate2" element={<PublicPage><Rating /></PublicPage>} />`
    expect(publicRoutesNotOnDemand(publicApp(routes), kept)).toEqual(['/rate', '/rate2'])
  })

  it('names a public page held with plain lazy: in a bare Suspense it has no loading look, and in PublicPage no place on ON_DEMAND_PAGES', () => {
    const routes = '<Route path="/look" element={<Suspense fallback={null}><Preview /></Suspense>} />'
    expect(publicRoutesNotOnDemand(publicApp(routes), kept)).toEqual(['/look'])
    expect(publicRoutesNotOnDemand(publicApp('<Route path="/look" element={<PublicPage><Preview /></PublicPage>} />'), kept)).toEqual(['/look'])
  })

  it('names a route where a plain page sits beside the PublicPage, and a PublicPage that draws nothing', () => {
    const routes = `
      <Route path="/two" element={<><PublicPage><PayLink /></PublicPage><Rating /></>} />
      <Route path="/none" element={<PublicPage></PublicPage>} />`
    expect(publicRoutesNotOnDemand(publicApp(routes), kept)).toEqual(['/two', '/none'])
  })

  it('leaves a route behind ProtectedRoute and a route on the kept list alone', () => {
    const routes = `
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/staff" element={<ProtectedRoute><Rating /></ProtectedRoute>} />`
    expect(publicRoutesNotOnDemand(publicApp(routes), kept)).toEqual([])
    expect(publicRoutesNotOnDemand(publicApp(routes), {})).toEqual(['/sign-in'])
  })

  it('does not look inside the Layout', () => {
    expect(publicRoutesNotOnDemand(publicApp(''), kept)).toEqual([])
  })

  it('says what is wrong and the fix', () => {
    const words = publicRouteNotOnDemandWords('/rate')
    expect(words).toContain('"/rate"')
    expect(words).toContain('lazyWindow')
    expect(words).toContain('<PublicPage>')
    expect(words).toContain('ON_DEMAND_PAGES')
    expect(words).toContain('ROUTES_KEPT_IN_THE_ENTRY')
  })
})

describe('lazyRoutesInPlainErrorBoundary', () => {
  const layoutApp = (routes: string): string => `
import { lazy } from 'react'
import SignIn from './pages/SignIn'
import { ErrorBoundary } from './components/ErrorBoundary'
const Messages = lazy(() => import('./pages/Messages'))
const Logbook = lazy(() => import('./pages/Logbook'))
export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/" element={<Layout />}>
${routes}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
`
  it('names a route inside the Layout that puts a lazy page in the plain boundary', () => {
    expect(lazyRoutesInPlainErrorBoundary(layoutApp('<Route path="messages" element={<ErrorBoundary><Messages /></ErrorBoundary>} />'))).toEqual(['messages'])
  })
  it('reads a prop on the page and a second route', () => {
    const routes = '<Route path="my-logbook" element={<ErrorBoundary><Logbook own /></ErrorBoundary>} />\n<Route path="messages" element={<ErrorBoundary fallback={null}><Messages /></ErrorBoundary>} />'
    expect(lazyRoutesInPlainErrorBoundary(layoutApp(routes))).toEqual(['my-logbook', 'messages'])
  })
  it('passes RoutePageBoundary, a bare lazy page and a plain page in the plain boundary', () => {
    const routes = [
      '<Route path="messages" element={<RoutePageBoundary><Messages /></RoutePageBoundary>} />',
      '<Route path="logbook" element={<Logbook />} />',
      '<Route path="hello" element={<ErrorBoundary><SignIn /></ErrorBoundary>} />',
    ].join('\n')
    expect(lazyRoutesInPlainErrorBoundary(layoutApp(routes))).toEqual([])
  })
  it('does not read a comment as a route', () => {
    expect(lazyRoutesInPlainErrorBoundary(layoutApp('{/* <Route path="messages" element={<ErrorBoundary><Messages /></ErrorBoundary>} /> */}'))).toEqual([])
  })
  it('says what is wrong and the fix', () => {
    const words = lazyRouteInPlainErrorBoundaryWords('messages')
    expect(words).toContain('"messages"')
    expect(words).toContain('<RoutePageBoundary>')
    expect(words).toContain('Reload')
  })
})

describe('src/App.tsx', () => {
  const source = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')

  it('loads every page that opens with no sign-in on demand, inside PublicPage', () => {
    // A parser that read no route would pass with nothing checked.
    expect(routesOutsideLayout(source).filter((r) => /^<PublicPage[\s>]/.test(r.element.trim())).length).toBeGreaterThan(20)
    const atFault = publicRoutesNotOnDemand(source)
    expect(atFault, atFault.map(publicRouteNotOnDemandWords).join('\n')).toEqual([])
  })

  it('keeps no path on the kept list that is not a route outside the Layout', () => {
    const paths = routesOutsideLayout(source).map((r) => r.path)
    const stale = Object.keys(ROUTES_KEPT_IN_THE_ENTRY).filter((path) => !paths.includes(path))
    expect(stale, `ROUTES_KEPT_IN_THE_ENTRY names ${stale.join(', ')}, which src/App.tsx no longer draws outside the Layout. Take it off the list.`).toEqual([])
  })

  it('is read as it is written: lazy pages, routes above the Layout, the Layout left out', () => {
    // A parser that found nothing would pass the check below without checking anything.
    expect(lazyComponentNames(source)).toEqual(expect.arrayContaining(['GcTradePortal', 'PayLink', 'EstimateAcceptStaffPreview', 'Jobs']))
    const paths = routesOutsideLayout(source).map((r) => r.path)
    expect(paths).toEqual(expect.arrayContaining(['/sign-in', '/t/:token', '/pay/:id', '*']))
    expect(paths).not.toContain('/')
    expect(paths).not.toContain('dashboard')
  })

  it('holds no lazy page in the plain ErrorBoundary, which has no press for a page that did not load', () => {
    const atFault = lazyRoutesInPlainErrorBoundary(source)
    expect(atFault, atFault.map(lazyRouteInPlainErrorBoundaryWords).join('\n')).toEqual([])
    // The fifteen routes that keep a boundary of their own are still there, under the name that hands a lost chunk up.
    expect((source.match(/<RoutePageBoundary>/g) ?? []).length).toBeGreaterThanOrEqual(15)
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
