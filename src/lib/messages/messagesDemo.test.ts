import { describe, expect, it } from 'vitest'
import { contactById } from '../contacts/kernel'
import { DEMO_CONTACTS, DEMO_JOBS, DEMO_MESSAGES, DEMO_NOW } from './messagesDemo'

describe('the shared demo data (every cluster’s fixture)', () => {
  it('holds the prototype’s eight people, six jobs and twenty messages at its clock', () => {
    expect(DEMO_NOW).toBe('2026-10-02T16:45:00.000Z')
    expect(DEMO_CONTACTS.map((c) => c.id)).toEqual(['greg', 'elena', 'priya', 'bill', 'tom', 'jonah', 'marcus', 'unk1'])
    expect(DEMO_JOBS.map((j) => j.id)).toEqual(['boerne', 'padb', 'stoneoak', 'helotes', 'fairoaks', 'bell'])
    expect(DEMO_MESSAGES.map((m) => m.id)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)))
  })

  it('every message is on a person it can be on: its contact, its channel, its job', () => {
    for (const m of DEMO_MESSAGES) {
      const c = contactById(DEMO_CONTACTS, m.contactId)
      expect(c, m.id).toBeDefined()
      if (m.channelId) expect(c!.channels.map((ch) => ch.id), m.id).toContain(m.channelId)
      else expect(['note', 'event'], m.id).toContain(m.channel)
      if (m.jobId) expect(c!.jobIds, m.id).toContain(m.jobId)
    }
  })

  it('every person points at one made-up record, the unknown number at none', () => {
    for (const c of DEMO_CONTACTS) {
      expect(c.record === null, c.id).toBe(c.kind === 'unknown')
      if (c.defaultJobId) expect(c.jobIds, c.id).toContain(c.defaultJobId)
      for (const j of c.jobIds) expect(DEMO_JOBS.map((x) => x.id), c.id).toContain(j)
    }
  })

  it('every number and address is made up: 555-01xx numbers and .example addresses', () => {
    for (const ch of DEMO_CONTACTS.flatMap((c) => c.channels)) {
      if (ch.kind === 'phone') expect(ch.value, ch.id).toMatch(/555-01\d\d$/)
      else expect(ch.value, ch.id).toMatch(/\.example$/)
    }
  })
})
