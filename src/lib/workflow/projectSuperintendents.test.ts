import { describe, expect, it } from 'vitest'
import {
  superintendentChipLabel,
  superintendentOptionLabel,
  unassignedSuperintendents,
} from './projectSuperintendents'

const sam = { id: 'u1', name: 'Sam Ortiz', email: 'sam@example.test' }
const emailOnly = { id: 'u2', name: null, email: 'lee@example.test' }
const bare = { id: 'u3', name: null, email: null }
const blankName = { id: 'u4', name: '', email: 'kim@example.test' }

describe('superintendentChipLabel', () => {
  it('is the name, else the email, else Unknown', () => {
    expect(superintendentChipLabel(sam)).toBe('Sam Ortiz')
    expect(superintendentChipLabel(emailOnly)).toBe('lee@example.test')
    expect(superintendentChipLabel(bare)).toBe('Unknown')
  })

  it('reads a blank name as no name', () => {
    expect(superintendentChipLabel(blankName)).toBe('kim@example.test')
  })
})

describe('superintendentOptionLabel', () => {
  it('is the name, else the email, else the id', () => {
    expect(superintendentOptionLabel(sam)).toBe('Sam Ortiz')
    expect(superintendentOptionLabel(emailOnly)).toBe('lee@example.test')
    expect(superintendentOptionLabel(bare)).toBe('u3')
  })
})

describe('unassignedSuperintendents', () => {
  it('leaves out the ones already on the project and keeps the order', () => {
    expect(unassignedSuperintendents([sam, emailOnly, bare], [emailOnly])).toEqual([sam, bare])
  })

  it('is everyone when nobody is assigned, and nobody when everyone is', () => {
    expect(unassignedSuperintendents([sam, bare], [])).toEqual([sam, bare])
    expect(unassignedSuperintendents([sam, bare], [bare, sam])).toEqual([])
  })

  it('matches by id, not by name', () => {
    expect(unassignedSuperintendents([sam], [{ ...sam, id: 'other' }])).toEqual([sam])
  })

  it('ignores an assigned superintendent who is not in the list — archived since', () => {
    expect(unassignedSuperintendents([sam], [{ id: 'gone', name: 'Old Hand', email: null }])).toEqual([sam])
  })
})
