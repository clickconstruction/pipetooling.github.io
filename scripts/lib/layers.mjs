/**
 * The layers of `src` and which imports run upward (punch list #434, the split's step 1).
 * Plain JS with no dependencies: scripts/check-layers.mjs runs it on bare Node, and src/lib/layers.test.ts pins it.
 *
 * Why layers. The type check holds one program's every line in one heap, and the only cut left is TypeScript
 * project references: a project is checked alone and the ones above it read its declarations. A project cannot
 * read a file of a project above it, a type included. So the folders that will be the lowest project read
 * nothing from the ones above, and the hooks read nothing from the components.
 *
 * On 2026-11-27 that held for all but 167 files under the lowest folders and 39 hooks, and the count had grown by
 * two in six hours. `scripts/layers-allowed.txt` lists those imports, one a row, and the check refuses any other.
 * The list only shrinks: a row whose import is gone is taken off with `--write`, and nothing adds one but a hand.
 *
 * A test may import anything: the tests are programs of their own and read every project.
 * `src/contexts` is not ruled for the hooks yet: 50 hooks read 8 contexts, and where each context sits is undecided.
 */

/** Lowest first. `from` holds the folders a rule speaks for, `above` the folders its files may not read. */
export const LAYER_RULES = [
  {
    name: 'base',
    from: ['src/lib/', 'src/utils/', 'src/types/', 'src/constants/', 'src/content/'],
    above: ['src/hooks/', 'src/contexts/', 'src/components/', 'src/pages/', 'src/test/'],
  },
  { name: 'hooks', from: ['src/hooks/'], above: ['src/components/', 'src/pages/', 'src/test/'] },
]

/** Where the list lives, from the repo root. */
export const ALLOWED_FILE = 'scripts/layers-allowed.txt'

const CODE = /\.tsx?$/
const TEST = /\.test\.tsx?$/
const DECLARATION = /\.d\.ts$/
/** A file straight under `src` (App.tsx, main.tsx, sw.ts): the top of the app, above every layer. */
const ROOT_FILE = /^src\/[^/]+$/

/** The rule a file answers to, or undefined: a test, a declaration file and a file of an upper folder answer to none. */
export function ruleFor(file) {
  if (!CODE.test(file) || TEST.test(file) || DECLARATION.test(file)) return undefined
  return LAYER_RULES.find((rule) => rule.from.some((dir) => file.startsWith(dir)))
}

/** True when `target` sits above the files `rule` speaks for. */
export function isAbove(rule, target) {
  return ROOT_FILE.test(target) || rule.above.some((dir) => target.startsWith(dir))
}

/** `a/b/../c` and `a/./c` as `a/c`. Posix separators only: every path here is the repo's own. */
function normalize(path) {
  const out = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

/**
 * The file an import names, from the repo root, or undefined for a package, an asset and a name no file answers.
 * `has(path)` says whether a file exists. `@/x` is `src/x`, as tsconfig.json's `paths` and Vite's alias have it.
 */
export function resolveImport(from, specifier, has) {
  const spec = specifier.replace(/\?.*$/, '')
  let base
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`
  else if (spec.startsWith('.')) base = normalize(`${from.slice(0, from.lastIndexOf('/'))}/${spec}`)
  else return undefined
  const tries = [base, `${base}.ts`, `${base}.tsx`, `${base}.d.ts`, `${base}/index.ts`, `${base}/index.tsx`]
  return tries.find((path) => CODE.test(path) && has(path))
}

/** One import, as a row of the list. */
export function rowOf(from, to) {
  return `${from} -> ${to}`
}

/** The rows of one file's imports that reach up, sorted, each once. `specifiers` is every module name the file imports. */
export function upwardRows(file, specifiers, has) {
  const rule = ruleFor(file)
  if (!rule) return []
  const rows = new Set()
  for (const specifier of specifiers) {
    const target = resolveImport(file, specifier, has)
    if (target && isAbove(rule, target)) rows.add(rowOf(file, target))
  }
  return [...rows].sort()
}

/** The list's rows: a blank line and a line that starts with `#` are not one. */
export function parseAllowed(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

/**
 * `found` against the list. `added` reaches up and is not on the list: the check fails on it.
 * `mended` is on the list and reaches up no more: `--write` takes it off, and it never fails a run.
 */
export function compareRows(found, allowed) {
  const foundSet = new Set(found)
  const allowedSet = new Set(allowed)
  return {
    added: [...foundSet].filter((row) => !allowedSet.has(row)).sort(),
    mended: [...allowedSet].filter((row) => !foundSet.has(row)).sort(),
    kept: [...foundSet].filter((row) => allowedSet.has(row)).length,
  }
}

/** The list's text without the rows in `mended`. Its comments and its order stay. */
export function withoutRows(text, mended) {
  const gone = new Set(mended)
  return text
    .split('\n')
    .filter((line) => !gone.has(line.trim()))
    .join('\n')
}

function counted(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

/** The lines a run prints: the refusals by file, the rule and the mend, then the rows that are mended, then the list's state. */
export function outcomeLines({ added, mended, kept }) {
  const lines = []
  if (added.length) {
    lines.push(`check:layers: ${counted(added.length, 'new import reaches', 'new imports reach')} up a layer.`, '')
    const byFile = new Map()
    for (const row of added) {
      const [from, to] = row.split(' -> ')
      byFile.set(from, [...(byFile.get(from) ?? []), to])
    }
    for (const [from, targets] of byFile) {
      lines.push(`  ${from}`)
      for (const to of targets) lines.push(`    reads ${to}`)
    }
    lines.push(
      '',
      'The rule: a file under src/lib, src/utils, src/types, src/constants or src/content reads nothing from src/hooks,',
      'src/contexts, src/components, src/pages or src/test, a type included. A hook reads nothing from src/components,',
      'src/pages or src/test. The type check is being cut into projects by layer (punch list #434), and a project',
      'cannot read one above it. A test may import anything.',
      '',
      'The mend: give the type or the constant its home in the lower layer, and import it from there. The upper file',
      'can export it again, so nothing else changes. When a file on the list was only renamed, change its path in',
      `${ALLOWED_FILE}.`,
      '',
    )
  }
  if (mended.length) {
    lines.push(
      `check:layers: ${counted(mended.length, 'row', 'rows')} of ${ALLOWED_FILE} ${mended.length === 1 ? 'is' : 'are'} mended and still on the list.`,
      'Take them off with: npm run check:layers -- --write',
    )
  }
  if (!added.length) {
    lines.push(`check:layers: no new import reaches up a layer. ${counted(kept, 'import', 'imports')} on the list still ${kept === 1 ? 'does' : 'do'}.`)
  }
  return lines
}
