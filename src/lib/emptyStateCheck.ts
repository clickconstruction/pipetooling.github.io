/**
 * Bare empty sentences (punch list #184, sweep C): the finder behind `npm run check:empty-words`
 * (`scripts/check-empty-words.ts`). The rule, in `CLAUDE.md`: an empty state names the next
 * press. So a sentence a component writes straight into its markup that opens on *No*, *Nothing*,
 * *None* or *Nobody* and ends without a second sentence is a bare empty state, unless it sits
 * inside an `<EmptyState …>` element, whose `next` is the press. The check reads only the lines a
 * change wrote and counts the rest, so the legacy sentences are a number in the log, never a block.
 *
 * What is read: every JSX text child, and every string literal that is a direct JSX child
 * expression or a branch of a conditional that is one (`{q ? 'No bids match.' : 'No bids yet.'}`).
 * A prop string is not read: `main="No bids yet."` is the words, not the markup. Three things a
 * sentence can look like but are not an empty state are left alone: a single word (a Yes / No
 * control, a *None* option), an `<option>`, and a table cell with no `colSpan` (a cell fallback
 * such as *No house*; an empty row spans the table and is read).
 *
 * The TypeScript compiler is loaded through `createRequire`, as the codemods do: its CommonJS
 * bundle has no named ESM exports, so a static import gives an empty namespace under Node.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts: typeof import('typescript') = require('typescript')

export type BareEmptySentence = {
  /** The 1-based line of the sentence's first word. */
  line: number
  /** The sentence, its whitespace collapsed. */
  text: string
}

/** Opens on No, Nothing, None or Nobody and runs to one full stop at most: a sentence with no second sentence naming the press. */
export const BARE_EMPTY_SENTENCE = /^(No|Nothing|None|Nobody)\b[^.?!]{0,80}[.!]?$/

/** A Yes / No control or a None option: one word, no stop. */
const SINGLE_WORD = /^(No|Nothing|None|Nobody)$/

export const EMPTY_STATE_TAG = 'EmptyState'

/** The exact sentence the check prints on a failure. */
export const BARE_EMPTY_ADVICE =
  'An empty state names the next press: draw it with <EmptyState main=… next=…> (src/components/EmptyState.tsx), or with main alone when it is a sub-list inside a window.'

type SourceFile = import('typescript').SourceFile
type Node = import('typescript').Node
type Expression = import('typescript').Expression
type JsxOpeningLikeElement = import('typescript').JsxOpeningLikeElement

function tagName(sf: SourceFile, el: JsxOpeningLikeElement): string {
  return el.tagName.getText(sf)
}

function hasAttribute(el: JsxOpeningLikeElement, name: string): boolean {
  return el.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText() === name)
}

/** The element whose child this node is, or null at the top. */
function parentElement(node: Node): JsxOpeningLikeElement | null {
  const p = node.parent
  if (p && ts.isJsxElement(p)) return p.openingElement
  return null
}

function insideEmptyState(sf: SourceFile, node: Node): boolean {
  for (let p: Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isJsxElement(p) && tagName(sf, p.openingElement) === EMPTY_STATE_TAG) return true
  }
  return false
}

/** An option, or a table cell with no colSpan: a fallback value, not an empty list. */
function isCellOrOption(sf: SourceFile, node: Node): boolean {
  const el = parentElement(node)
  if (!el) return false
  const tag = tagName(sf, el)
  return tag === 'option' || (tag === 'td' && !hasAttribute(el, 'colSpan'))
}

/** Every bare empty sentence in a `.tsx` source, with its line. */
export function bareEmptySentences(source: string, fileName: string): BareEmptySentence[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: BareEmptySentence[] = []

  const consider = (text: string, pos: number, child: Node): void => {
    const collapsed = text.replace(/\s+/g, ' ').trim()
    if (!BARE_EMPTY_SENTENCE.test(collapsed) || SINGLE_WORD.test(collapsed)) return
    if (insideEmptyState(sf, child) || isCellOrOption(sf, child)) return
    out.push({ line: sf.getLineAndCharacterOfPosition(pos).line + 1, text: collapsed })
  }

  /** A string literal, or the literal branches of a conditional, however deep. */
  const literalBranches = (expr: Expression, child: Node): void => {
    const e = ts.isParenthesizedExpression(expr) ? expr.expression : expr
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) consider(e.text, e.getStart(sf), child)
    else if (ts.isConditionalExpression(e)) {
      literalBranches(e.whenTrue, child)
      literalBranches(e.whenFalse, child)
    }
  }

  const visit = (node: Node): void => {
    if (ts.isJsxText(node)) {
      const lead = node.getFullText(sf).search(/\S/)
      if (lead >= 0) consider(node.text, node.pos + lead, node)
    } else if (ts.isJsxExpression(node) && node.expression && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      literalBranches(node.expression, node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/** The findings on the lines a change wrote, and how many sit on lines it left alone. */
export function bareEmptyOnChangedLines(found: ReadonlyArray<BareEmptySentence>, changed: ReadonlySet<number>): { onChanged: BareEmptySentence[]; elsewhere: number } {
  const onChanged = found.filter((f) => changed.has(f.line))
  return { onChanged, elsewhere: found.length - onChanged.length }
}
