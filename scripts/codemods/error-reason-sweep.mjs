#!/usr/bin/env node
/**
 * Error-reason sweep (punch list #184, sweep D, PR 2 — CI-checked as `check:error-words`).
 *
 * The rule (v2.2843, v2.2861; CLAUDE.md → Working conventions): the sentence a person reads on
 * a failure comes from `formatErrorMessage` (src/utils/errorHandling.ts), so the error's CLASS
 * decides the words — a lost signal reads as the offline copy, a server refusal as a sentence by
 * its code, a plain-object Supabase error by its reason (v2.5898) — and never from a `catch`
 * that reads `e instanceof Error ? e.message : '…'`, which shows the fallback on every bare
 * result-object throw the app makes. Mechanical and re-runnable (rebase rule: re-run this,
 * never hand-resolve its diff). Parsed with the TypeScript compiler, one file at a time.
 *
 * Three rewrites:
 *  1. `X instanceof Error ? X.message : FB`  →  `formatErrorMessage(X, FB)`; the mirrored
 *     `!(X instanceof Error) ? FB : X.message` the same; `X.message || FB` as the true branch
 *     the same. A fallback of `String(X)`, `` `${X}` ``, `X` itself or a nested
 *     `typeof X === 'string' ? X : FB` is folded away (the formatter reads a string itself),
 *     so those become `formatErrorMessage(X)` / `formatErrorMessage(X, FB)`. A fallback of
 *     `undefined` / `null` is left alone and listed (the caller tests for "no message").
 *  2. `catch {` whose try block calls Supabase or an edge function and whose only statement is a
 *     toast or a setter given one string literal  →  `catch (e) {` with the literal wrapped,
 *     `showToast(formatErrorMessage(e, 'Could not save'), 'error')`. Clipboard copies, PDF
 *     builds and partial-success warnings have no Supabase call in the try and are left alone.
 *  3. A network decided by text — `/fetch/i.test(m)`, `m.includes('fetch')` on a message —  is
 *     listed, never rewritten: the fix is `errorKindOf(e) === 'network'` by hand.
 * The import is added (or joined to an existing import from errorHandling).
 *
 * Skipped on purpose: the error plumbing itself, tests, and the public pages and portal cards
 * (a customer reads the class, never the server's words — their voice is a hand PR).
 *
 * Usage: node scripts/codemods/error-reason-sweep.mjs [--dry | --check [--changed]] [paths…]
 *   --dry      lists what it would rewrite, writes nothing
 *   --check    the same over the whole tree, and exits 1 when anything is left
 *   --changed  with --check: only the lines this change wrote (`npm run check:error-words`, CI).
 *              A whole-tree check failed the sweep's own merge: other PRs kept landing the old
 *              ternary between the cut and the merge. So CI refuses it where a PR writes it, and
 *              a re-run of this script sweeps whatever older code still carries it.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { globSync } from 'glob'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const ts = require('typescript')

const CHECK = process.argv.includes('--check')
const CHANGED = CHECK && process.argv.includes('--changed')

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}
/** The base to compare against, the way check-pronoun-openers.ts finds it; null when there is nothing to compare. */
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
/** file → the lines this change wrote, or null in a whole-tree run. */
const CHANGED_LINES = (() => {
  if (!CHANGED) return null
  const map = new Map()
  if (!BASE) return map
  const names = (git(`diff --name-only ${BASE} HEAD -- src`) ?? '').split('\n').filter((f) => /\.(ts|tsx)$/.test(f))
  for (const f of names) map.set(f, changedLines(git(`diff -U0 ${BASE} HEAD -- ${f}`) ?? ''))
  return map
})()
const DRY = CHECK || process.argv.includes('--dry')
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const ERROR_HANDLING = 'src/utils/errorHandling.ts'
const SKIP_FILES = new Set([
  ERROR_HANDLING,
  'src/lib/offlineRecoveryState.ts',
  'src/lib/networkErrorMessage.ts',
  'src/lib/errorClassTelemetry.ts',
  'src/lib/readEdgeFunctionErrorBody.ts',
  // The seal runs before every other module and may import nothing heavy (src/lib/lens/sealFirst.test.ts).
  'src/lib/lens/seal.ts',
])
/** Public pages and the cards drawn on them: a customer never reads a server's words. */
const SKIP_PUBLIC = [
  /^src\/pages\/(CustomerPortal|SubPortal|PayLink|BidRoom|JobContractSign|EstimateAccept|ContractAccept|GcWordAsk|SubmittalRoom|EstimatePublicTerms|HazmatNoticePublic|LegalPortal|LegalConfirm|CustomerRating|SupplyHouseQuotePage|FileOpen)\.tsx$/,
  /^src\/components\/(portal|subPortal|legalPortal)\//,
]
const SUPABASE_CALL = /\bsupabase\b|withSupabaseRetry\(|checkSupabaseError\(|databaseErrorFromResult\(|\.invoke\(|\bfetch\(|callEdge|invokeEdge|executeDeleteChain\(|withRetry\(/
const SHOW_CALLEE = /(toast|setError|setErr\b|setMessage|setProblem|setSaveError|setLoadError|setSubmitError|setFailure|setStatus|setNotice|onError|report)/i

const isSkipped = (f) => SKIP_FILES.has(f) || SKIP_PUBLIC.some((re) => re.test(f)) || /\.test\.tsx?$/.test(f) || f.startsWith('src/test/')

function strip(node) {
  while (ts.isParenthesizedExpression(node)) node = node.expression
  return node
}
/** `X instanceof Error` → the text of X, else null. */
function instanceOfError(cond) {
  cond = strip(cond)
  if (ts.isBinaryExpression(cond) && cond.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword && cond.right.getText() === 'Error') return strip(cond.left).getText()
  return null
}
function notInstanceOfError(cond) {
  cond = strip(cond)
  if (ts.isPrefixUnaryExpression(cond) && cond.operator === ts.SyntaxKind.ExclamationToken) return instanceOfError(cond.operand)
  return null
}
/** `X.message` or `X.message || FB` → { fbOr } when it reads X's message; else null. */
function readsMessage(branch, x) {
  branch = strip(branch)
  if (ts.isPropertyAccessExpression(branch) && branch.name.getText() === 'message' && strip(branch.expression).getText() === x) return { fbOr: null }
  if (ts.isBinaryExpression(branch) && branch.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    const l = strip(branch.left)
    if (ts.isPropertyAccessExpression(l) && l.name.getText() === 'message' && strip(l.expression).getText() === x) return { fbOr: branch.right }
  }
  return null
}
/** The fallback as the formatter's second argument: text, '' for the default, or null to leave the site alone. */
function fallbackArg(fb, x) {
  fb = strip(fb)
  const t = fb.getText()
  if (t === x) return ''
  if (ts.isCallExpression(fb) && fb.expression.getText() === 'String' && fb.arguments.length === 1 && strip(fb.arguments[0]).getText() === x) return ''
  if (ts.isTemplateExpression(fb) && fb.head.text === '' && fb.templateSpans.length === 1 && fb.templateSpans[0].literal.text === '' && strip(fb.templateSpans[0].expression).getText() === x) return ''
  if (t === 'undefined' || t === 'null') return null
  if (ts.isConditionalExpression(fb)) {
    // A further reader of X — `typeof X === 'string' ? X : FB2`, `'message' in X ? String(X.message) : FB2` —
    // is what the formatter does itself: take its last fallback. A conditional that never reads X
    // (`nextId ? 'Could not update' : 'Could not clear'`) is the fallback as written.
    const mentionsX = new RegExp(`\\b${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    if (mentionsX.test(fb.condition.getText()) || mentionsX.test(fb.whenTrue.getText())) return fallbackArg(fb.whenFalse, x)
    return t
  }
  return t
}

const files = (ARGS.length ? ARGS.flatMap((a) => globSync(a.endsWith('.ts') || a.endsWith('.tsx') ? a : `${a.replace(/\/$/, '')}/**/*.{ts,tsx}`)) : globSync('src/**/*.{ts,tsx}')).sort()
let ternaries = 0
let catches = 0
let imports = 0
const leftAlone = []
const textTests = []
const report = []

for (const f of files) {
  if (isSkipped(f)) continue
  if (CHANGED_LINES && !CHANGED_LINES.has(f)) continue
  const onChanged = (lineNo) => !CHANGED_LINES || CHANGED_LINES.get(f).has(lineNo)
  const text = readFileSync(f, 'utf8')
  if (!/instanceof Error|catch \{|catch\{|\/fetch\/i|includes\('fetch'\)|includes\("fetch"\)/.test(text)) continue
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edits = [] // { start, end, text, line }
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1

  const visit = (n) => {
    if (ts.isConditionalExpression(n)) {
      let x = instanceOfError(n.condition)
      let msgBranch = n.whenTrue
      let fbBranch = n.whenFalse
      if (x == null) {
        x = notInstanceOfError(n.condition)
        msgBranch = n.whenFalse
        fbBranch = n.whenTrue
      }
      if (x != null) {
        const reads = readsMessage(msgBranch, x)
        if (reads) {
          let fb = fallbackArg(fbBranch, x)
          if (fb === '' && reads.fbOr) fb = fallbackArg(reads.fbOr, x)
          if (!onChanged(line(n))) {
            // an older line this change left alone: the re-run sweeps it, the check does not refuse it
          } else if (fb == null) leftAlone.push(`${f}:${line(n)}: ${n.getText().replace(/\s+/g, ' ').slice(0, 90)}`)
          else {
            edits.push({ start: n.getStart(), end: n.getEnd(), text: fb === '' ? `formatErrorMessage(${x})` : `formatErrorMessage(${x}, ${fb})`, line: line(n), kind: 'ternary' })
            return // never descend into a rewritten node
          }
        }
      }
    }
    if (ts.isCatchClause(n) && !n.variableDeclaration) {
      const tryText = n.parent.tryBlock.getText()
      const stmts = n.block.statements
      if (SUPABASE_CALL.test(tryText) && stmts.length === 1 && ts.isExpressionStatement(stmts[0]) && ts.isCallExpression(stmts[0].expression)) {
        const call = stmts[0].expression
        const callee = call.expression.getText()
        const lit = call.arguments.find((a) => ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))
        if (SHOW_CALLEE.test(callee) && lit && /\s/.test(lit.text) && lit.text.length >= 12 && onChanged(line(n))) {
          // a name not already used in the enclosing function
          const fn = (() => { let p = n.parent; while (p && !ts.isFunctionLike(p)) p = p.parent; return p ?? sf })()
          const used = new Set((fn.getText().match(/\b[A-Za-z_$][\w$]*\b/g) ?? []))
          const name = ['e', 'err', 'error', 'caught'].find((c) => !used.has(c)) ?? 'caught'
          const catchKw = n.getStart()
          edits.push({ start: catchKw, end: catchKw + 'catch'.length, text: `catch (${name})`, line: line(n), kind: 'catch' })
          edits.push({ start: lit.getStart(), end: lit.getEnd(), text: `formatErrorMessage(${name}, ${lit.getText()})`, line: line(n), kind: 'catch-literal' })
        }
      }
    }
    if (ts.isCallExpression(n)) {
      const t = n.getText().replace(/\s+/g, ' ')
      if (onChanged(line(n)) && (/^\/fetch\/i?\.test\(/.test(t) || (/\.includes\(['"]fetch['"]\)/.test(t) && /message|msg/i.test(n.expression.getText())))) textTests.push(`${f}:${line(n)}: ${t.slice(0, 80)}`)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue

  // The import: join an existing import from errorHandling, or add one after the last import.
  let s = text
  const sorted = edits.sort((a, b) => b.start - a.start)
  for (const e of sorted) s = s.slice(0, e.start) + e.text + s.slice(e.end)
  const needsImport = !/\bformatErrorMessage\b/.test(text)
  if (needsImport) {
    const rel = path.relative(path.dirname(f), ERROR_HANDLING).replace(/\\/g, '/').replace(/\.ts$/, '')
    const spec = rel.startsWith('.') ? rel : `./${rel}`
    const existing = sf.statements.find((st) => ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && /\/utils\/errorHandling$/.test(st.moduleSpecifier.text) && st.importClause && !st.importClause.isTypeOnly && st.importClause.namedBindings && ts.isNamedImports(st.importClause.namedBindings))
    if (existing) {
      const nb = existing.importClause.namedBindings
      const insertAt = nb.elements[nb.elements.length - 1].getEnd()
      // edits were applied from the end backwards; the import sits above every edit, so its offsets hold
      s = s.slice(0, insertAt) + ', formatErrorMessage' + s.slice(insertAt)
    } else {
      const lastImport = [...sf.statements].reverse().find((st) => ts.isImportDeclaration(st))
      const at = lastImport ? lastImport.getEnd() : 0
      s = s.slice(0, at) + (lastImport ? '\n' : '') + `import { formatErrorMessage } from '${spec}'` + (lastImport ? '' : '\n') + s.slice(at)
    }
    imports += 1
  }
  const t = edits.filter((e) => e.kind === 'ternary').length
  const c = edits.filter((e) => e.kind === 'catch').length
  ternaries += t
  catches += c
  report.push(`${f}  (${t ? `${t} ternar${t === 1 ? 'y' : 'ies'}` : ''}${t && c ? ', ' : ''}${c ? `${c} unbound catch${c === 1 ? '' : 'es'}` : ''}; lines ${[...new Set(edits.map((e) => e.line))].sort((a, b) => a - b).join(', ')})`)
  if (!DRY) writeFileSync(f, s)
}

if (CHANGED) console.log(BASE ? `check:error-words reads the lines this change wrote, against ${BASE.slice(0, 12)}.` : 'check:error-words: nothing to compare (a push to main), so nothing to refuse.')
console.log(`${DRY ? '[dry] ' : ''}files: ${report.length} · ternaries → formatErrorMessage: ${ternaries} · catches bound and wrapped: ${catches} · imports added: ${imports}`)
if (report.length) console.log(report.join('\n'))
if (leftAlone.length) console.log(`\nLeft alone (a fallback of undefined/null, or a shape the script does not read):\n${leftAlone.join('\n')}`)
if (textTests.length) console.log(`\nA network decided by text — rewrite by hand as errorKindOf(e) === 'network':\n${textTests.join('\n')}`)
if (CHECK && (report.length || textTests.length)) {
  console.error('\nAn error names its reason: the words come from formatErrorMessage, never from `e instanceof Error ? e.message : …`.')
  console.error('Run `node scripts/codemods/error-reason-sweep.mjs` and commit the result; a text test on the message becomes errorKindOf(e) === \'network\' by hand.')
  process.exit(1)
}
