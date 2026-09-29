import { describe, expect, it } from 'vitest'
import { effectiveWindowWay, LINK_NEEDS, windowStatusPill, windowWayButton, windowWaysPlan, windowWaySentence } from './contractWindowWays'

const stamp = (iso: string) => iso.slice(5, 10)

describe('contractWindowWays — the plan', () => {
  it('a customer with an email opens on Send a link; without one on paper; a builder on their subcontract', () => {
    expect(windowWaysPlan({ emailOk: true, phoneOk: false, gcJob: false }).defaultWay).toBe('link')
    expect(windowWaysPlan({ emailOk: false, phoneOk: true, gcJob: false }).defaultWay).toBe('link')
    const none = windowWaysPlan({ emailOk: false, phoneOk: false, gcJob: false })
    expect(none.defaultWay).toBe('paper')
    expect(none.ways.find((w) => w.way === 'link')?.disabledReason).toBe(LINK_NEEDS)
    const gc = windowWaysPlan({ emailOk: true, phoneOk: false, gcJob: true, gcName: 'Summit GC' })
    expect(gc.defaultWay).toBe('file_theirs')
    expect(gc.ways.map((w) => w.label)).toEqual(["File Summit GC's subcontract"])
    expect(gc.demoted.map((w) => w.way)).toEqual(['link', 'here', 'paper'])
  })
  it('a pick that cannot run falls back to the default, then to any way that can', () => {
    const none = windowWaysPlan({ emailOk: false, phoneOk: false, gcJob: false })
    expect(effectiveWindowWay(none, 'link')).toBe('paper')
    expect(effectiveWindowWay(none, 'here')).toBe('here')
    const ok = windowWaysPlan({ emailOk: true, phoneOk: false, gcJob: false })
    expect(effectiveWindowWay(ok, null)).toBe('link')
    expect(effectiveWindowWay(ok, 'paper')).toBe('paper')
  })
})

describe('contractWindowWays — the sentence and the button', () => {
  const base = { recipientName: 'Sam Sample', email: 'sam@example.com', phone: '', textToo: false, remindersEnabled: true, fromAddress: 'office@clickplumbing.com', paperSend: 'download' as const }
  it('a link: to whom, from where, with what reminders; by text when there is only a mobile; nothing without either', () => {
    expect(windowWaySentence({ ...base, way: 'link' })).toBe('Emails sam@example.com a Review & sign link from office@clickplumbing.com. Reminders every 3 days until signed, up to 3.')
    expect(windowWaySentence({ ...base, way: 'link', remindersEnabled: false })).toContain('No reminders.')
    expect(windowWaySentence({ ...base, way: 'link', phone: '512-555-0100', textToo: true })).toContain('opens a text to 512-555-0100')
    expect(windowWaySentence({ ...base, way: 'link', email: '', phone: '512-555-0100' })).toBe('Opens a text to 512-555-0100 with the Review & sign link. Add an email for reminders and their signed copy.')
    expect(windowWaySentence({ ...base, way: 'link', email: '' })).toBe('Add an email or a mobile to send a link.')
    expect(windowWayButton({ way: 'link', paperSend: 'download', email: '', phone: '', textToo: false })).toEqual({ label: 'Send the link', busyLabel: 'Sending…', disabled: true })
    expect(windowWayButton({ way: 'link', paperSend: 'download', email: '', phone: '512', textToo: false }).label).toBe('Text the link')
    expect(windowWayButton({ way: 'link', paperSend: 'download', email: 'a@b.co', phone: '512', textToo: true }).label).toBe('Send the link by email and text')
  })
  it('here: the device, and where the copy goes; paper: the hand-off or the PDF email', () => {
    expect(windowWaySentence({ ...base, way: 'here' })).toBe('Opens the signing page on this device for Sam Sample to read and sign. Their signed copy goes to sam@example.com.')
    expect(windowWaySentence({ ...base, way: 'here', email: '' })).toContain('Add an email if they want a signed copy sent.')
    expect(windowWaySentence({ ...base, way: 'paper' })).toContain('marks the agreement handed over today')
    expect(windowWaySentence({ ...base, way: 'paper', paperSend: 'pdf_email' })).toContain('Emails sam@example.com the agreement as a PDF')
    expect(windowWayButton({ way: 'paper', paperSend: 'pdf_email', email: '', phone: '', textToo: false }).disabled).toBe(true)
    expect(windowWayButton({ way: 'paper', paperSend: 'download', email: '', phone: '', textToo: false })).toEqual({ label: 'Download & mark handed over', busyLabel: 'Building…', disabled: false })
    expect(windowWayButton({ way: 'file_theirs', paperSend: 'download', email: '', phone: '', textToo: false }).label).toBe('File their subcontract')
  })
})

describe('contractWindowWays — the header pill', () => {
  const base = { status: null, channel: 'link' as const, sentAt: null, viewCount: 0, signedAt: null, signerName: null, signedOnFile: false, notNeeded: false, draftSaved: false, stamp }
  it('says where the agreement stands in the chip’s words', () => {
    expect(windowStatusPill(base)).toEqual({ text: 'Draft · nothing sent yet', tone: 'gray' })
    expect(windowStatusPill({ ...base, status: 'draft', draftSaved: true }).text).toBe('Draft · saved, nothing sent yet')
    expect(windowStatusPill({ ...base, status: 'sent', sentAt: '2026-09-12T15:00:00Z', viewCount: 2 })).toEqual({ text: 'Sent 09-12 · opened 2×', tone: 'amber' })
    expect(windowStatusPill({ ...base, status: 'sent', sentAt: '2026-09-12T15:00:00Z', channel: 'pdf_email' }).text).toBe('PDF emailed 09-12 · not opened yet')
    expect(windowStatusPill({ ...base, status: 'signed', signedAt: '2026-09-12T15:00:00Z', signerName: 'Sam' })).toEqual({ text: '✍ Signed 09-12 · Sam', tone: 'green' })
    expect(windowStatusPill({ ...base, status: 'signed', signedAt: '2026-09-12T15:00:00Z', signerName: 'Sam', signedVerb: 'Accepted' }).text).toBe('✍ Accepted 09-12 · Sam')
    expect(windowStatusPill({ ...base, status: 'sent', sentAt: '2026-09-12T15:00:00Z', channel: 'handed' })).toEqual({ text: 'Handed over 09-12 · awaiting the signed page', tone: 'amber' })
    expect(windowStatusPill({ ...base, status: 'signed', signedAt: '2026-09-14T15:00:00Z', signerName: 'Sam Sample' })).toEqual({ text: '✍ Signed 09-14 · Sam Sample', tone: 'green' })
    expect(windowStatusPill({ ...base, notNeeded: true }).tone).toBe('gray')
    expect(windowStatusPill({ ...base, signedOnFile: true }).tone).toBe('green')
  })
})
