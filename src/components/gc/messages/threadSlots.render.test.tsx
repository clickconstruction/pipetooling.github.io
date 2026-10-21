// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mergeThreadSlots, type ThreadSlots } from './threadSlots'
import { DEMO_CONTACTS, DEMO_MESSAGES } from '../../../lib/messages/messagesDemo'

const person = DEMO_CONTACTS[0]!
const line = DEMO_MESSAGES[0]!

describe('mergeThreadSlots: cuts that fill the same slot', () => {
  it('a key two cuts fill draws both, the first cut\'s first; one cut\'s comes back as it is', () => {
    const followUp: ThreadSlots = { underLine: () => <span>heard day</span>, side: () => <aside>flow</aside> }
    const changeOrders: ThreadSlots = { underLine: () => <span>became CO 2</span> }
    const merged = mergeThreadSlots(followUp, changeOrders)
    render(<div data-testid="under">{merged.underLine?.(line, person)}</div>)
    expect(screen.getByTestId('under').textContent).toBe('heard daybecame CO 2')
    expect(merged.side).toBe(followUp.side)
    expect(merged.box).toBeUndefined()
  })

  it('the message window\'s first tool draws each cut\'s, given the selection', () => {
    const merged = mergeThreadSlots(
      { messageWindowFirst: (_m, sel) => <button type="button">{sel ? 'Highlight' : 'Remove'}</button> },
      { messageWindowFirst: () => <button type="button">Start a change order</button> },
    )
    render(<div>{merged.messageWindowFirst?.(line, 'the pond')}</div>)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Highlight', 'Start a change order'])
  })

  it('cut 2’s facts about whose move it is merge field by field, the later cut winning (punch list #140 PR 7)', () => {
    const merged = mergeThreadSlots(
      { court: () => ({ owed: { what: 'the quote' }, promisedUntil: 'until Wed · quote' }) },
      { court: () => null },
      { court: () => ({ promisedUntil: 'until Fri · their word' }) },
    )
    expect(merged.court?.(person)).toEqual({ owed: { what: 'the quote' }, promisedUntil: 'until Fri · their word' })
    expect(mergeThreadSlots({ court: () => null }).court?.(person)).toBeNull()
    expect(mergeThreadSlots({}).court).toBeUndefined()
  })

  it('a slot where every cut draws nothing draws nothing', () => {
    const merged = mergeThreadSlots({ aboveBox: () => null }, { aboveBox: () => false }, { aboveBox: () => undefined })
    expect(merged.aboveBox?.(person)).toBeNull()
  })

  it('⋯\'s rows join in order', () => {
    const press = vi.fn()
    const merged = mergeThreadSlots(
      { menuRows: () => [{ key: 'no-reply', label: 'No reply needed', onPress: press }] },
      {},
      { menuRows: () => [{ key: 'stop', label: 'Mark STOP', onPress: press }] },
    )
    expect(merged.menuRows?.(person).map((r) => r.key)).toEqual(['no-reply', 'stop'])
  })

  it('a line\'s body is the first cut\'s that gives one, else none', () => {
    const merged = mergeThreadSlots({ lineBody: () => null }, { lineBody: () => <mark>pond</mark> }, { lineBody: () => <b>later</b> })
    render(<div data-testid="body">{merged.lineBody?.(line, person)}</div>)
    expect(screen.getByTestId('body').textContent).toBe('pond')
    expect(mergeThreadSlots({ lineBody: () => null }).lineBody?.(line, person)).toBeNull()
  })

  it('no cuts, no slots', () => {
    expect(mergeThreadSlots()).toEqual({})
  })
})
