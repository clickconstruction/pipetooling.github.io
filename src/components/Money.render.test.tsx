// @vitest-environment jsdom
/**
 * Render smokes for the app's one door for an amount on a screen (v2.8374): the cents in a smaller span at the
 * one ratio, the whole figure still in the text, and the forms a screen needs (a loss, a signed figure, whole
 * dollars, a bare figure, a missing one, words a kernel wrote, an SVG label).
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Money, MoneyText, MoneyTspans } from './Money'
import { MONEY_CENTS_EM } from '../lib/moneyParts'
import { AmountSmallCents, SignedAmountSmallCents } from './AmountSmallCents'
import { MoneyStringWithSmallCents, MoneyWithSmallCents } from './jobs/MoneySmallCents'
import { Money as ChargesMoney } from './charges/Money'
import { WorkedOutValue } from './valuesInPlace/ValuesInPlace'

const SIZE = `${MONEY_CENTS_EM}em`
const cents = (el: Element) => [...el.querySelectorAll('[data-cents]')].map((c) => c.textContent)

describe('Money', () => {
  it('draws the cents smaller, at the one ratio, and keeps the whole figure in the text', () => {
    const { container } = render(<Money amount={48700.5} />)
    expect(container.textContent).toBe('$48,700.50')
    const small = container.querySelector<HTMLElement>('[data-cents]')
    expect(small?.textContent).toBe('.50')
    expect(small?.style.fontSize).toBe(SIZE)
    // The size follows the text around it: never a pixel or a rem size, and never the font shorthand.
    expect(small?.getAttribute('style')).not.toMatch(/px|rem|font:/)
  })

  it('a press with an amount in its name is still found by that name', () => {
    const { getByRole } = render(
      <button type="button">
        Keep <Money amount={24} />
      </button>,
    )
    // Without `display: inline` said on the spans, the test DOM reads the name as "Keep $24 .00".
    expect(getByRole('button', { name: 'Keep $24.00' })).toBeTruthy()
  })

  it('never breaks between the dollars and the cents', () => {
    const { container } = render(<Money amount={12} />)
    expect((container.firstElementChild as HTMLElement).style.whiteSpace).toBe('nowrap')
  })

  it('a loss wears a true minus before the dollar sign, and zero wears none', () => {
    expect(render(<Money amount={-1234.5} />).container.textContent).toBe('−$1,234.50')
    expect(render(<Money amount={0} />).container.textContent).toBe('$0.00')
    expect(render(<Money amount={-0.001} />).container.textContent).toBe('$0.00')
  })

  it('a signed figure says which way it went', () => {
    expect(render(<Money amount={166.21} sign="both" />).container.textContent).toBe('+$166.21')
    expect(render(<Money amount={-83.79} sign="both" />).container.textContent).toBe('−$83.79')
  })

  it('whole dollars draw no cents span at all', () => {
    const { container } = render(<Money amount={48700.5} cents={false} />)
    expect(container.textContent).toBe('$48,701')
    expect(cents(container)).toEqual([])
  })

  it('a bare figure drops the dollar sign, and a missing one is a dash or the screen’s own word', () => {
    expect(render(<Money amount={39796.7} symbol="" />).container.textContent).toBe('39,796.70')
    expect(render(<Money amount={null} />).container.textContent).toBe('—')
    expect(render(<Money amount={undefined} empty="not priced" />).container.textContent).toBe('not priced')
  })
})

describe('MoneyText', () => {
  it('shrinks the cents of every amount in words a kernel wrote, and leaves the words alone', () => {
    const text = 'Overhead to date: $7,209.88 · by hours $6,692.85 · carry $517.03'
    const { container } = render(<MoneyText text={text} />)
    expect(container.textContent).toBe(text)
    expect(cents(container)).toEqual(['.88', '.85', '.03'])
  })

  it('words with no amount draw as they are, with no span', () => {
    const { container } = render(<MoneyText text="8.50 h on site, 12.50% done" />)
    expect(container.textContent).toBe('8.50 h on site, 12.50% done')
    expect(container.querySelector('span')).toBeNull()
  })

  it('a money column’s cell reads a bare figure, and passes a dash through', () => {
    expect(cents(render(<MoneyText text="14,115.35" bare />).container)).toEqual(['.35'])
    expect(render(<MoneyText text="—" bare />).container.innerHTML).toBe('—')
    expect(cents(render(<MoneyText text="14,115.35" />).container)).toEqual([])
  })
})

describe('MoneyTspans', () => {
  it('draws a chart label’s cents in a smaller tspan, the label’s text unchanged', () => {
    const { container } = render(
      <svg>
        <text data-testid="label">
          <MoneyTspans text="$1,820.40 true cost" />
        </text>
      </svg>,
    )
    const label = container.querySelector('text')
    expect(label?.textContent).toBe('$1,820.40 true cost')
    const small = label?.querySelector('tspan[data-cents]')
    expect(small?.textContent).toBe('.40')
    expect(small?.getAttribute('font-size')).toBe(SIZE)
  })
})

describe('the older names draw through the door', () => {
  it('AmountSmallCents and SignedAmountSmallCents', () => {
    const { container } = render(<AmountSmallCents value={48700} />)
    expect(container.textContent).toBe('$48,700.00')
    expect(container.querySelector<HTMLElement>('[data-cents]')?.style.fontSize).toBe(SIZE)
    expect(render(<AmountSmallCents value={12.5} prefix="" />).container.textContent).toBe('12.50')
    expect(render(<SignedAmountSmallCents value={-1234.5} />).container.textContent).toBe('−$1,234.50')
    expect(render(<SignedAmountSmallCents value={null} />).container.textContent).toBe('—')
    expect(render(<SignedAmountSmallCents value={undefined} />).container.textContent).toBe('—')
    expect(render(<SignedAmountSmallCents value={0} />).container.textContent).toBe('$0.00')
  })

  it('the job form’s bare figure and its formatted string', () => {
    const { container } = render(<MoneyWithSmallCents value={39796.7} />)
    expect(container.textContent).toBe('39,796.70')
    expect(container.querySelector<HTMLElement>('[data-cents]')?.style.fontSize).toBe(SIZE)
    expect(cents(render(<MoneyStringWithSmallCents text="14,115.35" />).container)).toEqual(['.35'])
    expect(render(<MoneyStringWithSmallCents text="…" />).container.textContent).toBe('…')
  })

  it('the charges figure, with the whole figure as its label', () => {
    const { container } = render(<ChargesMoney amount={6748.85} data-testid="charged" />)
    const el = container.querySelector('[data-testid="charged"]')
    expect(el?.getAttribute('aria-label')).toBe('$6,748.85')
    expect(el?.querySelector<HTMLElement>('[data-cents]')?.style.fontSize).toBe(SIZE)
  })
})

describe('Values in place', () => {
  it('a worked-out amount handed in as words gets small cents by the same door', () => {
    const { container } = render(<WorkedOutValue>$1,250.00</WorkedOutValue>)
    expect(container.textContent).toBe('$1,250.00')
    expect(container.querySelector<HTMLElement>('[data-cents]')?.style.fontSize).toBe(SIZE)
  })

  it('a worked-out value that is not money draws as it did', () => {
    const { container } = render(<WorkedOutValue>Sat Nov 21</WorkedOutValue>)
    expect(container.querySelector('b')?.innerHTML).toBe('Sat Nov 21')
  })
})
