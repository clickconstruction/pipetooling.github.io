import { describe, expect, it } from 'vitest'
import { NEED_EMAIL_TITLE, bidRoomPanelActions, looksLikeEmail } from './bidRoomPanelActions'

const base = { hasRoom: false, published: false, everSent: false, hasEmail: false, answered: false }

describe('bidRoomPanelActions', () => {
  it('no room yet: "Get the link" is the primary; Send to GC waits for an email; no link controls', () => {
    const a = bidRoomPanelActions(base)
    expect(a.primary).toMatchObject({ id: 'get_link', label: 'Get the link' })
    expect(a.send).toMatchObject({ id: 'publish_and_send', label: 'Send to GC', enabled: false, title: NEED_EMAIL_TITLE })
    expect(a.showLink).toBe(false)
    expect(a.closeRoom).toBe(false)
  })

  it('no room, email typed: Send to GC is live and says it publishes + emails', () => {
    const a = bidRoomPanelActions({ ...base, hasEmail: true })
    expect(a.primary?.id).toBe('get_link')
    expect(a.send).toMatchObject({ id: 'publish_and_send', enabled: true })
    expect(a.send?.title).toMatch(/Publish rev 1 and email/)
  })

  it('room row without a revision (a failed first publish): still "Get the link", but Close room is offered', () => {
    const a = bidRoomPanelActions({ ...base, hasRoom: true })
    expect(a.primary?.id).toBe('get_link')
    expect(a.showLink).toBe(false)
    expect(a.closeRoom).toBe(true)
  })

  it('published, never sent: Copy link / Open appear BEFORE any send; primary is Publish update; Send to GC sends the existing link', () => {
    const a = bidRoomPanelActions({ ...base, hasRoom: true, published: true })
    expect(a.showLink).toBe(true)
    expect(a.primary).toMatchObject({ id: 'publish_update', label: 'Publish update' })
    expect(a.send).toMatchObject({ id: 'send_only', label: 'Send to GC', enabled: false })
    expect(a.closeRoom).toBe(true)
  })

  it('published and sent: the send action reads "Email link again"', () => {
    const a = bidRoomPanelActions({ ...base, hasRoom: true, published: true, everSent: true, hasEmail: true })
    expect(a.send).toMatchObject({ id: 'send_only', label: 'Email link again', enabled: true })
    expect(a.send?.title).toMatch(/without publishing/)
  })

  it('published, not sent, email typed: the send title promises the sent-stamp (first send only)', () => {
    const a = bidRoomPanelActions({ ...base, hasRoom: true, published: true, hasEmail: true })
    expect(a.send?.title).toMatch(/stamps the packet sent/)
  })

  it('answered (signed or declined): no publish or send actions, the link stays copyable, no Close room', () => {
    const a = bidRoomPanelActions({ ...base, hasRoom: true, published: true, everSent: true, hasEmail: true, answered: true })
    expect(a.primary).toBeNull()
    expect(a.send).toBeNull()
    expect(a.showLink).toBe(true)
    expect(a.closeRoom).toBe(false)
  })

  it('full matrix: exactly one primary while unanswered; showLink tracks published and nothing else', () => {
    for (const hasRoom of [false, true])
      for (const published of [false, true])
        for (const everSent of [false, true])
          for (const hasEmail of [false, true])
            for (const answered of [false, true]) {
              if (published && !hasRoom) continue
              const a = bidRoomPanelActions({ hasRoom, published, everSent, hasEmail, answered })
              expect(a.showLink).toBe(published)
              expect(a.primary == null).toBe(answered)
              expect(a.send == null).toBe(answered)
              if (a.send) expect(a.send.enabled).toBe(hasEmail)
            }
  })
})

describe('looksLikeEmail', () => {
  it('accepts a plain address, trims whitespace, rejects the rest', () => {
    expect(looksLikeEmail('pm@gc.com')).toBe(true)
    expect(looksLikeEmail('  pm@gc.com ')).toBe(true)
    expect(looksLikeEmail('')).toBe(false)
    expect(looksLikeEmail('pm@gc')).toBe(false)
    expect(looksLikeEmail('pm gc.com')).toBe(false)
  })
})
