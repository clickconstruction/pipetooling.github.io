import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TEAM_EMAILS, type TeamSampleEmailId } from './teamEmails'
import { TEAM_TEMPLATE_DEFAULTS, buildTeamSampleEmail, renderTemplateEmail, type TeamSampleContext } from './teamSampleEmails'

const ctx: TeamSampleContext = {
  rows: [],
  origin: 'https://clicktooling.com',
  todayYmd: '2026-09-29',
  dateLabel: 'Sep 29, 2026',
  sender: { name: 'Wendi Douglas', email: 'wendi@clickplumbing.com', phone: '(512) 555-0142' },
  templates: [],
  recipient: { name: 'Malachi Sample', email: 'malachi@example.com', role: 'controller' },
}

const SAMPLE_IDS = TEAM_EMAILS.flatMap((e) => (e.render.kind === 'sample' ? [e.render.sample] : [])) as TeamSampleEmailId[]

describe('team sample emails (What the team sees)', () => {
  it('every sample row builds a subject and an HTML body', () => {
    expect(SAMPLE_IDS.length).toBe(14)
    for (const id of SAMPLE_IDS) {
      const m = buildTeamSampleEmail(id, ctx)
      expect(m.subject.trim().length, id).toBeGreaterThan(3)
      expect(m.html.length, id).toBeGreaterThan(20)
      expect(m.subject, id).not.toMatch(/\{\{/)
      expect(m.html, id).not.toMatch(/\{\{/)
    }
  })
  it('Money waiting is the digest\u2019s own renderer over the sample company (v2.4161)', () => {
    const m = buildTeamSampleEmail('money_waiting', ctx)
    expect(m.subject).toBe('Money waiting — 3 customers off pace, $51,220 open')
    expect(m.html).toContain('Structura')
    expect(m.html).toContain('https://clicktooling.com/jobs?jobDetail=job-1')
    expect(m.text).toContain('slowest first')
  })
  it('Crew day is the digest\u2019s own renderer over a busy sample day (v2.4163)', () => {
    const m = buildTeamSampleEmail('crew_day', ctx)
    expect(m.subject).toMatch(/^Crew Day — .* · 6 people · /)
    expect(m.html).toContain('Cedar Bend Apartments')
    expect(m.text).toContain('Subs on site today')
    expect(m.text).toContain("Sam's Plumbing LLC")
  })
  it('Payment forecast is the digest\u2019s own renderer over the sample bills (v2.4164)', () => {
    const m = buildTeamSampleEmail('payment_forecast', ctx)
    expect(m.subject).toMatch(/^Payment forecast — /)
    expect(m.html).toContain('https://clicktooling.com/jobs?jobDetail=job-1')
    expect(m.text).toContain('open bills')
  })
  it('the signed-agreement notice is the real builder over the sample GC', () => {
    const m = buildTeamSampleEmail('signed_agreement_staff', ctx)
    expect(m.subject).toContain('Sample Contracting signed $56,343')
    expect(m.html).toContain('Cedar Bend Apartments')
  })
  it('the account man’s ask names his GCs and the total', () => {
    const m = buildTeamSampleEmail('gc_word_ask', ctx)
    expect(m.html).toContain('Sample Contracting')
    expect(m.html).toContain('Structura')
  })
  it('the template emails use the live row when there is one, the sender’s default when not', () => {
    const fallback = buildTeamSampleEmail('sign_in', ctx)
    expect(fallback.subject).toBe('Sign in to ClickTooling')
    expect(fallback.html).toContain('Hi Malachi Sample,')
    expect(fallback.html).toContain('https://clicktooling.com/auth/sign-in?token=sample')
    const live = buildTeamSampleEmail('sign_in', { ...ctx, templates: [{ template_type: 'sign_in', subject: 'Your link, {{name}}', body: 'Tap: {{link}}' }] })
    expect(live.subject).toBe('Your link, Malachi Sample')
    expect(live.html).toBe('<p>Tap: https://clicktooling.com/auth/sign-in?token=sample</p>')
  })
  it('the invitation fills the role', () => {
    const m = buildTeamSampleEmail('invitation', ctx)
    expect(m.html).toContain('as a controller')
  })
  it('renderTemplateEmail escapes the body and keeps paragraphs', () => {
    const m = renderTemplateEmail({ subject: 'S {{a}}', body: 'One <b>\n\nTwo {{a}}' }, { a: 'x' })
    expect(m.subject).toBe('S x')
    expect(m.html).toBe('<p>One &lt;b&gt;</p><p>Two x</p>')
    expect(m.text).toBe('One <b>\n\nTwo x')
  })
  it('the defaults are the senders’ own strings (read from their source)', () => {
    const root = resolve(__dirname, '../..')
    for (const [type, fn] of [
      ['invitation', 'invite-user'],
      ['sign_in', 'send-sign-in-email'],
    ] as const) {
      const src = readFileSync(resolve(root, `supabase/functions/${fn}/index.ts`), 'utf8')
      expect(src, `${fn} subject`).toContain(`const DEFAULT_SUBJECT = '${TEAM_TEMPLATE_DEFAULTS[type]!.subject}'`)
      expect(src, `${fn} body`).toContain(JSON.stringify(TEAM_TEMPLATE_DEFAULTS[type]!.body).replace(/^"|"$/g, '').replace(/\\"/g, '"'))
    }
  })
})
