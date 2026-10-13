import { describe, expect, it } from 'vitest'
import { photoDriveName } from './photoName'
import { onSwitches, photoNameInputOf, photoRowOf, senderOf, type PhotoAttachmentRow } from './photoRows'
import { photosToSave } from './photoSave'

// The prototype's Helotes Dental Office (quo-messages-mockup.html drafts 8 and 9, spike/gc-mode): Priya Raman's texted
// photos, and Greg's email with a site photo on the Boerne bid.
const HELOTES = 'a0000000-0000-4000-8000-000000000001'
const BOERNE_BID = 'b0000000-0000-4000-8000-000000000002'

const text: PhotoAttachmentRow = {
  id: 'att-tile',
  sort_order: 0,
  kind: 'file',
  name: 'picture-1.jpg',
  mime: 'image/jpeg',
  bucket_path: 'quo/MS-1/1.jpg',
  drive_file_id: null,
  sent_as: null,
  messages: {
    direction: 'in',
    at: '2026-10-02T19:14:00.000Z',
    bid_id: null,
    project_id: HELOTES,
    jobs_ledger_id: null,
    who_text: 'Priya Raman',
    subject: null,
    body: "Here's the stain above operatory 3, and the old sink cabinet I want gone before you start.",
  },
}

const email: PhotoAttachmentRow = {
  ...text,
  id: 'att-pad',
  sort_order: 1,
  name: 'site-photo-pad.jpg',
  bucket_path: '18f2a/2-site-photo-pad.jpg',
  messages: [
    {
      direction: 'in',
      at: '2026-10-02T15:31:00.000Z',
      bid_id: BOERNE_BID,
      project_id: null,
      jobs_ledger_id: null,
      who_text: 'Greg Paulk <greg@hillside.example> to bids@',
      subject: 'Boerne Retail Pad B sitework, rev 1',
      body: 'Greg here. Attached is our number for the pad.',
    },
  ],
}

describe('the sweep’s rows', () => {
  it('reads who sent it from the line’s who, an email’s and a forward’s too', () => {
    expect(senderOf('Priya Raman')).toBe('Priya Raman')
    expect(senderOf('(830) 555-0172')).toBe('(830) 555-0172')
    expect(senderOf('Greg Paulk <greg@hillside.example> to bids@')).toBe('Greg Paulk')
    expect(senderOf('Greg Paulk <greg@…> · forwarded to bids@ by Rosa')).toBe('Greg Paulk')
    expect(senderOf('greg@hillside.example to bids@')).toBe('greg@hillside.example')
    expect(senderOf('Back to Back Plumbing')).toBe('Back to Back Plumbing')
  })

  it('names a texted photo by the text’s words, and an emailed one by its own name', () => {
    expect(photoDriveName(photoNameInputOf(text)!)).toBe("2026-10-02 Priya Raman · Here's the stain above operatory 3 and the old sink cabinet.jpg")
    expect(photoDriveName(photoNameInputOf({ ...email, name: 'IMG_2041.jpg' })!)).toBe('2026-10-02 Greg Paulk · Boerne Retail Pad B sitework rev 1.jpg')
    expect(photoNameInputOf(email)).toMatchObject({ sender: 'Greg Paulk', fileName: 'site-photo-pad.jpg', place: 2 })
  })

  it('hands photosToSave the line’s way, time and job, whether the read gives the line as one row or a list', () => {
    expect(photoRowOf(text)?.line).toEqual({ direction: 'in', at: '2026-10-02T19:14:00.000Z', bid_id: null, project_id: HELOTES, jobs_ledger_id: null })
    expect(photoRowOf(email)?.line.bid_id).toBe(BOERNE_BID)
    expect(photoRowOf({ ...text, messages: null })).toBeNull()
    expect(photoNameInputOf({ ...text, messages: [] })).toBeNull()
  })

  it('keeps the ticks that are on, and picks the photos on them', () => {
    const ticks = onSwitches([
      { bid_id: null, project_id: HELOTES, jobs_ledger_id: null, on_since: '2026-10-01T15:00:00.000Z' },
      { bid_id: BOERNE_BID, project_id: null, jobs_ledger_id: null, on_since: null },
    ])
    expect(ticks).toHaveLength(1)
    const rows = [text, email].map(photoRowOf).filter((r) => r !== null)
    expect(photosToSave(rows, ticks).map((r) => r.id)).toEqual(['att-tile'])
  })
})
