import type { CSSProperties, ReactNode } from 'react'
import { cardCellEmpty } from '../../../lib/legal/legalPortalCards'

/**
 * One cell of a firm's table that folds into a card on a narrow screen (v2.4808,
 * `src/lib/legal/legalPortalCards.ts`). The cell carries its column's name for the card
 * (`data-label`; an empty name spans the card), drops out of the card when it says nothing
 * (`drop`, which defaults to an empty value), marks money for the card's bold line (`num`),
 * and wraps what it draws in one element so the card's two columns hold any content.
 * On a wide screen it is an ordinary cell with the style it was given.
 */
export function CardCell({
  label,
  style,
  num = false,
  title = false,
  drop,
  className,
  children,
  ...data
}: {
  label: string
  style?: CSSProperties
  /** Money or a count: bold on the card. */
  num?: boolean
  /** The card's first line: bold. */
  title?: boolean
  /** Leave the cell off the card. Defaults to whether the cell is empty. */
  drop?: boolean
  className?: string
  children?: ReactNode
} & { [attr: `data-${string}`]: string | boolean | undefined }) {
  const dropped = drop ?? cardCellEmpty(children)
  return (
    <td
      role="cell"
      className={className}
      data-label={label}
      data-card-drop={dropped ? '' : undefined}
      data-card-num={num ? '' : undefined}
      data-card-title={title ? '' : undefined}
      style={style}
      {...data}
    >
      <div className="legalCardVal">{children}</div>
    </td>
  )
}
