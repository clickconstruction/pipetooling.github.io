import { describe, expect, it } from 'vitest'
import { contactById } from '../contacts/kernel'
import { contactsFromRows } from '../contacts/load'
import { jobKey, jobKeyOfRow, jobRefOf, threadMessageFromRow, threadMessagesFromRows, type MessageRow } from './load'
import { DEMO_NOW } from './messagesDemo'
import { SPINE_CHANNELS, SPINE_CONTACTS, SPINE_JOBS, SPINE_MESSAGES, SPINE_RECORDS, SPINE_USER_NAMES } from './spineRows'
import { stampSentence } from './stamps'
import { courtOf, threadOf, threadRows } from './thread'

const contacts = contactsFromRows(SPINE_CONTACTS, SPINE_CHANNELS, SPINE_JOBS, SPINE_RECORDS)
const ctx = { userNames: SPINE_USER_NAMES, contacts }
const lines = threadMessagesFromRows(SPINE_MESSAGES, ctx)
const row = (id: string): MessageRow => SPINE_MESSAGES.find((r) => r.id === id)!
const line = (id: string) => lines.find((m) => m.id === id)!

describe('a job as one key', () => {
  it('names a bid, a GC project and a Pipeline job, and reads back to what the functions take', () => {
    expect(jobKey({ kind: 'project', id: 'proj-stoneoak' })).toBe('project:proj-stoneoak')
    expect(jobRefOf('pipeline:jl-fairoaks')).toEqual({ kind: 'pipeline', id: 'jl-fairoaks' })
    expect(jobRefOf(jobKey({ kind: 'bid', id: 'a:b' }))).toEqual({ kind: 'bid', id: 'a:b' })
    for (const bad of ['boerne', 'ticket:1', 'bid:', ':x', '', null, undefined]) expect(jobRefOf(bad)).toBeNull()
  })

  it('a row’s job is the one of its three columns that is set', () => {
    expect(jobKeyOfRow({ bid_id: 'b1', project_id: null, jobs_ledger_id: null })).toBe('bid:b1')
    expect(jobKeyOfRow({ bid_id: null, project_id: null, jobs_ledger_id: 'j1' })).toBe('pipeline:j1')
    expect(jobKeyOfRow({ bid_id: null, project_id: null, jobs_ledger_id: null })).toBeNull()
  })
})

describe('the lines as the screens load them (rows shaped like the first lines)', () => {
  it('reads who from the row’s own words, else the user, else what we call them, else their number', () => {
    expect(line('m-greg-text-out').who).toBe('Robert · from the company number')
    expect(line('m-elena-email-out').who).toBe('Rosa')
    expect(line('m-greg-text-in').who).toBe('Greg')
    expect(line('m-sam-text').who).toBe('Sammy')
    expect(line('m-unknown-text').who).toBe('(830) 555-0199')
    // Without the contacts, a line from them names nobody.
    expect(threadMessageFromRow(row('m-greg-text-in'))!.who).toBe('')
  })

  it('carries the channel it came by, its job as a key, a call’s seconds and the opt-out line', () => {
    expect(line('m-greg-text-out')).toMatchObject({ channelId: 'ch-greg-phone', jobId: 'bid:bid-boerne', optoutLine: 'first', durationSeconds: null })
    expect(line('m-elena-call')).toMatchObject({ channel: 'call', jobId: 'project:proj-stoneoak', durationSeconds: 362 })
    expect(line('m-elena-email-out').jobId).toBe('pipeline:jl-fairoaks')
    expect(line('m-unknown-text').jobId).toBeNull()
  })

  it('reads a note’s day to come back and who set it, by name', () => {
    expect(line('m-elena-note')).toMatchObject({ channel: 'note', direction: 'team', who: 'Rosa', backOn: '2026-10-02', backBy: 'Rosa' })
    expect(threadMessageFromRow(row('m-elena-note'))!.backBy).toBeNull()
  })

  it('leaves out a channel this build does not know, reads an unknown opt-out as none, and sorts oldest first', () => {
    expect(lines.map((m) => m.id)).not.toContain('m-greg-fax')
    expect(line('m-greg-odd-optout').optoutLine).toBeNull()
    expect(lines).toHaveLength(SPINE_MESSAGES.length - 1)
    expect(lines.every((m, i) => i === 0 || Date.parse(lines[i - 1]!.at) <= Date.parse(m.at))).toBe(true)
  })
})

describe('the loaded lines under the kernels', () => {
  it('draw Greg’s thread with its days and the job named once a day', () => {
    const rows = threadRows(threadOf(lines, 'c-greg'), DEMO_NOW).map((r) =>
      r.kind === 'day' ? `— ${r.label}` : r.kind === 'event' ? `event ${r.message.id}` : `${r.message.id} ${r.job}`,
    )
    expect(rows).toEqual(['— Wednesday, Sep 30', 'm-greg-text-out full', '— Thursday, Oct 1', 'm-greg-odd-optout none', '— Today, Fri Oct 2', 'm-greg-text-in full', 'm-greg-email-in number'])
  })

  it('read whose move it is and the stamps as the prototype’s header does', () => {
    expect(courtOf(lines, 'c-greg', DEMO_NOW).word).toBe('Our move · 15 min')
    expect(stampSentence(contactById(contacts, 'c-greg')!, lines, 'c-greg', DEMO_NOW).text).toBe('Greg emailed today at 11:30 AM. We texted yesterday.')
    expect(stampSentence(contactById(contacts, 'c-unknown')!, lines, 'c-unknown', DEMO_NOW).text).toBe('They texted today at 9:12 AM. We have not written yet.')
    expect(stampSentence(contactById(contacts, 'c-elena')!, lines, 'c-elena', DEMO_NOW).text).toBe('Elena called today at 10:05 AM, no voicemail. We emailed yesterday.')
  })
})
