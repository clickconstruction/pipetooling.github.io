// @vitest-environment jsdom
/**
 * `moneyText` finds the element `getByText` found before a screen moved to the door (v2.8376): the one that
 * holds the words, with each amount inside it read as the plain text it was.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Money, MoneyText } from '../components/Money'
import { moneyText } from './moneyText'

describe('moneyText', () => {
  it('finds the cell that holds an amount, where the plain matcher finds nothing', () => {
    render(
      <table>
        <tbody>
          <tr>
            <td data-testid="cell">
              <Money amount={1250} />
            </td>
          </tr>
        </tbody>
      </table>,
    )
    expect(screen.queryByText('$1,250.00')).toBeNull()
    expect(screen.getByText(moneyText('$1,250.00'))).toBe(screen.getByTestId('cell'))
  })

  it('finds words with amounts in them, by text or by pattern, as one element', () => {
    render(
      <p data-testid="line">
        Paid: <Money amount={1250} /> of <Money amount={4000.5} />
      </p>,
    )
    const line = screen.getByTestId('line')
    expect(screen.getByText(moneyText('Paid: $1,250.00 of $4,000.50'))).toBe(line)
    expect(screen.getByText(moneyText(/\$1,250\.00 of/))).toBe(line)
    expect(screen.queryByText(moneyText('$1,250.00'))).toBeNull()
  })

  it('reads words a kernel wrote the same way', () => {
    render(
      <div data-testid="words">
        <MoneyText text="carry $51.03 · by hours $6,692.85" />
      </div>,
    )
    expect(screen.getByText(moneyText('carry $51.03 · by hours $6,692.85'))).toBe(screen.getByTestId('words'))
  })

  it('still finds text that never went through the door', () => {
    render(
      <div>
        <span data-testid="plain">$40.00</span>
        <span data-testid="hours">8.50 h</span>
      </div>,
    )
    expect(screen.getByText(moneyText('$40.00'))).toBe(screen.getByTestId('plain'))
    expect(screen.getByText(moneyText('8.50 h'))).toBe(screen.getByTestId('hours'))
  })

  it('does not count a nested element’s words as the element’s own, as the plain matcher does not', () => {
    render(
      <div data-testid="outer">
        <Money amount={5} /> <span>refund</span>
      </div>,
    )
    expect(screen.getByText(moneyText('$5.00'))).toBe(screen.getByTestId('outer'))
    expect(screen.queryByText(moneyText('$5.00 refund'))).toBeNull()
  })
})
