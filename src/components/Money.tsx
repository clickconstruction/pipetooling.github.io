import type { CSSProperties, ReactNode } from 'react'
import { MONEY_CENTS_EM, moneyFigureParts, moneyParts, moneyTextParts, type MoneyPartsOptions, type MoneyTextPart } from '../lib/moneyParts'

/**
 * The app's one door for an amount on a screen (the owner's rule of 2026-11-23: the cents are smaller than the
 * rest of a value's text, across the app). `Money` draws a number, `MoneyText` draws text a kernel already wrote,
 * and `MoneyTspans` is `MoneyText` inside an SVG `<text>`. All three read `src/lib/moneyParts.ts`, and the cents'
 * size is its `MONEY_CENTS_EM`, so no screen picks a size of its own. Selecting and copying still yield the whole
 * figure, since the cents are a plain span.
 *
 * A place that cannot draw a span keeps the plain words (`moneyWords`): a `title`, an `aria-label`, a CSV, an
 * email, a print builder, text for the clipboard, a box a person types in.
 */

const CENTS_SIZE = `${MONEY_CENTS_EM}em`

export type MoneyProps = MoneyPartsOptions & {
  /** The figure. Null or undefined is a figure the app does not have, drawn as `empty`. */
  amount: number | null | undefined
  /** What a missing figure reads as. An em dash unless the screen has its own word. */
  empty?: ReactNode
  style?: CSSProperties
  /** A look for the cents on top of their size: a column that greys them. Never a size, which is one for the app. */
  centsStyle?: CSSProperties
  title?: string
  'data-testid'?: string
  'aria-label'?: string
}

/** `$241,968` then `.73` smaller. A loss reads `−$537.73`, a figure in whole dollars (`cents={false}`) `$48,700`. */
export function Money({ amount, empty = '—', style, centsStyle, title, 'data-testid': testId, 'aria-label': ariaLabel, ...options }: MoneyProps) {
  if (amount == null) return <>{empty}</>
  const p = moneyParts(amount, options)
  return (
    <span style={{ whiteSpace: 'nowrap', ...style }} title={title} data-testid={testId} aria-label={ariaLabel}>
      {p.sign}
      {p.dollars}
      {p.cents ? (
        <span data-cents style={{ fontSize: CENTS_SIZE, ...centsStyle }}>
          {p.cents}
        </span>
      ) : null}
    </span>
  )
}

function parts(text: string, bare: boolean): MoneyTextPart[] {
  if (!bare) return moneyTextParts(text)
  const one = moneyFigureParts(text)
  return one ? [one] : [text]
}

/**
 * Text a kernel already wrote, with each amount's cents smaller: `Paid: $1,250.00 · carry $51.03`. Words with no
 * amount pass through untouched. `bare` is for a money column's cell, which may hold a figure with no `$`
 * (`14,115.35`) or something that is not money at all (`—`).
 */
export function MoneyText({ text, bare = false, centsStyle }: { text: string; bare?: boolean; centsStyle?: CSSProperties }) {
  return (
    <>
      {parts(text, bare).map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <span key={i} style={{ whiteSpace: 'nowrap' }}>
            {p.dollars}
            <span data-cents style={{ fontSize: CENTS_SIZE, ...centsStyle }}>
              {p.cents}
            </span>
          </span>
        ),
      )}
    </>
  )
}

/** `MoneyText` for a chart: the children of an SVG `<text>`, the cents in a smaller `tspan` on the same baseline. */
export function MoneyTspans({ text }: { text: string }) {
  return (
    <>
      {moneyTextParts(text).map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <tspan key={i}>
            {p.dollars}
            <tspan data-cents fontSize={CENTS_SIZE}>
              {p.cents}
            </tspan>
          </tspan>
        ),
      )}
    </>
  )
}
