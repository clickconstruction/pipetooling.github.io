import { describe, expect, it } from 'vitest'
import {
  BID_ROOM_DRAW_HINT,
  BID_ROOM_NAME_HINT,
  bidRoomSignatureError,
  bidRoomSignatureFields,
  type BidRoomSignatureInput,
} from './bidRoomSignature'

const AGREE = 'Please confirm you agree to the proposal and terms above.'
const PNG = 'data:image/png;base64,iVBORw0KGgo='

function input(over: Partial<BidRoomSignatureInput> = {}): BidRoomSignatureInput {
  return { printedName: 'Dana Ruiz', agreed: true, mode: 'type', drawnPng: null, ...over }
}

describe('bidRoomSignatureError (v2.3159)', () => {
  it('asks for the name first, then the agreement, in the surface’s own words', () => {
    expect(bidRoomSignatureError(input({ printedName: '   ' }), AGREE)).toBe(BID_ROOM_NAME_HINT)
    expect(bidRoomSignatureError(input({ agreed: false }), AGREE)).toBe(AGREE)
    expect(bidRoomSignatureError(input({ printedName: '', agreed: false }), AGREE)).toBe(BID_ROOM_NAME_HINT)
  })

  it('a typed signature needs nothing drawn; a drawn one needs the pad filled', () => {
    expect(bidRoomSignatureError(input(), AGREE)).toBeNull()
    expect(bidRoomSignatureError(input({ mode: 'draw' }), AGREE)).toBe(BID_ROOM_DRAW_HINT)
    expect(bidRoomSignatureError(input({ mode: 'draw', drawnPng: PNG }), AGREE)).toBeNull()
  })
})

describe('bidRoomSignatureFields', () => {
  it('sends the trimmed name and agreedTerms for a typed signature — no PNG key at all', () => {
    const fields = bidRoomSignatureFields(input({ printedName: '  Dana Ruiz ' }))
    expect(fields).toEqual({ printedName: 'Dana Ruiz', agreedTerms: true })
    expect('signaturePngBase64' in fields).toBe(false)
  })

  it('adds the PNG for a drawn signature', () => {
    expect(bidRoomSignatureFields(input({ mode: 'draw', drawnPng: PNG }))).toEqual({
      printedName: 'Dana Ruiz',
      agreedTerms: true,
      signaturePngBase64: PNG,
    })
  })

  it('never sends a PNG from a type-mode pad, even if one was drawn earlier', () => {
    expect(bidRoomSignatureFields(input({ mode: 'type', drawnPng: PNG }))).toEqual({ printedName: 'Dana Ruiz', agreedTerms: true })
  })
})
