#!/usr/bin/env node
/**
 * Windows below the status bar (v2.4447): every window's panel starts below an iPhone's status bar.
 *
 * The page is `viewport-fit=cover`, so on an iPhone with the app on its Home Screen the layout runs
 * under the clock, the signal bars and the battery, and `env(safe-area-inset-top)` says how tall
 * that bar is (47–62 px; `--app-top-chrome` on `:root` in `src/index.css` carries it, so a walk on
 * the dev server can set it by hand). A window is a `position: fixed` layer over the whole screen.
 * One that starts at `top: 0` with no room for the bar can put its panel's title and × under it,
 * where a finger cannot reach them (v2.4397, the Lien desk; v2.4444, four more).
 *
 * The rule, in two parts:
 *  1. The layer pads its top by `var(--app-top-chrome, 0px)`: the dim still covers the status bar,
 *     the panel starts below it. One `padding` string — never `padding` beside `paddingTop` in one
 *     React style object — or `paddingTop` alone when the layer had no padding.
 *  2. A panel whose height is measured from the whole screen (`vh`) is clamped to the padded layer:
 *     `min(<its own>, 100%)`. A percentage on a direct child of a fixed layer is the room left
 *     inside the padding, so the panel cannot grow back under the bar (or off the bottom).
 * With no inset (a browser tab, Android, a computer) the variable is 0 px and a panel that fitted
 * inside its layer's padding is where it was.
 *
 * A site is an object literal with `position: 'fixed'` and `inset: 0`, or `top: 0` with a `bottom`
 * or a full height — an inline `style`, or a constant a `style` in the same file names. A panel is
 * an element directly inside that layer. Also read: a fixed full-screen rule in a `.css` file or a
 * `<style>` block (reported, never rewritten) and the panels of an element that carries its class.
 * Left alone:
 *  - a layer that already names `safe-area-inset-top` or `--app-top-chrome`, or holds something
 *    that does (a header that pads itself; a window drawn inside it does not count) — padding
 *    both would leave the bar's height twice. A sheet that scrolls itself under a sticky bar is
 *    fixed this way by hand: a sticky bar ignores its scroller's padding, so the bar pads
 *  - a bare click-catcher (nothing inside it)
 *  - a layer or a panel with a `status-bar: allow — <why>` comment up to two lines above it or
 *    inside its opening tag (in CSS: inside the rule or up to two lines above it)
 * Reported for a hand, never rewritten: a layer that holds only things placed by hand (`absolute`,
 * `fixed`, an `<svg>`), where padding moves nothing, and a padding or height it cannot read.
 *
 * Mechanical and re-runnable (rebase rule: re-run this, never hand-resolve its diff). CI runs it
 * with --check (ci.yml and deploy.yml): a new window with no room for the status bar fails its
 * pull request.
 *
 * Usage: node scripts/codemods/window-below-status-bar.mjs [--dry | --check | --list]
 *   --dry    lists what it would change, writes nothing
 *   --check  the same, and exits 1 when anything is left (`npm run check:status-bar`)
 *   --list   prints every full-screen layer with how it stands, writes nothing
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import ts from 'typescript'

const CHECK = process.argv.includes('--check')
const LIST = process.argv.includes('--list')
const DRY = CHECK || LIST || process.argv.includes('--dry')
const TOP = 'var(--app-top-chrome, 0px)'
const HANDLES = /safe-area-inset-top|--app-top-chrome/
const ALLOW = /status-bar:[ \t]*allow\b[ \t—–:-]*\w/
const VH = /\d(?:d|s|l)?vh\b/

const tracked = execSync("git ls-files 'src/*.ts' 'src/**/*.ts' 'src/*.tsx' 'src/**/*.tsx' 'src/*.css' 'src/**/*.css'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
const isTest = (f) => /\.test\.tsx?$/.test(f) || f.startsWith('src/test/')
const codeFiles = tracked.filter((f) => /\.tsx?$/.test(f) && !isTest(f)).sort()
const cssFiles = tracked.filter((f) => f.endsWith('.css')).sort()

// ---- Reading a style
function strip(e) {
  while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e))) e = e.expression
  return e
}
const keyOf = (p) => p.name.getText().replace(/['"]/g, '')
/** A literal's own properties, name → value. */
function ownProps(lit) {
  const m = new Map()
  for (const p of lit.properties) if (ts.isPropertyAssignment(p)) m.set(keyOf(p), p)
  return m
}
const isZero = (v) => v != null && /^(0|['"`]0(px)?['"`])$/.test(strip(v).getText())
/** `position: 'fixed'` over the whole screen: `inset: 0`, or `top: 0` with a bottom or a full height. */
function isFullScreenFixed(lit) {
  const p = ownProps(lit)
  if (!p.has('position') || !/['"`]fixed['"`]/.test(p.get('position').initializer.getText())) return false
  if (isZero(p.get('inset')?.initializer)) return true
  return isZero(p.get('top')?.initializer) && (p.has('bottom') || /100(d|s|l)?vh|100%/.test(p.get('height')?.initializer.getText() ?? ''))
}
/** The object literals a `style` expression can be: itself, the branches of a choice, a constant in this file. */
function styleLiterals(e, consts, depth = 0) {
  e = strip(e)
  if (!e || depth > 5) return []
  if (ts.isObjectLiteralExpression(e)) return [e]
  if (ts.isConditionalExpression(e)) return [...styleLiterals(e.whenTrue, consts, depth + 1), ...styleLiterals(e.whenFalse, consts, depth + 1)]
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return styleLiterals(e.right, consts, depth + 1)
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return [...styleLiterals(e.left, consts, depth + 1), ...styleLiterals(e.right, consts, depth + 1)]
  }
  if (ts.isIdentifier(e)) {
    const init = consts.get(e.text)
    return init ? styleLiterals(init, consts, depth + 1) : []
  }
  return []
}

// ---- JSX
const opening = (el) => (ts.isJsxElement(el) ? el.openingElement : el)
const classNameOf = (el) => opening(el).attributes.properties.find((x) => ts.isJsxAttribute(x) && x.name.getText() === 'className')?.initializer?.getText() ?? ''
function styleExpr(el) {
  const a = opening(el).attributes.properties.find((x) => ts.isJsxAttribute(x) && x.name.getText() === 'style')
  return a?.initializer && ts.isJsxExpression(a.initializer) ? (a.initializer.expression ?? null) : null
}
/** What an element holds directly: its child elements (through fragments, `&&` and `? :`), and whether anything else is drawn (text, a call). */
function directChildren(el) {
  const out = { elements: [], other: false }
  if (!ts.isJsxElement(el)) return out
  const take = (n) => {
    if (!n) return
    if (ts.isJsxText(n)) {
      if (n.getText().trim()) out.other = true
      return
    }
    if (ts.isJsxExpression(n)) return take(n.expression)
    if (ts.isJsxFragment(n)) return n.children.forEach(take)
    const e = ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) ? n : strip(n)
    if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e)) {
      if (opening(e).tagName.getText() !== 'style') out.elements.push(e)
      return
    }
    if (ts.isJsxFragment(e)) return e.children.forEach(take)
    if (ts.isConditionalExpression(e)) return [e.whenTrue, e.whenFalse].forEach(take)
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) return take(e.right)
    if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(e) && e.text === 'undefined')) return
    out.other = true // {children}, {rows.map(…)}, {renderCard()}
  }
  el.children.forEach(take)
  return out
}

// ---- Rewriting
/** Splits a CSS value on the spaces outside its parentheses: `calc(1rem + 2px) 1rem` → two parts. */
function splitTop(s) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of s.trim()) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (/\s/.test(ch) && depth === 0) {
      if (cur) parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) parts.push(cur)
  return parts
}
const cssZero = (s) => /^0(px|rem|em)?$/.test(s)
/** `1rem` → `calc(1rem + var(--app-top-chrome, 0px))`; `0` → the variable alone. */
function plusTop(len) {
  if (cssZero(len)) return TOP
  const inner = /^calc\((.*)\)$/.exec(len)?.[1] ?? len
  return `calc(${inner} + ${TOP})`
}
/** One `padding` string with the status bar added to its top. */
function paddedShorthand(s) {
  const parts = splitTop(s)
  if (parts.length < 1 || parts.length > 4) return null
  const [a, b = a, c = a, d] = parts
  return [plusTop(a), b, c, ...(d ? [d] : [])].join(' ')
}
const quoted = (s) => `'${s}'`
const isPlainString = (e) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)
/** New source for a `padding` (or, with `longhand`, a `paddingTop`) value, or null when it is not one this can read. */
function rewritePadding(e, longhand) {
  e = strip(e)
  if (ts.isNumericLiteral(e)) {
    const px = Number(e.text) === 0 ? '0' : `${e.text}px`
    return quoted(longhand ? plusTop(px) : paddedShorthand(px))
  }
  if (isPlainString(e)) {
    const next = longhand ? (splitTop(e.text).length === 1 ? plusTop(e.text.trim()) : null) : paddedShorthand(e.text)
    return next && quoted(next)
  }
  if (ts.isConditionalExpression(e)) {
    const yes = rewritePadding(e.whenTrue, longhand)
    const no = rewritePadding(e.whenFalse, longhand)
    return yes && no ? `${e.condition.getText()} ? ${yes} : ${no}` : null
  }
  return null
}
/** `90vh` → `min(90vh, 100%)`; `min(90vh, 720px)` → `min(90vh, 720px, 100%)`. */
function clampText(s) {
  const t = s.trim()
  const inner = /^min\((.*)\)$/.exec(t)
  if (inner && splitTop(`${t} x`).length === 2) return `min(${inner[1]}, 100%)`
  return `min(${t}, 100%)`
}
const needsClamp = (text) => VH.test(text) && !HANDLES.test(text) && !/100%/.test(text)
/** New source for a `height` / `maxHeight` value measured in `vh`; '' when nothing in it needs the clamp; null when it cannot be read. */
function rewriteHeight(e) {
  e = strip(e)
  if (!needsClamp(e.getText())) return ''
  if (isPlainString(e)) return quoted(clampText(e.text))
  if (ts.isTemplateExpression(e)) return `\`${clampText(e.getText().slice(1, -1))}\``
  if (ts.isConditionalExpression(e)) {
    const yes = rewriteHeight(e.whenTrue)
    const no = rewriteHeight(e.whenFalse)
    if (yes === null || no === null) return null
    return `${e.condition.getText()} ? ${yes || e.whenTrue.getText()} : ${no || e.whenFalse.getText()}`
  }
  return null
}

// ---- The scan
const findings = []
const listed = []
const edits = new Map()
let layerCount = 0
function edit(file, start, end, text) {
  if (!edits.has(file)) edits.set(file, new Map())
  edits.get(file).set(`${start}:${end}`, { start, end, text })
}

// ---- CSS: a fixed full-screen rule in a .css file or a <style> block (reported; fixed by hand).
/** Class names of those rules: an element that carries one is a layer too, and its panels are read. */
const layerClasses = new Set()
for (const file of [...cssFiles, ...codeFiles.filter((f) => f.endsWith('.tsx'))]) {
  const raw = readFileSync(file, 'utf8')
  if (!/position\s*:\s*fixed/.test(raw)) continue
  // Comments blanked in place, so a rule's offset is the same in both texts.
  const text = raw.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  const lineStarts = [0]
  for (let i = 0; i < raw.length; i += 1) if (raw[i] === '\n') lineStarts.push(i + 1)
  const re = /([^{}`'"]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(text))) {
    const body = m[2]
    if (!/position\s*:\s*fixed/.test(body)) continue
    const full = /(^|[;\s])inset\s*:\s*0(px)?\s*(;|$)/.test(body) || (/(^|[;\s])top\s*:\s*0(px)?\s*(;|$)/.test(body) && /(^|[;\s])bottom\s*:/.test(body))
    if (!full) continue
    layerCount += 1
    const selStart = m.index + m[1].length - m[1].trimStart().length
    const line = raw.slice(0, selStart).split('\n').length
    const at = `${file}:${line}`
    const state = HANDLES.test(body) ? 'pads' : ALLOW.test(raw.slice(lineStarts[Math.max(0, line - 3)], m.index + m[0].length)) ? 'allowed' : 'bare'
    const last = m[1].split(',').map((part) => part.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() ?? '')
    if (state !== 'allowed') for (const sel of last) for (const cls of sel.match(/\.[A-Za-z][A-Za-z0-9_-]+/g) ?? []) layerClasses.add(cls.slice(1))
    listed.push(`${state.padEnd(8)} ${at}  ${m[1].trim().replace(/\s+/g, ' ').slice(-50)}`)
    if (state === 'bare') findings.push({ at, file, line, kind: 'layer', fixable: false, what: `the rule ${m[1].trim().replace(/\s+/g, ' ').slice(-50)} leaves no room for the status bar: add ${TOP} to its top padding by hand` })
  }
}

for (const file of codeFiles) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes('fixed') && ![...layerClasses].some((c) => text.includes(c))) continue
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1
  const allowedAt = (node, end) => ALLOW.test(text.slice(sf.getPositionOfLineAndCharacter(Math.max(0, lineOf(node.getStart()) - 3), 0), end))

  // Constants a `style` can name, and every full-screen fixed literal.
  const declared = new Map()
  const layers = new Map()
  const elementsWithStyle = []
  const classLayers = []
  const collect = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) declared.set(n.name.text, declared.has(n.name.text) ? null : n.initializer)
    if (ts.isObjectLiteralExpression(n) && isFullScreenFixed(n)) layers.set(n, { lit: n, elements: [] })
    if ((ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && styleExpr(n)) elementsWithStyle.push(n)
    if (ts.isJsxElement(n) && (classNameOf(n).match(/[A-Za-z][A-Za-z0-9_-]*/g) ?? []).some((c) => layerClasses.has(c))) classLayers.push(n)
    ts.forEachChild(n, collect)
  }
  collect(sf)
  if (!layers.size && !classLayers.length) continue
  // A name declared twice in the file is not followed: which one a `style` means depends on scope.
  const consts = new Map([...declared].filter(([, init]) => init))
  for (const el of elementsWithStyle) for (const lit of styleLiterals(styleExpr(el), consts)) layers.get(lit)?.elements.push(el)

  // The panels: elements directly inside a layer whose height is measured from the whole screen.
  const panels = (h) => {
    for (const child of h.elements) {
      if (!/^[a-z]/.test(opening(child).tagName.getText()) || !styleExpr(child)) continue
      if (allowedAt(child, opening(child).getEnd())) continue
      for (const childLit of styleLiterals(styleExpr(child), consts)) {
        for (const name of ['height', 'maxHeight']) {
          const p = ownProps(childLit).get(name)
          if (!p) continue
          const next = rewriteHeight(p.initializer)
          if (next === '') continue
          findings.push({ at: `${file}:${lineOf(p.getStart())}`, file, line: lineOf(p.getStart()), kind: 'panel', fixable: next !== null, what: `the panel's ${name} is measured from the whole screen (${p.initializer.getText().replace(/\s+/g, ' ').slice(0, 70)}): clamp it to the padded layer, min(…, 100%)${next === null ? ' — by hand' : ''}` })
          if (next !== null) edit(file, p.initializer.getStart(), p.initializer.getEnd(), next)
        }
      }
    }
  }

  for (const { lit, elements } of layers.values()) {
    layerCount += 1
    const at = `${file}:${lineOf(lit.getStart())}`
    const held = elements.map(directChildren)
    // Its own style names the inset — in the literal, or in a constant its padding names.
    const pads = HANDLES.test(lit.getText()) || ['padding', 'paddingTop'].some((k) => {
      const v = strip(ownProps(lit).get(k)?.initializer)
      return v && ts.isIdentifier(v) && consts.has(v.text) && HANDLES.test(consts.get(v.text).getText())
    })
    // Something inside it names the inset — a header that pads itself. A window drawn inside this one does not count.
    const inside = elements.some((el) => {
      if (!ts.isJsxElement(el)) return false
      const from = el.openingElement.getEnd()
      const nested = [...layers.keys()].filter((l) => l !== lit && l.getStart() >= from && l.getEnd() <= el.getEnd())
      let body = text.slice(from, el.getEnd())
      for (const l of nested) body = body.slice(0, l.getStart() - from) + ' '.repeat(l.getEnd() - l.getStart()) + body.slice(l.getEnd() - from)
      return HANDLES.test(body)
    })
    // Everything in it is placed by hand (`position: absolute / fixed`, an <svg>'s shapes): padding moves nothing.
    const placed = elements.length > 0 && elements.every((el, i) => opening(el).tagName.getText() === 'svg' || (held[i].elements.length > 0 && !held[i].other && held[i].elements.every((c) => styleExpr(c) && styleLiterals(styleExpr(c), consts).some((l) => /['"`](absolute|fixed)['"`]/.test(ownProps(l).get('position')?.initializer.getText() ?? '')))))
    const state = pads
      ? 'pads'
      : elements.length && held.every((h) => !h.elements.length && !h.other)
        ? 'catcher'
        : inside
          ? 'inside'
          : allowedAt(lit, lit.getEnd()) || elements.some((el) => allowedAt(el, opening(el).getEnd()))
            ? 'allowed'
            : placed
              ? 'placed'
              : 'bare'
    listed.push(`${state.padEnd(8)} ${at}`)

    if (state === 'placed') findings.push({ at, file, line: lineOf(lit.getStart()), kind: 'layer', fixable: false, what: 'the layer holds only things placed by hand (absolute, fixed, an svg), so padding moves nothing: place them below the status bar, or say why it does not matter' })
    if (state === 'bare') {
      const props = ownProps(lit)
      const padding = props.get('padding')
      const paddingTop = props.get('paddingTop')
      let fix = null
      if (padding && paddingTop) fix = null
      else if (padding || paddingTop) {
        const p = padding ?? paddingTop
        const next = rewritePadding(p.initializer, !padding)
        if (next) fix = { start: p.initializer.getStart(), end: p.initializer.getEnd(), text: next }
      } else {
        // No padding of its own: `paddingTop` alone, after the last property, in the literal's own layout.
        const last = lit.properties[lit.properties.length - 1]
        const comma = lit.properties.hasTrailingComma
        const multiline = lineOf(last.getStart()) !== lineOf(lit.getStart()) && lineOf(lit.getEnd()) !== lineOf(last.getEnd())
        const end = comma ? text.indexOf(',', last.getEnd()) + 1 : last.getEnd()
        const indent = /^[ \t]*/.exec(text.slice(sf.getPositionOfLineAndCharacter(lineOf(last.getStart()) - 1, 0)))[0]
        const prop = `paddingTop: '${TOP}'`
        fix = { start: end, end, text: multiline ? `${comma ? '' : ','}\n${indent}${prop}${comma ? ',' : ''}` : `${comma ? '' : ','} ${prop}${comma ? ',' : ''}` }
      }
      findings.push({ at, file, line: lineOf(lit.getStart()), kind: 'layer', fixable: !!fix, what: fix ? `the layer leaves no room for the status bar: its top pads by ${TOP}` : `the layer leaves no room for the status bar, and its padding is not a plain value: add ${TOP} to its top by hand` })
      if (fix) edit(file, fix.start, fix.end, fix.text)
    }

    if (state === 'bare' || state === 'pads') held.forEach(panels)
  }
  for (const el of classLayers) if (!allowedAt(el, el.openingElement.getEnd())) panels(directChildren(el))
}

// ---- Report, write
if (LIST) {
  for (const l of listed.sort()) console.log(l)
  const n = (s) => listed.filter((l) => l.startsWith(s)).length
  console.log(`\n${layerCount} full-screen layers: ${n('pads')} pad their top, ${n('inside')} hold something that does, ${n('catcher')} are bare click-catchers, ${n('allowed')} allowed, ${n('bare') + n('placed')} leave no room.`)
  process.exit(0)
}
const byHand = findings.filter((f) => !f.fixable)
const shown = DRY ? findings : byHand
for (const f of shown) console.log(`${f.at}  ${f.what}`)
if (!DRY) {
  for (const [file, set] of edits) {
    let text = readFileSync(file, 'utf8')
    for (const e of [...set.values()].sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end)
    writeFileSync(file, text)
  }
}
const layers = findings.filter((f) => f.kind === 'layer').length
const panels = findings.length - layers
console.log(
  `window-below-status-bar: ${layerCount} full-screen layers; ${layers} leave no room for the status bar, ${panels} panel heights are measured from the whole screen` +
    (DRY ? '.' : `; rewrote ${findings.length - byHand.length} in ${edits.size} files, ${byHand.length} left for a hand.`),
)
if (CHECK && findings.length) {
  console.log(`\nFix: node scripts/codemods/window-below-status-bar.mjs (it rewrites what it can read). See docs/AI_CONTEXT.md → Windows (modals).`)
  console.log('If a layer is not a window, or its panel cannot reach the top, say so: a `status-bar: allow — <why>` comment on the line above it.')
  // In GitHub Actions each finding also lands on the PR's diff as an error annotation.
  if (process.env.GITHUB_ACTIONS === 'true') {
    const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
    for (const f of findings) console.log(`::error file=${f.file},line=${f.line},title=Window under the status bar::${esc(`On an iPhone with the app on its Home Screen ${f.what}.`)}`)
  }
}
process.exit(CHECK && findings.length ? 1 : 0)
