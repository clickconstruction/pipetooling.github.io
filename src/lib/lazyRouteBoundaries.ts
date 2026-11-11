/**
 * Which routes outside the Layout draw a `lazy()` page with no `<Suspense>` around it.
 *
 * Pure: it reads the source text of `src/App.tsx` and nothing else. The Layout wraps its `<Outlet>` in a boundary, so
 * every route inside it is covered. A route above the Layout route (`path="/"`) has none unless its own `element`
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

/** The names declared `const X = lazy(…)` (or `React.lazy(…)`). */
export function lazyComponentNames(appSource: string): string[] {
  const names: string[] = []
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?lazy\s*\(/g
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
 * The `<Route>`s between `<Routes>` and the Layout route (`path="/"`), in order. The Layout route and everything nested
 * in it are left out. With no Layout route, every route in `<Routes>` counts as outside it.
 */
export function routesOutsideLayout(appSource: string): RouteOutsideLayout[] {
  const source = stripComments(appSource)
  const start = source.search(/<Routes[\s>]/)
  if (start === -1) return []
  const end = source.indexOf('</Routes>', start)
  const block = source.slice(start, end === -1 ? undefined : end)

  const starts = [...block.matchAll(/<Route(?=[\s>/])/g)].map((m) => m.index)
  const routes: RouteOutsideLayout[] = []
  for (let i = 0; i < starts.length; i++) {
    const { element, rest } = splitElement(block.slice(starts[i], starts[i + 1]))
    const path = rest.match(/\bpath=(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/)
    const pathText = path?.[1] ?? path?.[2] ?? path?.[3] ?? NO_PATH
    if (pathText === '/') break
    routes.push({ path: pathText, element })
  }
  return routes
}

const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length

/** True when every mention of `name` in the element sits inside an open `<Suspense>`. */
function everyMentionIsInsideSuspense(element: string, name: string): boolean {
  const mention = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')
  for (const m of element.matchAll(mention)) {
    const before = element.slice(0, m.index)
    if (count(before, /<Suspense(?=[\s>/])/g) <= count(before, /<\/Suspense\s*>/g)) return false
  }
  return true
}

/**
 * The paths of the routes outside the Layout whose `element` mentions a `lazy()` name that no `<Suspense>` in that same
 * element wraps. An empty list is the good answer. The fix for a path it names is `<Suspense fallback={null}>` around
 * the page in the route's element, as `/t/:token` has.
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

/** The failure's words for one route: what is wrong, why it matters and the fix. */
export function lazyRouteWithoutSuspenseWords(path: string): string {
  // The example is a route that is wrapped, so it is never the route at fault.
  const example = path === '/t/:token' ? '/f/:link' : '/t/:token'
  return (
    `The route "${path}" in src/App.tsx draws a lazy() page with no <Suspense> around it. ` +
    'It sits outside the Layout, so a click or Back onto it before its chunk has loaded leaves a blank page. ' +
    `Wrap the page in <Suspense fallback={null}> inside the route's element, as ${example} is.`
  )
}
