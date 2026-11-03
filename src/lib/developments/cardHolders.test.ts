import { describe, expect, it } from 'vitest'
import { cardHolderOf, cardIdOf } from './cardHolders'

const A = '0f8a2d6e-1b3c-4d5e-9f00-112233445566'
const look = {
  userIdByCard: new Map([[A, 'u-luis']]),
  nicknameByCard: new Map([[A, 'Luis truck card'], ['7c1e0a2b-3d4f-4a5b-8c6d-778899aabbcc', 'Shop card']]),
  names: new Map([['u-luis', 'Luis'], ['u-blank', '—']]),
}

describe('cardIdOf', () => {
  it('takes the first place that holds a card id, lowercased; anything else is no card', () => {
    expect(cardIdOf(A.toUpperCase(), null)).toBe(A)
    expect(cardIdOf(null, A)).toBe(A)
    expect(cardIdOf('not-a-card', '')).toBeNull()
    expect(cardIdOf(undefined, undefined)).toBeNull()
  })
})

describe('cardHolderOf', () => {
  it('the linked person first, then the nickname, then the short id, then Card', () => {
    expect(cardHolderOf(A, look)).toEqual({ cardId: A, name: 'Luis', userId: 'u-luis' })
    expect(cardHolderOf('7c1e0a2b-3d4f-4a5b-8c6d-778899aabbcc', look)).toEqual({ cardId: '7c1e0a2b-3d4f-4a5b-8c6d-778899aabbcc', name: 'Shop card', userId: null })
    expect(cardHolderOf('9d2f1a3b-4c5d-4e6f-a071-8293a4b5c6d7', look).name).toBe('Card 9d2...6d7')
    expect(cardHolderOf(null, look)).toEqual({ cardId: null, name: 'Card', userId: null })
  })
  it('a payment out of the bank with no card on it is the bank’s; a card charge with no card named stays Card; a card id wins', () => {
    expect(cardHolderOf(null, look, 'outgoingPayment')).toEqual({ cardId: null, name: 'Bank payments', userId: null, bank: true })
    expect(cardHolderOf(null, look, 'wire').name).toBe('Bank payments')
    expect(cardHolderOf(null, look, 'creditCardTransaction')).toEqual({ cardId: null, name: 'Card', userId: null })
    expect(cardHolderOf(null, look, ' ')).toEqual({ cardId: null, name: 'Card', userId: null })
    expect(cardHolderOf(A, look, 'outgoingPayment')).toEqual({ cardId: A, name: 'Luis', userId: 'u-luis' })
  })
  it('a link to a person with no name falls back to the nickname', () => {
    const blank = { ...look, userIdByCard: new Map([[A, 'u-blank']]) }
    expect(cardHolderOf(A, blank)).toEqual({ cardId: A, name: 'Luis truck card', userId: 'u-blank' })
  })
})
