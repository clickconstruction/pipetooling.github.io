import { describe, expect, it } from 'vitest'
import { spineMessagesView } from '../messages/spineRows'
import { contactOfLine, jobsOfAddress, pickedJob } from './picker'

describe('jobsOfAddress: their jobs first in the picker', () => {
  it('lists the rail of whoever holds the address, read case-blind, each job once', () => {
    const view = spineMessagesView()
    const greg = view.contacts.find((c) => c.id === 'c-greg')!
    const rail = view.rails['c-greg'] ?? []
    expect(rail.length).toBeGreaterThan(0)
    const keys = jobsOfAddress(view, ' GREG@Hillside.example ').map((t) => t.key)
    expect(keys).toEqual(rail.filter((k) => view.tiles[k]))
    expect(greg.channels.some((ch) => ch.value === 'greg@hillside.example')).toBe(true)
  })

  it('lists nothing for an address nobody holds, an empty one, or before the view is read', () => {
    const view = spineMessagesView()
    expect(jobsOfAddress(view, 'nobody@nowhere.example')).toEqual([])
    expect(jobsOfAddress(view, '  ')).toEqual([])
    expect(jobsOfAddress(null, 'greg@hillside.example')).toEqual([])
  })

  it('keeps one job once when two people at the address share it', () => {
    const view = spineMessagesView()
    const greg = view.contacts.find((c) => c.id === 'c-greg')!
    const twin = { ...greg, id: 'c-greg-2' }
    const both = { ...view, contacts: [...view.contacts, twin], rails: { ...view.rails, 'c-greg-2': view.rails['c-greg'] ?? [] } }
    expect(jobsOfAddress(both, 'greg@hillside.example')).toEqual(jobsOfAddress(view, 'greg@hillside.example'))
  })
})

describe('contactOfLine', () => {
  it('finds the person a line sits on, or none', () => {
    const view = spineMessagesView()
    const line = view.messages[0]!
    expect(contactOfLine(view, line.id)).toBe(line.contactId)
    expect(contactOfLine(view, 'no-such-line')).toBeNull()
    expect(contactOfLine(null, line.id)).toBeNull()
  })
})

describe('pickedJob: what a pick tags the conversation onto', () => {
  it('tags the job picked, a bid, a GC project or a Pipeline job', () => {
    expect(pickedJob('pipeline:job-harbor')).toEqual({ kind: 'pipeline', id: 'job-harbor' })
    expect(pickedJob('bid:bid-cedar', 'pipeline:job-elm')).toEqual({ kind: 'bid', id: 'bid-cedar' })
  })

  it('does nothing for the job the conversation is on already, or a key that names no job', () => {
    expect(pickedJob('pipeline:job-elm', 'pipeline:job-elm')).toBeNull()
    expect(pickedJob(null)).toBeNull()
    expect(pickedJob('nonsense')).toBeNull()
  })
})
