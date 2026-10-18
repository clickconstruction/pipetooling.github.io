import { describe, expect, it } from 'vitest'
import { moveAsks, moveMoment } from './moveOffer'

describe('moveMoment', () => {
  it('names the moment of a forward move to a stage the customer feels', () => {
    expect(moveMoment('waiting', 'working')).toBe('working')
    expect(moveMoment('working', 'ready_to_bill')).toBe('done')
    expect(moveMoment('ready_to_bill', 'billed')).toBe('billed')
    expect(moveMoment('waiting', 'billed')).toBe('billed')
  })

  it('asks nothing for a move back, a move to Waiting or Paid, or a status it does not know', () => {
    expect(moveMoment('billed', 'ready_to_bill')).toBeNull()
    expect(moveMoment('working', 'working')).toBeNull()
    expect(moveMoment('working', 'waiting')).toBeNull()
    expect(moveMoment('billed', 'paid')).toBeNull()
    expect(moveMoment('working', 'archived')).toBeNull()
  })

  it('treats an unknown status before the move as a forward move', () => {
    expect(moveMoment(null, 'working')).toBe('working')
    expect(moveMoment('something else', 'ready_to_bill')).toBe('done')
  })
})

describe('moveAsks', () => {
  it('asks while the residential step is Offers or Sends, and never while it is Off', () => {
    expect(moveAsks({ residential: { done: 'offer' } }, 'done')).toBe(true)
    expect(moveAsks({ residential: { done: true } }, 'done')).toBe(true)
    expect(moveAsks({ residential: { done: 'offer' } }, 'working')).toBe(false)
    expect(moveAsks({ customer: { done: 'offer' } }, 'done')).toBe(false)
    expect(moveAsks({}, 'billed')).toBe(false)
  })
})
