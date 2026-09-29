/**
 * The sample team emails What the team sees renders in the browser (punch list #60, v2.4142):
 * the same builders the edge functions run, fed the sample company — and, for the four
 * template-driven emails, the live `email_templates` rows with sample variables, so an edit
 * on Email templates shows here the way a Settings edit shows on What customers see.
 */
import { buildSignedAgreementEmail } from './signedAgreementEmail'
import { bidRoomActivityStaffEmail } from '../../supabase/functions/_shared/bidRoomActivityStaffEmail'
import { portalRequestStaffEmail } from '../../supabase/functions/_shared/portalRequestStaffEmail'
import { wordAskEmail } from '../../supabase/functions/_shared/gcWordAsk'
import { SAMPLE_GC, SAMPLE_HOMEOWNER } from './customerSample'
import { buildSampleContractEmail, type SampleEmailContext } from './customerSampleEmails'
import { escapeEmailHtml, renderEmailWording } from './emailWording'
import type { TeamSampleEmailId } from './teamEmails'

export type BuiltTeamEmail = { subject: string; html: string; text: string }

/** One `email_templates` row as the tab loads it — the live wording, when the office has set any. */
export type TeamEmailTemplateRow = { template_type: string; subject: string; body: string }

export type TeamSampleContext = SampleEmailContext & {
  /** The live template rows (`email_templates`), or none when the load has not landed. */
  templates: readonly TeamEmailTemplateRow[]
  /** The person the sample addresses — the viewer, or the person picked. */
  recipient: { name: string; email: string; role: string }
}

/**
 * The defaults the senders fall back to when no template row exists (`invite-user`,
 * `send-sign-in-email` carry the same strings; `teamSampleEmails.test.ts` reads their source to
 * keep these in step). The workflow default is the sample's own — the seeded rows are the
 * source of truth there and are always present in prod.
 */
export const TEAM_TEMPLATE_DEFAULTS: Record<string, { subject: string; body: string }> = {
  invitation: {
    subject: 'Invitation to join ClickTooling',
    body: "Hi {{name}},\n\nYou've been invited to join ClickTooling as a {{role}}. Click the link below to set up your account:\n\n{{link}}\n\nIf you didn't expect this invitation, you can safely ignore this email.",
  },
  sign_in: {
    subject: 'Sign in to ClickTooling',
    body: "Hi {{name}},\n\nClick the link below to sign in to your ClickTooling account:\n\n{{link}}\n\nIf you didn't request this sign-in link, you can safely ignore this email.",
  },
  stage_assigned_started: {
    subject: '{{stage_name}} assigned to you — {{project_name}}',
    body: 'Hi {{name}},\n\n{{assigned_to_name}} assigned you {{stage_name}} on {{project_name}}.\n\nOpen the workflow: {{workflow_link}}',
  },
}

/** A template email the way the senders build it: variables filled, the body escaped, paragraphs on blank lines. */
export function renderTemplateEmail(template: { subject: string; body: string }, vars: Record<string, string>): BuiltTeamEmail {
  const subject = renderEmailWording(template.subject, vars)
  const text = renderEmailWording(template.body, vars)
  const html = text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeEmailHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
  return { subject, html, text }
}

function templateFor(ctx: TeamSampleContext, type: string): { subject: string; body: string } {
  const live = ctx.templates.find((t) => t.template_type === type)
  if (live && (live.subject.trim() || live.body.trim())) return { subject: live.subject, body: live.body }
  return TEAM_TEMPLATE_DEFAULTS[type] ?? { subject: type, body: '' }
}

/** Sample GCs for the account man's ask — the sample company's builders, with what they owe. */
const SAMPLE_WORD_ASK_GCS = [
  { gcName: SAMPLE_GC.company, amount: 125_000, promise: { payBy: '2026-10-15', late: false, daysLate: 0 } },
  { gcName: 'RMC · Dudley Mason', amount: 98_500, promise: null },
  { gcName: 'Structura', amount: 89_000, promise: { payBy: '2026-09-20', late: true, daysLate: 9 } },
] as const

export function buildTeamSampleEmail(id: TeamSampleEmailId, ctx: TeamSampleContext): BuiltTeamEmail {
  const origin = ctx.origin
  switch (id) {
    case 'signed_agreement_staff':
      return buildSignedAgreementEmail({
        kind: 'bid',
        estimateNumber: 412,
        title: 'Cedar Bend Apartments',
        projectAddress: '2530 Cedar Bend Dr, Kyle, TX 78640',
        customerName: SAMPLE_GC.company,
        signerName: SAMPLE_GC.contact,
        optionName: 'To Plans',
        totalCents: 5_634_300,
        signedAtLabel: `${ctx.dateLabel} · 9:12 AM`,
        origin,
        job: null,
        autoCreateOn: false,
      })
    case 'estimate_accepted_staff':
      return buildSignedAgreementEmail({
        kind: 'estimate',
        estimateNumber: 0,
        title: 'Water heater replacement',
        projectAddress: SAMPLE_HOMEOWNER.address,
        customerName: SAMPLE_HOMEOWNER.name,
        signerName: SAMPLE_HOMEOWNER.name,
        optionName: null,
        totalCents: 438_000,
        signedAtLabel: `${ctx.dateLabel} · 4:12 PM`,
        origin,
        job: { id: 'sample', hcpNumber: '1054' },
        autoCreateOn: true,
      })
    case 'gc_word_ask':
      return wordAskEmail({
        ownerName: 'Robert',
        askedByName: ctx.sender?.name ?? 'The office',
        gcs: SAMPLE_WORD_ASK_GCS,
        url: `${origin}/word/sample`,
        expiresLabel: 'in 8 days',
      })
    case 'bid_room_activity_staff':
      return bidRoomActivityStaffEmail({ projectName: 'Cedar Bend Apartments', what: `signed the proposal (${SAMPLE_GC.contact}, ${SAMPLE_GC.company})`, origin })
    case 'portal_request_staff':
      return portalRequestStaffEmail({
        kindLabel: 'request',
        customerName: SAMPLE_HOMEOWNER.name,
        lines: [
          `${SAMPLE_HOMEOWNER.name} sent a request from their portal.`,
          '',
          'What they wrote: The water heater is making a knocking sound again — can someone come by this week?',
          'Best days & times: Thursday or Friday, after 2',
          `Phone: ${SAMPLE_HOMEOWNER.phone}`,
          'Linked to one of their jobs (see the dispatch item).',
          '',
          'The request is in the dispatch inbox in ClickTooling.',
        ],
      })
    case 'contract_for_signature': {
      const m = buildSampleContractEmail(ctx)
      return { subject: m.subject, html: m.html, text: m.text }
    }
    case 'invitation':
      return renderTemplateEmail(templateFor(ctx, 'invitation'), {
        name: ctx.recipient.name,
        email: ctx.recipient.email,
        role: ctx.recipient.role,
        link: `${origin}/accept-invite?token=sample`,
      })
    case 'sign_in':
      return renderTemplateEmail(templateFor(ctx, 'sign_in'), {
        name: ctx.recipient.name,
        email: ctx.recipient.email,
        link: `${origin}/auth/sign-in?token=sample`,
      })
    case 'workflow_notifications':
      return renderTemplateEmail(templateFor(ctx, 'stage_assigned_started'), {
        name: ctx.recipient.name,
        email: ctx.recipient.email,
        project_name: 'Water heater replacement',
        stage_name: 'Rough-in',
        assigned_to_name: ctx.sender?.name ?? 'The office',
        workflow_link: `${origin}/projects/sample`,
      })
    case 'task_reminder_fallback': {
      const text = `Reminder: Pull the permit for ${SAMPLE_HOMEOWNER.name} — due today.\n\nOpen your checklist: ${origin}/checklist`
      return { subject: 'Task reminder', text, html: escapeEmailHtml(text).replace(/\n/g, '<br>') }
    }
    case 'test_email': {
      const text = `This is a test from Settings → Email templates.\n\nIf you can read this, Resend delivered it and the From line is right.`
      return { subject: 'Test — whatever the tester typed', text, html: text.replace(/\n/g, '<br>') }
    }
  }
}
