#!/usr/bin/env node
/**
 * Small-cents sweep (the owner's rule of 2026-11-23; CI-checked as `check:small-cents`).
 *
 * The rule (CLAUDE.md → Working conventions, *Values in place*): an amount on a screen draws its cents smaller
 * than its dollars, through the app's one door, `src/components/Money.tsx`, never as `$` and `formatCurrency`
 * written into the screen. Mechanical and re-runnable (rebase rule: re-run this, never hand-resolve its diff).
 * Parsed with the TypeScript compiler, one file at a time.
 *
 * It reads what a component DRAWS: a JSX child, and the branches of a `? :`, `&&`, `||` or `??` inside one.
 * Six rewrites, each of which leaves the characters on the screen as they were:
 *  1. `${formatCurrency(x)}` as JSX text, the `$` and then the call       →  `<Money amount={x} />`
 *  2. `` {`$${formatCurrency(x)}`} `` and `{'$' + formatCurrency(x)}`      →  `<Money amount={x} />`
 *  3. a template or a `+` chain with words around such an amount          →  `<MoneyText text={…} />`
 *  4. a call to a function that returns money to the cent with its `$`    →  `<MoneyText text={fn(x)} />`
 *     (a local `money`, `usd`, `formatUsd`…, read from its own body, or an import read from its file)
 *  5. `${x.toFixed(2)}` as JSX text, or `x.toLocaleString` to two places   →  `` <MoneyText text={`$${x.toFixed(2)}`} /> ``
 *  6. `{formatCurrency(x)}` with no `$` before it, a column of bare figures →  `<Money amount={x} symbol="" />`
 *     unless `x` reads as hours, a count or a percent (NOT_MONEY), which `--held` lists for a hand.
 * `MoneyText` shrinks the cents of a figure that carries its `$` and nothing else, so `8.50 h` stays words.
 * The import is added, or joined to an existing import from the door.
 *
 * Left alone on purpose, since a span cannot be drawn there or the reader is not the team:
 *  - a string handed to a prop (`title`, `aria-label`, a toast, a CSV cell, a print builder): it stays words;
 *  - `<option>`, an SVG `<title>`, and SVG `<text>` (a chart's label takes `MoneyTspans` by hand);
 *  - a line that also holds an older bare empty sentence (*Nothing paid yet*): `check:empty-words` would count
 *    the sentence as new once the line changes, so the line and its amount stay until a hand reworks the sentence;
 *  - anything inside a `data-theme="light"` wrapper, and the public pages and portal cards (SKIP_PUBLIC): a
 *    customer's screen and a print keep the look they have until the owner says otherwise;
 *
 * Usage: node scripts/codemods/small-cents-sweep.mjs [--dry | --check [--changed]] [--held] [--tests] [paths…]
 *   (no flag)  rewrites the paths given, or every swept surface when none is given
 *   --dry      lists what it would rewrite, writes nothing
 *   --check    the same over the swept surfaces (the files in small-cents-swept/), and exits 1 when anything is left
 *   --changed  with --check: only the lines this change wrote (`npm run check:small-cents`, CI), so a PR is
 *              refused where it writes a bare amount and never for an older line another PR landed
 *   --held     also lists what it left for a hand: figures that read as hours, chart labels, money handed to a prop
 *   --tidy     also takes out a `formatCurrency` import or local copy that an earlier run left unread
 *   --tests    rewrites the TEST files under the paths instead: a matcher that finds an amount by its text,
 *              `getByText('$1,250.00')`, becomes `getByText(moneyText('$1,250.00'))` (src/test/moneyText.ts),
 *              which reads an amount's two spans as the one piece of text they were
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { globSync } from 'glob'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const ts = require('typescript')

/**
 * The surfaces already swept. Each sweep adds ONE file of its own to `scripts/codemods/small-cents-swept/`, a path
 * or a glob a line (`#` starts a comment), so two sweeps in flight never edit the same lines and merge in any
 * order. `check:small-cents` reads every file there.
 */
const SWEPT_DIR = 'scripts/codemods/small-cents-swept'
const SWEPT = globSync(`${SWEPT_DIR}/*.txt`)
  .sort()
  .flatMap((file) => readFileSync(file, 'utf8').split('\n'))
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

const CHECK = process.argv.includes('--check')
const CHANGED = CHECK && process.argv.includes('--changed')
const HELD = process.argv.includes('--held')
const TESTS = process.argv.includes('--tests')
const TIDY = process.argv.includes('--tidy')
const DRY = CHECK || process.argv.includes('--dry')
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const DOOR = 'src/components/Money.tsx'
const TEST_HELPER = 'src/test/moneyText.ts'
/**
 * The name of the app's figure-to-the-cent formatter, which writes NO `$`: the screen writes the `$` itself.
 * The name alone proves nothing. A file may carry its own `formatCurrency` that writes the `$` (Intl's currency
 * style), and a component may be handed one as a prop. So a call counts as bare only where the script has read
 * the function's body, in the file or in the file it is imported from (`bareNamesFor`).
 */
const CENTS_BARE = new Set(['formatCurrency'])
/** The names that are the bare formatter in the file being read. Set by `sweepFile` before it reads a leaf. */
let BARE = new Set()
/** Returns money to the cent WITH its `$`, where the body alone does not show it. */
const CENTS_MONEY_KNOWN = new Set(['moneyWords', 'formatLegalMoney'])
/** Never a money function, whatever its body says: the door's own pieces and the kernels they read. */
const NEVER = new Set(['moneyParts', 'moneyTextParts', 'moneyFigureParts', 'Money', 'MoneyText', 'MoneyTspans'])

/** Public pages and the cards drawn on them: a customer's screen keeps its look (the owner's default, 2026-11-23). */
const SKIP_PUBLIC = [
  /^src\/pages\/(CustomerPortal|SubPortal|PayLink|BidRoom|JobContractSign|EstimateAccept|ContractAccept|GcWordAsk|SubmittalRoom|EstimatePublicTerms|HazmatNoticePublic|LegalPortal|LegalConfirm|CustomerRating|SupplyHouseQuotePage|FileOpen|ShowUs|PartnerStatement)\.tsx$/,
  // `partner` is the partner's statement as paper: its print is the page.
  /^src\/components\/(portal|subPortal|legalPortal|partner)\//,
]
/** One file left alone, with why. A print or a paper drawn as a component keeps the look of the paper. */
const SKIP_FILES = new Map([
  [DOOR, 'the door itself'],
  ['src/components/AmountSmallCents.tsx', 'an older name over the door'],
  ['src/components/jobs/MoneySmallCents.tsx', 'an older name over the door'],
  ['src/components/charges/Money.tsx', 'an older name over the door'],
  ['src/components/estimates/EstimateAcceptBody.tsx', 'the page a customer accepts an estimate on'],
  ['src/components/estimates/EstimateCustomerDocument.tsx', 'the estimate as the customer reads it, and its print'],
  ['src/components/estimates/EstimateOfferedOptions.tsx', 'the options as the customer reads them'],
  ['src/components/estimates/EstimateOptionsPicker.tsx', 'the option cards a customer picks from'],
])

const isTest = (f) => /\.test\.tsx?$/.test(f) || f.startsWith('src/test/')
/** `formatCurrency` is also used for two decimals of something else. A figure named like one of these is not money. */
const NOT_MONEY = /hour|hrs\b|\bh\b|minute|\bmins?\b|qty|quantit|pct|percent|miles|\bdays?\b|count\b/i
const isSkipped = (f) => SKIP_FILES.has(f) || SKIP_PUBLIC.some((re) => re.test(f)) || isTest(f) || !f.endsWith('.tsx')

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}
/** The base to compare against, the way error-reason-sweep.mjs finds it; null when there is nothing to compare. */
function baseRef() {
  const event = process.env.GITHUB_EVENT_NAME
  if (event === 'push') return null
  if (event === 'pull_request' || event === 'merge_group') {
    git('fetch -q --deepen=1')
    if (git('rev-parse --verify HEAD^2') !== null) return 'HEAD^1'
  }
  if (git('rev-parse --verify origin/main') === null) git('fetch -q origin main')
  const base = git('merge-base origin/main HEAD')
  if (base) return base
  return git('rev-parse --verify origin/main') !== null ? 'origin/main' : null
}
/** The 1-based lines a unified diff with no context writes in the new file. */
function changedLines(diff) {
  const out = new Set()
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1])
    const count = m[2] == null ? 1 : Number(m[2])
    for (let i = 0; i < count; i++) out.add(start + i)
  }
  return out
}
const BASE = CHANGED ? baseRef() : null
/** file → the lines this change wrote, or null in a whole-surface run. */
const CHANGED_LINES = (() => {
  if (!CHANGED) return null
  const map = new Map()
  if (!BASE) return map
  const names = (git(`diff --name-only ${BASE} HEAD -- src`) ?? '').split('\n').filter((f) => /\.tsx$/.test(f))
  for (const f of names) map.set(f, changedLines(git(`diff -U0 ${BASE} HEAD -- ${f}`) ?? ''))
  return map
})()

const expand = (patterns, exts) => patterns.flatMap((a) => globSync(/\.(ts|tsx)$/.test(a) ? a : `${a.replace(/\/$/, '')}/**/*.${exts}`)).sort()

function strip(node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isAsExpression(node))) node = node.expression
  return node
}
const parse = (f, text) => ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

// ---------- Which functions return money to the cent, with its `$` ----------

/** A `$` written as money: before a template's value, alone in a string, or before a digit. Never a pattern's end mark. */
const WRITES_A_DOLLAR = /\$\$\{|['"`][−+-]?\$(?:['"`]|\d)|style:\s*['"]currency['"]/
/** A body that writes a `$` and a figure to the cent. `${` is a template's own mark, not a dollar sign. */
function bodyIsCentsMoney(body, known) {
  if (!WRITES_A_DOLLAR.test(body) && !known.some((n) => new RegExp(`\\b${n}\\(`).test(body))) return false
  if (/minimumFractionDigits:\s*2|\.toFixed\(2\)|\bformatCurrency\(/.test(body)) return true
  if (/style:\s*['"]currency['"]/.test(body) && !/maximumFractionDigits:\s*0/.test(body)) return true
  return known.some((n) => new RegExp(`\\b${n}\\(`).test(body))
}
/** An expression that is plainly a string: a literal, a template, a `+` chain of them, or a choice between such. */
function stringy(e) {
  e = strip(e)
  if (!e) return false
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)) return true
  if (ts.isConditionalExpression(e)) return stringy(e.whenTrue) && stringy(e.whenFalse)
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) return stringy(e.left) || stringy(e.right)
  return false
}
/**
 * A function that returns a string and nothing else: it says `: string`, or every value it returns is plainly
 * one. A function that returns rows, a model or JSX is never a money function, whatever figures its body formats.
 */
function returnsString(fn) {
  if (fn.type) return fn.type.getText().replace(/\s+/g, '') === 'string'
  if (!ts.isBlock(fn.body)) return stringy(fn.body)
  const returns = []
  const visit = (n) => {
    if (ts.isFunctionLike(n)) return
    if (ts.isReturnStatement(n)) returns.push(n.expression)
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(fn.body, visit)
  return returns.length > 0 && returns.every((r) => r && stringy(r))
}
/** name → body text, for every function a file declares at any depth that returns a string. */
function declaredFunctions(sf) {
  const out = new Map()
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body && returnsString(n)) out.set(n.name.text, { body: n.body.getText(), exported: !!n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) })
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const init = strip(n.initializer)
      if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && returnsString(init)) {
        const stmt = n.parent?.parent
        out.set(n.name.text, { body: init.body.getText(), exported: !!(stmt && ts.isVariableStatement(stmt) && stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}
/** The names in a file that return money to the cent with its `$`, to a fixed point (a helper over a helper). */
function centsMoneyNames(sf) {
  const fns = declaredFunctions(sf)
  const names = new Set()
  for (let grew = true; grew; ) {
    grew = false
    for (const [name, { body }] of fns) {
      if (names.has(name) || NEVER.has(name)) continue
      if (bodyIsCentsMoney(body, [...names, ...CENTS_MONEY_KNOWN])) {
        names.add(name)
        grew = true
      }
    }
  }
  return { names, fns }
}
const moduleCache = new Map()
/** The exported names of a module that return money to the cent with its `$`. */
function exportedCentsMoney(file) {
  if (moduleCache.has(file)) return moduleCache.get(file)
  let out = new Set()
  if (existsSync(file)) {
    const sf = parse(file, readFileSync(file, 'utf8'))
    const { names, fns } = centsMoneyNames(sf)
    out = new Set([...names].filter((n) => fns.get(n)?.exported))
  }
  moduleCache.set(file, out)
  return out
}
function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null
  const base = path.join(path.dirname(from), spec)
  for (const cand of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) if (existsSync(cand)) return cand.replace(/\\/g, '/')
  return null
}
/** Every name a file can call that returns money to the cent with its `$`: its own, and what it imports. */
function moneyNamesFor(f, sf) {
  const { names } = centsMoneyNames(sf)
  const out = new Set([...names])
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause?.namedBindings || !ts.isNamedImports(st.importClause.namedBindings)) continue
    const target = resolveImport(f, st.moduleSpecifier.text)
    for (const el of st.importClause.namedBindings.elements) {
      const imported = (el.propertyName ?? el.name).text
      if (NEVER.has(imported)) continue
      if (CENTS_MONEY_KNOWN.has(imported) || (target && exportedCentsMoney(target).has(imported))) out.add(el.name.text)
    }
  }
  return out
}

/** A body that formats to the cent and writes no `$`: the bare formatter. */
const bodyIsBare = (body) => /minimumFractionDigits:\s*2|\.toFixed\(2\)/.test(body) && !WRITES_A_DOLLAR.test(body)
const bareCache = new Map()
function exportedBare(file) {
  if (bareCache.has(file)) return bareCache.get(file)
  let out = new Set()
  if (existsSync(file)) {
    const fns = declaredFunctions(parse(file, readFileSync(file, 'utf8')))
    out = new Set([...fns].filter(([name, fn]) => CENTS_BARE.has(name) && fn.exported && bodyIsBare(fn.body)).map(([name]) => name))
  }
  bareCache.set(file, out)
  return out
}
/** The names a file can call that are the bare formatter: its own copy, or the import, each read from its body. */
function bareNamesFor(f, sf) {
  const out = new Set()
  for (const [name, fn] of declaredFunctions(sf)) if (CENTS_BARE.has(name) && bodyIsBare(fn.body)) out.add(name)
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause?.namedBindings || !ts.isNamedImports(st.importClause.namedBindings)) continue
    const target = resolveImport(f, st.moduleSpecifier.text)
    for (const el of st.importClause.namedBindings.elements) {
      const imported = (el.propertyName ?? el.name).text
      if (CENTS_BARE.has(imported) && target && exportedBare(target).has(imported)) out.add(el.name.text)
    }
  }
  return out
}

// ---------- What a drawn expression holds ----------

const callName = (n) => (n && ts.isCallExpression(n) && ts.isIdentifier(n.expression) ? n.expression.text : null)
const isBareCall = (n) => BARE.has(callName(strip(n)) ?? '') && strip(n).arguments.length === 1 && !ts.isSpreadElement(strip(n).arguments[0])
/** A figure to the cent written in place: `x.toFixed(2)`, or `x.toLocaleString(…, { minimumFractionDigits: 2 })`. */
const isToFixed2 = (n) => {
  n = strip(n)
  if (!n || !ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return false
  const name = n.expression.name.text
  if (name === 'toFixed') return n.arguments.length === 1 && n.arguments[0].getText() === '2'
  return name === 'toLocaleString' && n.arguments.some((a) => /minimumFractionDigits:\s*2\b/.test(a.getText()) && !/style:/.test(a.getText()))
}
/** A template: is it exactly `$${formatCurrency(x)}`, or does it hold an amount among words? */
function readTemplate(t, money) {
  let amount = false
  let prev = t.head.text
  for (const span of t.templateSpans) {
    const e = strip(span.expression)
    if (prev.endsWith('$') && (isBareCall(e) || isToFixed2(e))) amount = true
    if (money.has(callName(e) ?? '')) amount = true
    prev = span.literal.text
  }
  const exact = t.head.text === '$' && t.templateSpans.length === 1 && t.templateSpans[0].literal.text === '' && isBareCall(t.templateSpans[0].expression)
  return { amount, exact: exact ? strip(t.templateSpans[0].expression).arguments[0].getText() : null }
}
/** A `+` chain, flattened left to right. */
function plusParts(n) {
  n = strip(n)
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return [...plusParts(n.left), ...plusParts(n.right)]
  return [n]
}
function readPlus(n, money) {
  const parts = plusParts(n)
  if (parts.length < 2) return { amount: false, exact: null }
  let amount = false
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    const before = i > 0 && (ts.isStringLiteral(parts[i - 1]) || ts.isNoSubstitutionTemplateLiteral(parts[i - 1])) ? parts[i - 1].text : ''
    if (before.endsWith('$') && (isBareCall(p) || isToFixed2(p))) amount = true
    if (money.has(callName(p) ?? '')) amount = true
  }
  const exact = parts.length === 2 && ts.isStringLiteral(parts[0]) && parts[0].text === '$' && isBareCall(parts[1])
  return { amount, exact: exact ? strip(parts[1]).arguments[0].getText() : null }
}
/** The value positions of a drawn expression: itself, and the branches of `? :`, `&&`, `||`, `??`. */
function leaves(expr, out = []) {
  const n = strip(expr)
  if (!n) return out
  if (ts.isConditionalExpression(n)) {
    leaves(n.whenTrue, out)
    leaves(n.whenFalse, out)
  } else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) leaves(n.right, out)
  else if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.BarBarToken || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    leaves(n.left, out)
    leaves(n.right, out)
  } else out.push(n)
  return out
}

/** Props that are plain words by their nature. Money handed to any other prop is listed by --held for a hand. */
const PLAIN_PROPS = /^(title|alt|placeholder|aria-.*|data-.*|key|id|name|href|download|className|style|value|defaultValue|type|role|htmlFor|src|to)$/
const tagName = (el) => (ts.isJsxElement(el) ? el.openingElement.tagName.getText() : ts.isJsxSelfClosingElement(el) ? el.tagName.getText() : '')
const attrsOf = (el) => (ts.isJsxElement(el) ? el.openingElement.attributes.properties : ts.isJsxSelfClosingElement(el) ? el.attributes.properties : [])
const isLight = (el) => attrsOf(el).some((a) => ts.isJsxAttribute(a) && a.name.getText() === 'data-theme' && a.initializer && /light/.test(a.initializer.getText()))

// ---------- What the sweep leaves unused ----------

/**
 * A file whose every `formatCurrency` call went to the door is left with an import, or a local copy of the
 * function, that nothing reads. Both are taken out, so the typecheck does not stop on them. Also run on a file
 * with nothing to rewrite (`--tidy`), for one an earlier run of the script left that way.
 */
function dropUnused(f, text) {
  let s = text
  for (const name of CENTS_BARE) {
    const uses = s.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0
    if (uses !== 1) continue
    const sf = parse(f, s)
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name?.text === name) {
        // The function and the comment above it, with the blank line that followed.
        const start = st.getFullStart()
        const end = st.getEnd()
        s = s.slice(0, start) + s.slice(end)
        break
      }
      if (ts.isImportDeclaration(st) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
        const els = st.importClause.namedBindings.elements
        const el = els.find((e) => e.name.text === name)
        if (!el) continue
        if (els.length === 1 && !st.importClause.name) {
          const end = s[st.getEnd()] === '\n' ? st.getEnd() + 1 : st.getEnd()
          s = s.slice(0, st.getStart()) + s.slice(end)
        } else {
          const i = els.indexOf(el)
          // Take the name with the comma that goes with it: the one after it, or the one before the last name.
          const from = i === els.length - 1 ? els[i - 1].getEnd() : el.getStart()
          const to = i === els.length - 1 ? el.getEnd() : els[i + 1].getStart()
          s = s.slice(0, from) + s.slice(to)
        }
        break
      }
    }
  }
  return s
}

// ---------- The run ----------

let report = []
const heldBare = []
const heldSvg = []
const heldProps = []
const heldNames = []
const heldEmpty = []
/** A bare empty sentence drawn on a line, as `src/lib/emptyStateCheck.ts` reads one: it opens on No, Nothing, None or Nobody. */
const BARE_EMPTY_ON_LINE = /(?:>|['"`])\s*(?:No|Nothing|None|Nobody)\s[^.?!<>{}'"`]{0,80}[.!]?\s*(?:<|['"`])/
let totals = { money: 0, text: 0, imports: 0 }
/** The functions read as money, with how many drawn calls each has: a dry run's list to check by eye. */
const readAsMoney = new Map()

function sweepFile(f) {
  const text = readFileSync(f, 'utf8')
  if (!/\$|toFixed\(2\)|formatCurrency\(/.test(text)) return
  const sf = parse(f, text)
  BARE = bareNamesFor(f, sf)
  const money = new Set([...moneyNamesFor(f, sf)].filter((n) => !BARE.has(n)))
  const onChanged = (lineNo) => !CHANGED_LINES || CHANGED_LINES.get(f)?.has(lineNo)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const edits = [] // { start, end, text, line, kind: 'money' | 'text' }
  const where = (n) => `${f}:${line(n)}: ${n.getText().replace(/\s+/g, ' ').slice(0, 100)}`

  /** One value position. `whole` is the `{…}` it fills alone, with the JSX text before it. */
  const readLeaf = (leaf, whole, ctx) => {
    let edit = null
    // The leaf fills its `{…}` alone, so the JSX text before the braces is the text before the figure.
    const alone = !!whole && strip(whole.node.expression) === leaf
    // The `$` may end its line with the figure on the next: JSX joins them with nothing between, and so does the edit.
    const tail = alone && whole.before ? /\$(\s*\n\s*)?$/.exec(sf.text.slice(whole.before.pos, whole.before.end)) : null
    const dollarAt = tail ? whole.before.end - tail[0].length : null
    if (isBareCall(leaf)) {
      const arg = leaf.arguments[0].getText()
      if (dollarAt != null) edit = { start: dollarAt, end: whole.node.getEnd(), text: `<Money amount={${arg}} />`, kind: 'money' }
      else if (NOT_MONEY.test(arg)) {
        if (HELD && !ctx.quiet) heldBare.push(where(leaf))
      } else edit = { text: `<Money amount={${arg}} symbol="" />`, kind: 'money' }
    } else if (isToFixed2(leaf)) {
      if (dollarAt != null) edit = { start: dollarAt, end: whole.node.getEnd(), text: `<MoneyText text={\`$\${${leaf.getText()}}\`} />`, kind: 'text' }
    } else if (ts.isCallExpression(leaf) && money.has(callName(leaf) ?? '')) {
      edit = { text: `<MoneyText text={${leaf.getText()}} />`, kind: 'text' }
      readAsMoney.set(callName(leaf), (readAsMoney.get(callName(leaf)) ?? 0) + 1)
    } else if (ts.isTemplateExpression(leaf)) {
      const r = readTemplate(leaf, money)
      if (r.exact != null) edit = { text: `<Money amount={${r.exact}} />`, kind: 'money' }
      else if (r.amount) edit = { text: `<MoneyText text={${leaf.getText()}} />`, kind: 'text' }
    } else if (ts.isBinaryExpression(leaf) && leaf.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const r = readPlus(leaf, money)
      if (r.exact != null) edit = { text: `<Money amount={${r.exact}} />`, kind: 'money' }
      else if (r.amount) edit = { text: `<MoneyText text={${leaf.getText()}} />`, kind: 'text' }
    }
    if (!edit) return
    if (ctx.svg) {
      if (HELD) heldSvg.push(where(leaf))
      return
    }
    if (ctx.quiet || !onChanged(line(leaf))) return
    if (edit.start == null) {
      // Alone, the element takes the braces' place. Inside a branch it takes the leaf's.
      edit.start = alone ? whole.node.getStart() : leaf.getStart()
      edit.end = alone ? whole.node.getEnd() : leaf.getEnd()
    }
    edits.push({ ...edit, line: line(leaf) })
  }

  const visit = (n, ctx) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = tagName(n)
      const next = { svg: ctx.svg || tag === 'text' || tag === 'tspan' || tag === 'textPath', quiet: ctx.quiet || isLight(n) || tag === 'option' || tag === 'title' || tag === 'Money' || tag === 'MoneyText' || tag === 'MoneyTspans' }
      if (HELD && !next.quiet) {
        for (const a of attrsOf(n)) {
          if (!ts.isJsxAttribute(a) || !a.initializer || !ts.isJsxExpression(a.initializer) || !a.initializer.expression || PLAIN_PROPS.test(a.name.getText())) continue
          for (const leaf of leaves(a.initializer.expression)) {
            const holds = (ts.isTemplateExpression(leaf) && readTemplate(leaf, money).amount) || (ts.isCallExpression(leaf) && money.has(callName(leaf) ?? '')) || (ts.isBinaryExpression(leaf) && readPlus(leaf, money).amount)
            if (holds) heldProps.push(`${f}:${line(leaf)}: <${tag} ${a.name.getText()}=…> ${leaf.getText().replace(/\s+/g, ' ').slice(0, 80)}`)
          }
        }
      }
      // Attributes are visited for the JSX they may hold (a `v={<b>…</b>}`), never as drawn text themselves.
      for (const a of attrsOf(n)) ts.forEachChild(a, (c) => visit(c, next))
      if (ts.isJsxElement(n)) drawChildren(n.children, next)
      return
    }
    if (ts.isJsxFragment(n)) return drawChildren(n.children, ctx)
    ts.forEachChild(n, (c) => visit(c, ctx))
  }
  const drawChildren = (children, ctx) => {
    children.forEach((c, i) => {
      if (ts.isJsxExpression(c) && c.expression) {
        const before = i > 0 && ts.isJsxText(children[i - 1]) ? children[i - 1] : null
        const startCount = edits.length
        for (const leaf of leaves(c.expression)) readLeaf(leaf, { node: c, before }, ctx)
        // A rewritten leaf is never descended into; anything else may hold JSX of its own (a `.map`).
        if (edits.length === startCount) visit(c.expression, ctx)
        else leavesWithJsx(c.expression, ctx)
      } else visit(c, ctx)
    })
  }
  /** After an edit in one branch, the other branches may still hold JSX to read. */
  const leavesWithJsx = (expr, ctx) => {
    for (const leaf of leaves(expr)) {
      if (edits.some((e) => e.start <= leaf.getStart() && leaf.getEnd() <= e.end)) continue
      visit(leaf, ctx)
    }
  }
  visit(sf, { svg: false, quiet: false })
  if (!edits.length) {
    if (TIDY) {
      const tidied = dropUnused(f, text)
      if (tidied !== text) {
        report.push(`${f}  (an unused formatCurrency taken out)`)
        if (!DRY) writeFileSync(f, tidied)
      }
    }
    return
  }

  // `check:empty-words` fails a bare empty sentence on a line a PR writes and only counts one on a line it left
  // alone. Rewriting an amount would make an older sentence on the same line count as new, so that line is left
  // exactly as it is and listed: the amount moves when a hand gives the sentence its next press.
  const sourceLines = text.split('\n')
  const lineAt = (pos) => sf.getLineAndCharacterOfPosition(pos).line
  for (const e of [...edits]) {
    for (let l = lineAt(e.start); l <= lineAt(e.end - 1); l++) {
      if (BARE_EMPTY_ON_LINE.test(sourceLines[l] ?? '')) {
        heldEmpty.push(`${f}:${l + 1}: ${(sourceLines[l] ?? '').trim().slice(0, 110)}`)
        edits.splice(edits.indexOf(e), 1)
        break
      }
    }
  }
  if (!edits.length) return

  // A file that already uses the door's names for something else is a hand's job.
  const taken = ['Money', 'MoneyText'].filter((name) => edits.some((e) => e.text.startsWith(`<${name} `)) && new RegExp(`\\b(function|const|class|type|interface)\\s+${name}\\b`).test(text))
  const foreignImport = sf.statements.find((st) => ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && !/(^|\/)Money$/.test(st.moduleSpecifier.text) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings) && st.importClause.namedBindings.elements.some((el) => el.name.text === 'Money' || el.name.text === 'MoneyText'))
  const olderDoor = sf.statements.find((st) => ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && /charges\/Money$|^\.\/Money$/.test(st.moduleSpecifier.text) && path.join(path.dirname(f), st.moduleSpecifier.text).replace(/\\/g, '/') !== DOOR.replace(/\.tsx$/, ''))
  if (taken.length || foreignImport || olderDoor) {
    heldNames.push(`${f}: ${edits.length} amounts, and the file already has its own ${taken.join(' and ') || 'Money'}`)
    return
  }

  let s = text
  for (const e of [...edits].sort((a, b) => b.start - a.start)) s = s.slice(0, e.start) + e.text + s.slice(e.end)
  const need = ['Money', 'MoneyText'].filter((name) => edits.some((e) => e.text.startsWith(`<${name} `)))
  const rel = path.relative(path.dirname(f), DOOR).replace(/\\/g, '/').replace(/\.tsx$/, '')
  const spec = rel.startsWith('.') ? rel : `./${rel}`
  const existing = sf.statements.find((st) => ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && path.join(path.dirname(f), st.moduleSpecifier.text).replace(/\\/g, '/') === DOOR.replace(/\.tsx$/, '') && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings))
  if (existing) {
    const nb = existing.importClause.namedBindings
    const have = new Set(nb.elements.map((el) => el.name.text))
    const add = need.filter((n) => !have.has(n))
    if (add.length) {
      const insertAt = nb.elements[nb.elements.length - 1].getEnd()
      // edits were applied from the end backwards; the import sits above every edit, so its offsets hold
      s = s.slice(0, insertAt) + add.map((n) => `, ${n}`).join('') + s.slice(insertAt)
      totals.imports += 1
    }
  } else {
    const lastImport = [...sf.statements].reverse().find((st) => ts.isImportDeclaration(st))
    const at = lastImport ? lastImport.getEnd() : 0
    s = s.slice(0, at) + (lastImport ? '\n' : '') + `import { ${need.join(', ')} } from '${spec}'` + (lastImport ? '' : '\n') + s.slice(at)
    totals.imports += 1
  }
  const m = edits.filter((e) => e.kind === 'money').length
  const t = edits.length - m
  totals.money += m
  totals.text += t
  report.push(`${f}  (${m ? `${m} → Money` : ''}${m && t ? ', ' : ''}${t ? `${t} → MoneyText` : ''}; lines ${[...new Set(edits.map((e) => e.line))].sort((a, b) => a - b).join(', ')})`)
  if (!DRY) writeFileSync(f, dropUnused(f, s))
}

// ---------- The tests' matchers ----------

const BY_TEXT = /^(get|query|find)(All)?ByText$/
const AMOUNT_IN_STRING = /\$\s?[\d,]*\d\.\d{2}/
const AMOUNT_IN_REGEX = /\\\$[^/]*\\\.\d\d/
let matchers = 0
function sweepTest(f) {
  const text = readFileSync(f, 'utf8')
  if (!/ByText\(/.test(text)) return
  const sf = parse(f, text)
  const edits = []
  const visit = (n) => {
    if (ts.isCallExpression(n) && n.arguments.length >= 1) {
      const name = ts.isIdentifier(n.expression) ? n.expression.text : ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : ''
      const a = n.arguments[0]
      if (BY_TEXT.test(name)) {
        const isAmount = ((ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && AMOUNT_IN_STRING.test(a.text)) || (ts.isRegularExpressionLiteral(a) && AMOUNT_IN_REGEX.test(a.text))
        if (isAmount) edits.push({ start: a.getStart(), end: a.getEnd(), text: `moneyText(${a.getText()})`, line: sf.getLineAndCharacterOfPosition(a.getStart()).line + 1 })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) return
  let s = text
  for (const e of [...edits].sort((a, b) => b.start - a.start)) s = s.slice(0, e.start) + e.text + s.slice(e.end)
  if (!/\bmoneyText\b/.test(text)) {
    const rel = path.relative(path.dirname(f), TEST_HELPER).replace(/\\/g, '/').replace(/\.ts$/, '')
    const lastImport = [...sf.statements].reverse().find((st) => ts.isImportDeclaration(st))
    const at = lastImport ? lastImport.getEnd() : 0
    s = s.slice(0, at) + (lastImport ? '\n' : '') + `import { moneyText } from '${rel.startsWith('.') ? rel : `./${rel}`}'` + (lastImport ? '' : '\n') + s.slice(at)
  }
  matchers += edits.length
  report.push(`${f}  (${edits.length} matcher${edits.length === 1 ? '' : 's'}; lines ${edits.map((e) => e.line).join(', ')})`)
  if (!DRY) writeFileSync(f, s)
}

if (TESTS) {
  const files = expand(ARGS.length ? ARGS : ['src'], '{ts,tsx}').filter((f) => /\.test\.tsx$/.test(f))
  for (const f of files) sweepTest(f)
  console.log(`${DRY ? '[dry] ' : ''}test files: ${report.length} · matchers → moneyText: ${matchers}`)
  if (report.length) console.log(report.join('\n'))
  process.exit(0)
}

const files = expand(CHECK || !ARGS.length ? SWEPT : ARGS, 'tsx')
for (const f of files) {
  if (isSkipped(f)) continue
  if (CHANGED_LINES && !CHANGED_LINES.has(f)) continue
  sweepFile(f)
}

if (CHANGED) console.log(BASE ? `check:small-cents reads the lines this change wrote on the swept surfaces, against ${BASE.slice(0, 12)}.` : 'check:small-cents: nothing to compare (a push to main), so nothing to refuse.')
console.log(`${DRY ? '[dry] ' : ''}files: ${report.length} · amounts → Money: ${totals.money} · words with an amount → MoneyText: ${totals.text} · imports added: ${totals.imports}`)
if (report.length) console.log(report.join('\n'))
if (heldEmpty.length) console.log(`\nLeft as it is (the line also holds an older empty sentence, which check:empty-words would count as new):\n${[...new Set(heldEmpty)].join('\n')}`)
if (heldNames.length) console.log(`\nLeft for a hand (the file has its own Money, so the import would clash):\n${heldNames.join('\n')}`)
if (HELD) {
  if (readAsMoney.size) console.log(`\nFunctions read as money to the cent (drawn calls): ${[...readAsMoney].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(' · ')}`)
  if (heldBare.length) console.log(`\nA figure that reads as hours, a count or a percent, left as it is (a hand says if it is money):\n${heldBare.join('\n')}`)
  if (heldSvg.length) console.log(`\nA chart's label (SVG text takes MoneyTspans by hand):\n${heldSvg.join('\n')}`)
  if (heldProps.length) console.log(`\nMoney handed to a prop (it stays words unless the component that draws it reads it through MoneyText):\n${heldProps.join('\n')}`)
}
if (CHECK && (report.length || heldNames.length)) {
  console.error('\nAn amount on a screen draws its cents smaller, through `Money` or `MoneyText` (src/components/Money.tsx), never as `$` and `formatCurrency` written into the screen.')
  console.error('Run `node scripts/codemods/small-cents-sweep.mjs <the file>` and commit the result.')
  process.exit(1)
}
