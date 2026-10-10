import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { supabase } from './supabase'
import { readSendGcStatementResponse, sendGcStatementEmail, sendGcStatementRequestBody } from './sendGcStatementEmail'
import type { SendGcStatementPayload } from '../components/jobs/JobsGcReviewModal'

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>

const payload: SendGcStatementPayload = {
  gcCustomerId: 'gc-1',
  gcName: 'Acme Builders',
  groupBy: 'gc',
  toEmail: 'ap@acme.test',
  subject: 'Statement',
  emailHtml: '<p>html</p>',
  emailText: 'text',
  total: 1234.5,
  jobCount: 3,
}

describe('sendGcStatementRequestBody (Stages map step 7, v2.5099)', () => {
  it('names every field the function reads, with no CCs and the sender taking replies by default', () => {
    expect(sendGcStatementRequestBody(payload)).toEqual({
      gc_customer_id: 'gc-1',
      gc_name: 'Acme Builders',
      group_by: 'gc',
      to_email: 'ap@acme.test',
      cc_emails: [],
      subject: 'Statement',
      email_html: '<p>html</p>',
      email_text: 'text',
      total: 1234.5,
      job_count: 3,
      reply_to_user_id: null,
    })
  })

  it('carries the CCs and the person named to take replies', () => {
    const body = sendGcStatementRequestBody({ ...payload, ccEmails: ['pm@acme.test'], replyTo: { id: 'u-9', name: 'Wendi' } })
    expect(body.cc_emails).toEqual(['pm@acme.test'])
    expect(body.reply_to_user_id).toBe('u-9')
  })

  it('sends the QR copy only with the portal it opens', () => {
    const both = sendGcStatementRequestBody({ ...payload, emailHtmlQr: '<p>qr</p>', portalUrl: 'https://p.test/acme' })
    expect(both.email_html_qr).toBe('<p>qr</p>')
    expect(both.portal_url).toBe('https://p.test/acme')
    for (const p of [{ emailHtmlQr: '<p>qr</p>', portalUrl: null }, { emailHtmlQr: null, portalUrl: 'https://p.test/acme' }]) {
      const body = sendGcStatementRequestBody({ ...payload, ...p })
      expect(body).not.toHaveProperty('email_html_qr')
      expect(body).not.toHaveProperty('portal_url')
    }
  })
})

describe('readSendGcStatementResponse', () => {
  it("puts the function's own refusal ahead of the transport's error", () => {
    expect(readSendGcStatementResponse({ error: 'No email on file' }, { message: 'Edge Function returned a non-2xx status code' })).toEqual({ ok: false, error: 'No email on file' })
  })

  it("says the transport's error, or Send failed when it has no words", () => {
    expect(readSendGcStatementResponse(null, { message: 'network down' })).toEqual({ ok: false, error: 'network down' })
    expect(readSendGcStatementResponse(null, { message: '' })).toEqual({ ok: false, error: 'Send failed' })
    expect(readSendGcStatementResponse({ error: '' }, { message: 'network down' })).toEqual({ ok: false, error: 'network down' })
  })

  it('passes back where replies go, and nothing from a function that echoes nothing', () => {
    expect(readSendGcStatementResponse({ success: true, reply_to: 'wendi@click.test' }, null)).toEqual({ ok: true, replyTo: 'wendi@click.test' })
    expect(readSendGcStatementResponse({ success: true, reply_to: null }, null)).toEqual({ ok: true, replyTo: null })
    expect(readSendGcStatementResponse({ success: true }, null)).toEqual({ ok: true, replyTo: undefined })
    expect(readSendGcStatementResponse(null, null)).toEqual({ ok: true, replyTo: undefined })
  })
})

describe('sendGcStatementEmail', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('invokes send-gc-statement-email with the built body', async () => {
    invoke.mockResolvedValue({ data: { success: true, reply_to: null }, error: null })
    expect(await sendGcStatementEmail(payload)).toEqual({ ok: true, replyTo: null })
    expect(invoke).toHaveBeenCalledWith('send-gc-statement-email', { body: sendGcStatementRequestBody(payload) })
  })

  it('reads a refusal through the same rule', async () => {
    invoke.mockResolvedValue({ data: { error: 'No email on file' }, error: null })
    expect(await sendGcStatementEmail(payload)).toEqual({ ok: false, error: 'No email on file' })
  })

  it('turns a throw into words', async () => {
    invoke.mockRejectedValue(new Error('offline'))
    expect(await sendGcStatementEmail(payload)).toEqual({ ok: false, error: 'offline' })
    invoke.mockImplementation(() => { throw 'boom' })
    expect(await sendGcStatementEmail(payload)).toEqual({ ok: false, error: 'Send failed' })
  })
})
