/**
 * Which routes outside the Layout draw a lazy page (`lazy()` or `lazyWindow()`) with no `<Suspense>` around it.
 * `<PublicPage>` holds a `<Suspense>` of its own, so a page inside one is covered (v2.8327).
 *
 * Pure: it reads the source text of `src/App.tsx` and nothing else. The Layout wraps its `<Outlet>` in a boundary, so
 * every route inside it is covered. A route above or below the Layout route (`path="/"`) has none unless its own `element`
 * carries one, and a lazy page opened there by a click, a `navigate(...)` in a press or Back/Forward suspends inside
 * synchronous input, which React answers with a blank page (v2.6868, v2.6876). `main.tsx` keeps
 * `v7_startTransition: false` on purpose, so the answer is a boundary, never a transition.
 */

export type RouteOutsideLayout = {
  /** The route's `path`, or `(no path)` for one that has none. */
  path: string
  /** The text inside `element={…}`, comments removed. Empty when the route has no element. */
  element: string
}

const NO_PATH = '(no path)'

/** JSX comments, block comments and whole-line `//` comments: words in them are not code. */
function stripComments(source: string): string {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/** The names declared `const X = lazy(…)` (or `React.lazy(…)`), and `const X = lazyWindow(…)`, which is lazy too. */
export function lazyComponentNames(appSource: string): string[] {
  const names: string[] = []
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?lazy(?:Window)?\s*\(/g
  for (const m of stripComments(appSource).matchAll(re)) if (m[1]) names.push(m[1])
  return names
}

/** The text inside the braces of the first `element={…}` in a route, and the route's text with it removed. */
function splitElement(route: string): { element: string; rest: string } {
  const at = route.search(/\belement=\{/)
  if (at === -1) return { element: '', rest: route }
  const open = route.indexOf('{', at)
  let depth = 0
  for (let i = open; i < route.length; i++) {
    if (route[i] === '{') depth++
    else if (route[i] === '}' && --depth === 0) {
      return { element: route.slice(open + 1, i), rest: route.slice(0, at) + route.slice(i + 1) }
    }
  }
  return { element: route.slice(open + 1), rest: route.slice(0, at) }
}

/**
 * The `<Route>`s of `<Routes>` that are not the Layout route (`path="/"`) and not nested in it, in order: those above
 * it, and those after its closing tag, where the catch-all sits. A route down there is ranked by react-router like any
 * other, so a public page added below the Layout works and must be read too. With no Layout route, every route counts.
 */
export function routesOutsideLayout(appSource: string): RouteOutsideLayout[] {
  const source = stripComments(appSource)
  const start = source.search(/<Routes[\s>]/)
  if (start === -1) return []
  const end = source.indexOf('</Routes>', start)
  const block = source.slice(start, end === -1 ? undefined : end)

  const starts = [...block.matchAll(/<Route(?=[\s>/])/g)].map((m) => m.index)
  const routes: RouteOutsideLayout[] = []
  // Where the Layout's nested routes end: its closing tag is the last `</Route>`, since the Layout is the one route
  // with children. Routes that start before it are the Layout's own.
  let skipUntil = -1
  for (let i = 0; i < starts.length; i++) {
    if (starts[i]! < skipUntil) continue
    const { element, rest } = splitElement(block.slice(starts[i], starts[i + 1]))
    const path = rest.match(/\bpath=(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/)
    const pathText = path?.[1] ?? path?.[2] ?? path?.[3] ?? NO_PATH
    if (pathText === '/' && skipUntil === -1) {
      skipUntil = Math.max(block.lastIndexOf('</Route>'), starts[i]! + 1)
      continue
    }
    routes.push({ path: pathText, element })
  }
  return routes
}

const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length

/** True when every mention of `name` in the element sits inside an open `<Suspense>`, or a `<PublicPage>`, which holds one. */
function everyMentionIsInsideSuspense(element: string, name: string): boolean {
  const mention = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')
  for (const m of element.matchAll(mention)) {
    const before = element.slice(0, m.index)
    if (count(before, /<(?:Suspense|PublicPage)(?=[\s>/])/g) <= count(before, /<\/(?:Suspense|PublicPage)\s*>/g)) return false
  }
  return true
}

/**
 * The paths of the routes outside the Layout whose `element` mentions a lazy name that no `<Suspense>` or
 * `<PublicPage>` in that same element wraps. An empty list is the good answer. The fix for a path it names is
 * `<PublicPage>` around a page that opens with no sign-in, as `/t/:token` has, and `<Suspense fallback={null}>` around
 * one behind `ProtectedRoute`.
 */
export function lazyRoutesWithoutSuspense(appSource: string): string[] {
  const lazyNames = lazyComponentNames(appSource)
  if (lazyNames.length === 0) return []
  return routesOutsideLayout(appSource)
    .filter(({ element }) => {
      // A path or a label in quotes is not a component: `to="/help"` never draws Help.
      const code = element.replace(/"[^"\n]*"|'[^'\n]*'/g, '""')
      return lazyNames.some((name) => !everyMentionIsInsideSuspense(code, name))
    })
    .map(({ path }) => path)
}

/**
 * The paths of the routes, inside the Layout or out of it, whose `element` puts a lazy page inside the plain
 * `<ErrorBoundary>`. That boundary catches a page whose code did not come and draws small red words with nothing to
 * press, where the chunk boundary above it would reload once and offer **Reload**. An empty list is the good answer.
 * The fix is `<RoutePageBoundary>`, which keeps the catch for an ordinary crash and hands a lost chunk up.
 */
export function lazyRoutesInPlainErrorBoundary(appSource: string): string[] {
  const lazyNames = lazyComponentNames(appSource)
  if (lazyNames.length === 0) return []
  const source = stripComments(appSource)
  const start = source.search(/<Routes[\s>]/)
  if (start === -1) return []
  const end = source.indexOf('</Routes>', start)
  const block = source.slice(start, end === -1 ? undefined : end)
  const starts = [...block.matchAll(/<Route(?=[\s>/])/g)].map((m) => m.index)
  const paths: string[] = []
  for (let i = 0; i < starts.length; i++) {
    const { element, rest } = splitElement(block.slice(starts[i], starts[i + 1]))
    if (!/<ErrorBoundary(?=[\s>/])/.test(element)) continue
    const code = element.replace(/"[^"\n]*"|'[^'\n]*'/g, '""')
    const drawsLazy = lazyNames.some((name) => new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(code))
    if (!drawsLazy) continue
    const path = rest.match(/\bpath=(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/)
    paths.push(path?.[1] ?? path?.[2] ?? path?.[3] ?? NO_PATH)
  }
  return paths
}

/** The failure's words for one route held in the plain boundary: what is wrong and the fix. */
export function lazyRouteInPlainErrorBoundaryWords(path: string): string {
  return (
    `The route "${path}" in src/App.tsx draws a lazy page inside the plain <ErrorBoundary>. ` +
    'When the page\'s code does not come, that boundary draws "Something went wrong" with nothing to press. ' +
    'Use <RoutePageBoundary> in its place: it still catches a crash, and it hands a lost chunk to the chunk boundary above, which offers Reload.'
  )
}

/** The failure's words for one route: what is wrong, why it matters and the fix. */
export function lazyRouteWithoutSuspenseWords(path: string): string {
  // The example is a route that is wrapped, so it is never the route at fault.
  const example = path === '/t/:token' ? '/f/:link' : '/t/:token'
  return (
    `The route "${path}" in src/App.tsx draws a lazy page with no <Suspense> around it. ` +
    'It sits outside the Layout, so a click or Back onto it before its chunk has loaded leaves a blank page. ' +
    `Wrap a page that opens with no sign-in in <PublicPage> inside the route's element, as ${example} is, ` +
    'and one behind ProtectedRoute in <Suspense fallback={null}>.'
  )
}

export type OnDemandImport = {
  /** The component's name in `App.tsx`. */
  name: string
  /** `lazyWindow` for a page that opens with no sign-in, `lazy` for every other. */
  how: 'lazy' | 'lazyWindow'
  /** What it imports, as written: `./pages/PayLink`. */
  specifier: string
}

/** Every `const X = lazy(() => import('…'))` and `const X = lazyWindow(() => import('…'))`, in order. */
export function onDemandImports(appSource: string): OnDemandImport[] {
  const out: OnDemandImport[] = []
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?(lazyWindow|lazy)\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g
  for (const m of stripComments(appSource).matchAll(re)) {
    if (m[1] && m[3]) out.push({ name: m[1], how: m[2] === 'lazyWindow' ? 'lazyWindow' : 'lazy', specifier: m[3] })
  }
  return out
}

/**
 * The routes outside the Layout that stay in the entry on purpose, each with its reason. Every other route there is
 * either behind `ProtectedRoute` or a page someone opens with no sign-in, and that one loads on demand inside
 * `<PublicPage>`. Add a path here only with a reason as good as these.
 */
export const ROUTES_KEPT_IN_THE_ENTRY: Readonly<Record<string, string>> = {
  '/sign-in': 'the first page a signed-out person sees',
  '/dev-login': 'a sign-in page',
  '/reset-password': 'a sign-in page',
  '/reset-password-confirm': 'a sign-in page',
  '/accept-invite': 'a sign-in page',
  '/task': 'the Add Task icon opens here, and its 6 kB is not worth a wait on a launch',
  '/files/:source/:id': 'a signed-in link that asks for the sign-in itself, 2 kB',
}

/** The component names an element draws: every `<Name` that starts with a capital. */
function componentsDrawn(element: string): string[] {
  return [...element.matchAll(/<([A-Z][\w$]*)(?=[\s>/])/g)].map((m) => m[1]!)
}

/**
 * The paths of the routes outside the Layout that open with no sign-in and are not loaded on demand (v2.8327). A
 * route is fine when it is on `kept`, when its element is behind `ProtectedRoute` or is only a `<Navigate>`, or when
 * the element is a `<PublicPage>` that draws only pages held through `lazyWindow`. Anything else is a public page imported plainly,
 * which puts it and all it reads in the chunk every visit downloads. An empty list is the good answer.
 */
export function publicRoutesNotOnDemand(appSource: string, kept: Readonly<Record<string, string>> = ROUTES_KEPT_IN_THE_ENTRY): string[] {
  const windows = new Set(onDemandImports(appSource).filter((i) => i.how === 'lazyWindow').map((i) => i.name))
  return routesOutsideLayout(appSource)
    .filter(({ path, element }) => {
      if (Object.prototype.hasOwnProperty.call(kept, path)) return false
      const code = element.trim()
      if (/^<ProtectedRoute(?=[\s>])/.test(code)) return false
      // A redirect draws no page of its own: the catch-all below the Layout sends an unknown address to the start.
      const drawn = componentsDrawn(code)
      if (drawn.length > 0 && drawn.every((name) => name === 'Navigate')) return false
      if (!/^<PublicPage(?=[\s>])/.test(code) || !/<\/PublicPage\s*>$/.test(code)) return true
      const pages = componentsDrawn(code).filter((name) => name !== 'PublicPage')
      return pages.length === 0 || pages.some((name) => !windows.has(name))
    })
    .map(({ path }) => path)
}

/** The failure's words for one such route: what is wrong, why it matters and the fix. */
export function publicRouteNotOnDemandWords(path: string): string {
  return (
    `The route "${path}" in src/App.tsx opens with no sign-in and is not loaded on demand. ` +
    'A page imported plainly there is built into the main chunk, which every customer link downloads. ' +
    "Hold the page with `const Page = lazyWindow(() => import('./pages/Page'))`, draw it as " +
    '`<PublicPage><Page /></PublicPage>` in the route, and add its file to ON_DEMAND_PAGES in src/lib/entryGraph.ts. ' +
    'A page for someone signed in goes inside the Layout or behind ProtectedRoute. ' +
    'One that must stay in the entry is named in ROUTES_KEPT_IN_THE_ENTRY with its reason.'
  )
}

/**
 * True when `<Routes>` in `src/App.tsx` sits inside an open `<RouteChunkBoundary>`. A `<Suspense>` only answers a page
 * that is still loading. A page whose chunk the newest deploy no longer serves throws, and with no error boundary above
 * it React unmounts the whole app and leaves an empty page (v2.6900: a box label's scan, `/b/:code`). The Layout's own
 * boundary sits around its outlet, below every route outside it and below the providers above it.
 */
export function routesSitInChunkBoundary(appSource: string): boolean {
  const source = stripComments(appSource)
  const routes = source.search(/<Routes[\s>]/)
  if (routes === -1) return false
  const before = source.slice(0, routes)
  const after = source.slice(source.indexOf('</Routes>', routes))
  const opened = count(before, /<RouteChunkBoundary(?=[\s>])/g) > count(before, /<\/RouteChunkBoundary\s*>/g)
  return opened && /<\/RouteChunkBoundary\s*>/.test(after)
}
