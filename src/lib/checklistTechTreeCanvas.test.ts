import { describe, expect, it } from 'vitest'
import { clientCoordsForConnectEnd } from './checklistTechTreeCanvas'

describe('clientCoordsForConnectEnd', () => {
  it('reads clientX/Y from a mouse event', () => {
    expect(clientCoordsForConnectEnd({ clientX: 12, clientY: 34 } as MouseEvent)).toEqual({ x: 12, y: 34 })
  })
  it('returns null when the event carries no coordinates', () => {
    expect(clientCoordsForConnectEnd({} as MouseEvent)).toBeNull()
  })
})
