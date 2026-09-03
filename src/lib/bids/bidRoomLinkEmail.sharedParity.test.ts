import { describe, expect, it } from 'vitest'
import { buildBidRoomLinkEmail as appBuild } from './bidRoomLinkEmail'
import { buildBidRoomLinkEmail as sharedBuild } from '../../../supabase/functions/_shared/bidRoomLinkEmail'
import { BID_ROOM_LINK_EMAIL_SAMPLE_PAYLOAD, buildBidRoomLinkEmailPreview } from './bidRoomLinkEmailPreview'

/** The app twin must produce byte-identical output to the Edge builder (v2.2732). */
describe('bidRoomLinkEmail app twin ≡ _shared', () => {
  const sender = { name: 'Wendi Douglas', email: 'wendi@clickplumbing.com', phone: '(512) 555-0142' }
  const cases = [
    { label: 'rev 1 with sender', revNumber: 1, revNote: null, sender, brandImageUrl: 'https://clicktooling.com/brand/click-plum.png' },
    { label: 'rev 2 with note', revNumber: 2, revNote: 'per addendum <2>', sender, brandImageUrl: 'https://clicktooling.com/brand/click-plum.png' },
    { label: 'no sender, no banner', revNumber: 1, revNote: null, sender: null, brandImageUrl: '' },
  ]
  it.each(cases)('$label', ({ revNumber, revNote, sender, brandImageUrl }) => {
    const input = { payload: BID_ROOM_LINK_EMAIL_SAMPLE_PAYLOAD, link: 'https://clicktooling.com/bid-room?t=x&y="z"', brandImageUrl, revNumber, revNote, sender, dateLabel: 'Sept 3, 2026' }
    const a = appBuild(input)
    const s = sharedBuild(input)
    expect(a.subject).toBe(s.subject)
    expect(a.text).toBe(s.text)
    expect(a.html).toBe(s.html)
    expect(a.replyTo).toBe(s.replyTo)
  })
  it('the settings preview renders the sample with the viewer as sender', () => {
    const p = buildBidRoomLinkEmailPreview({ origin: 'https://clicktooling.com/', sender })
    expect(p.subject).toBe('Plumbing proposal — Hunter Road Sound Studio — $56,343 · Click Plumbing')
    expect(p.html).toContain('https://clicktooling.com/brand/click-plum.png')
    expect(p.html).toContain('Wendi Douglas')
    expect(buildBidRoomLinkEmailPreview({ origin: 'https://clicktooling.com', sender: null, revised: true }).subject).toContain('(rev 2)')
  })
})
