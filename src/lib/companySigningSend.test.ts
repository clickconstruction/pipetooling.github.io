import { describe, expect, it } from 'vitest'
import {
  COMPANY_PAPER_SEND_ROLES,
  companyPaperCallerRefusal,
  companyPaperFromName,
  companyPaperMessageKind,
  companySigningEmailInput,
  companySigningSentCopy,
  companyTradeMessageRow,
  parseCompanySigningRequest,
} from '../../supabase/functions/_shared/companySigningSend'
import { buildGcTradeEmail } from '../../supabase/functions/_shared/gcTradeEmail'

const doc = '7d2c7a1e-3f4b-4e5a-9b8c-1d2e3f4a5b6c'
const company = 'ff11d0fb-269e-44de-b92a-e7256c180f67'
const body = {
  person_contract_document_id: doc,
  public_origin: 'https://pipetooling.github.io',
  trade_email: {
    companyId: company,
    key: 'a1b2c3d4-0000-4000-8000-000000000001:msa',
    lang: 'en',
    subject: 'Your master agreement with Click Construction',
    lines: ['Here is our master agreement. You sign it once, and it covers every job you do for us.', 'After that, each job is a short statement of work.'],
    actionLabel: 'Read and sign',
  },
}

describe('send-contract-for-signature, a company’s paper (B6-b-i, call S)', () => {
  it('reads the request, its words held to gc-trade-email’s limits', () => {
    const parsed = parseCompanySigningRequest(body)
    expect(parsed).toEqual({
      ok: true,
      req: {
        documentId: doc,
        publicOrigin: 'https://pipetooling.github.io',
        companyId: company,
        key: 'a1b2c3d4-0000-4000-8000-000000000001:msa',
        lang: 'en',
        subject: 'Your master agreement with Click Construction',
        lines: body.trade_email.lines,
        actionLabel: 'Read and sign',
        from: 'gc',
      },
    })
  })

  it('goes out under the GC’s name unless the office says it is its own', () => {
    const gc = parseCompanySigningRequest(body)
    const office = parseCompanySigningRequest({ ...body, trade_email: { ...body.trade_email, from: 'office' } })
    const other = parseCompanySigningRequest({ ...body, trade_email: { ...body.trade_email, from: 'anyone' } })
    expect(gc.ok && gc.req.from).toBe('gc')
    expect(office.ok && office.req.from).toBe('office')
    expect(other.ok && other.req.from).toBe('gc')
    expect(companyPaperFromName('gc')).toBe('Click Construction')
    expect(companyPaperFromName('office')).toBe('Click Plumbing and Electrical')
  })

  it('refuses a request that is not a company paper’s, or whose words are off', () => {
    expect(parseCompanySigningRequest({ person_contract_document_id: doc, signer_email: 'dana@example.com' })).toEqual({ ok: false })
    expect(parseCompanySigningRequest({ ...body, person_contract_document_id: 'not-a-uuid' })).toEqual({ ok: false })
    expect(parseCompanySigningRequest({ ...body, trade_email: { ...body.trade_email, companyId: 'x' } })).toEqual({ ok: false })
    expect(parseCompanySigningRequest({ ...body, trade_email: { ...body.trade_email, key: '' } })).toEqual({ ok: false })
    expect(parseCompanySigningRequest({ ...body, trade_email: { ...body.trade_email, lang: 'fr' } })).toEqual({ ok: false })
    expect(parseCompanySigningRequest({ ...body, trade_email: { ...body.trade_email, lines: [] } })).toEqual({ ok: false })
    expect(parseCompanySigningRequest({ ...body, trade_email: { ...body.trade_email, actionLabel: '  ' } })).toEqual({ ok: false })
    // An origin that is not a web address falls back to the function's own.
    const plain = parseCompanySigningRequest({ ...body, public_origin: 'javascript:x' })
    expect(plain.ok && plain.req.publicOrigin).toBeNull()
  })

  it('a master agreement goes as msa, any other paper as paper', () => {
    expect(companyPaperMessageKind('agreement')).toBe('msa')
    expect(companyPaperMessageKind(null)).toBe('msa')
    expect(companyPaperMessageKind('w9')).toBe('paper')
  })

  it('the email leads with the signing link, the portal under it, in GC’s frame', () => {
    const parsed = parseCompanySigningRequest(body)
    if (!parsed.ok) throw new Error('parse')
    const input = companySigningEmailInput({
      req: parsed.req,
      names: ['Dana Ruiz', 'Lee Park'],
      company: 'GC test trade company, delete me',
      portalUrl: 'https://clicktooling.com/t/portal',
      acceptUrl: 'https://pipetooling.github.io/contract/accept?t=sign',
      signer: 'Rosa Office',
      gc: 'Click Construction',
    })
    expect(input.action).toEqual({ label: 'Read and sign', url: 'https://pipetooling.github.io/contract/accept?t=sign' })
    const { text } = buildGcTradeEmail(input)
    expect(text.startsWith('Hello Dana and Lee,')).toBe(true)
    expect(text).toContain('Read and sign: https://pipetooling.github.io/contract/accept?t=sign')
    expect(text).toContain('Open your portal: https://clicktooling.com/t/portal')
  })

  it('writes the message row as gc-trade-email does, and files the copy under it', () => {
    const parsed = parseCompanySigningRequest(body)
    if (!parsed.ok) throw new Error('parse')
    expect(
      companyTradeMessageRow({ id: 'm1', req: parsed.req, kind: 'msa', subject: 'S', names: ['Dana Ruiz'], sentOn: '2026-10-09', sentBy: 'u1', emailSendLogId: 'l1' }),
    ).toEqual({
      id: 'm1',
      company_id: company,
      project_id: null,
      kind: 'msa',
      mail_group: 'contracts',
      msg_key: 'a1b2c3d4-0000-4000-8000-000000000001:msa',
      lang: 'en',
      subject: 'S',
      lines: body.trade_email.lines,
      to_names: ['Dana Ruiz'],
      sent_on: '2026-10-09',
      sent_by: 'u1',
      email_send_log_id: 'l1',
    })
    expect(
      companySigningSentCopy({ company: 'GC test trade company, delete me', messageId: 'm1', sentBy: 'u1', to: 'dana@example.com', cc: ['lee@example.com'], from: 'Click Construction <team@x>', subject: 'S', html: '<p>x</p>', resendEmailId: 're_1' }),
    ).toEqual([
      { kind: 'gc_trade_email', title: 'S', recipientName: 'GC test trade company, delete me', source: { table: 'gc_trade_messages', id: 'm1' }, sentBy: 'u1' },
      { to: ['dana@example.com'], cc: ['lee@example.com'], from: 'Click Construction <team@x>', subject: 'S', html: '<p>x</p>', resendEmailId: 're_1' },
    ])
  })
})

describe('who sends a company’s paper (punch list #403, step 5)', () => {
  it('takes the four roles that send any paper', () => {
    expect([...COMPANY_PAPER_SEND_ROLES]).toEqual(['dev', 'master_technician', 'assistant', 'controller'])
    for (const role of COMPANY_PAPER_SEND_ROLES) expect(companyPaperCallerRefusal({ role })).toBeNull()
  })

  it.each(['estimator', 'primary', 'superintendent', 'helpers', 'subcontractor', '', 'DEV'])('refuses the role %j as office only', (role) => {
    expect(companyPaperCallerRefusal({ role })).toBe('officeOnly')
  })

  it('refuses a caller with no account row and one with no role', () => {
    expect(companyPaperCallerRefusal(null)).toBe('officeOnly')
    expect(companyPaperCallerRefusal(undefined)).toBe('officeOnly')
    expect(companyPaperCallerRefusal({})).toBe('officeOnly')
    expect(companyPaperCallerRefusal({ role: null })).toBe('officeOnly')
  })

  it('refuses a training account and a digital twin whatever their role', () => {
    expect(companyPaperCallerRefusal({ role: 'assistant', read_only: true })).toBe('readOnly')
    expect(companyPaperCallerRefusal({ role: 'dev', is_digital_twin: true })).toBe('readOnly')
    expect(companyPaperCallerRefusal({ role: 'controller', read_only: false, is_digital_twin: false })).toBeNull()
  })

  it('says the role first, so a twin who is an estimator reads the office line', () => {
    expect(companyPaperCallerRefusal({ role: 'estimator', is_digital_twin: true })).toBe('officeOnly')
  })
})
