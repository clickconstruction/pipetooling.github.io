/**
 * A text matcher for a screen that draws its amounts through the door (`src/components/Money.tsx`, v2.8374).
 *
 * An amount is two spans, `$1,250` and a smaller `.00`, so `getByText('$1,250.00')` finds nothing: Testing
 * Library reads an element's own text and the figure is no longer one piece of it. `moneyText` reads an element
 * the way a person does, each amount inside it as the plain text it was:
 *
 *   screen.getByText(moneyText('$1,250.00'))            // the cell that holds the amount
 *   screen.getByText(moneyText('Paid: $1,250.00'))      // words with an amount in them
 *   screen.getByText(moneyText(/\$1,250\.00 still out/))
 *
 * It answers with the element `getByText` answered with before the screen moved to the door: the one that
 * holds the words, never the amount's own span. So a test that goes on to read that element's style, its row
 * or its press reads what it read. `scripts/codemods/small-cents-sweep.mjs --tests` writes it into a test.
 */

/** The amount's own wrapper: its cents sit right under it, marked `data-cents`. */
function isAmount(el: Element): boolean {
  return Array.from(el.children).some((c) => c.hasAttribute('data-cents'))
}

/** An element's own text, each amount directly inside it counted as text. */
function ownTextWithAmounts(el: Element): string {
  let text = ''
  el.childNodes.forEach((node) => {
    if (node.nodeType === 3) text += node.textContent ?? ''
    else if (node.nodeType === 1 && isAmount(node as Element)) text += node.textContent ?? ''
  })
  return text
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()

export function moneyText(text: string | RegExp): (content: string, element: Element | null) => boolean {
  return (_content, element) => {
    if (!element || element.hasAttribute('data-cents') || isAmount(element)) return false
    const own = tidy(ownTextWithAmounts(element))
    return typeof text === 'string' ? own === tidy(text) : text.test(own)
  }
}
