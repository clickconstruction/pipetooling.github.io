/**
 * The outbound-email catalog (v2.2656, PR 1 of the email-wording plan): one
 * registry row per email the app can send — what it is, who gets it, where
 * its copy is built, and whether the wording is runtime-editable yet.
 * Settings → Email templates renders this as the organizing index; the
 * `id` doubles as `email_send_log.email_type` for per-type send stats as
 * senders adopt it. Wording-only by design: rows describe cover copy, never
 * the attached documents.
 *
 * Source of truth for "where": docs/recent-features/v2.2656.md carries the
 * full inventory table with file:line pointers.
 */
import { buildSignedAgreementEmail } from './signedAgreementEmail'
import { buildBidRoomLinkEmailPreview } from './bids/bidRoomLinkEmailPreview'

export type EmailCatalogGroup = 'billing' | 'lien' | 'estimates_contracts' | 'bids' | 'digests' | 'team' | 'system'

export type EmailCatalogEditable =
  | { kind: 'templates'; templateTypes: string[] }
  | { kind: 'estimate_settings' }
  | { kind: 'hardcoded' }

export type EmailCatalogEntry = {
  /** Stable key — also the `email_send_log.email_type` senders stamp. */
  id: string
  name: string
  group: EmailCatalogGroup
  audience: 'customer' | 'team' | 'internal'
  /** e.g. "invoice PDF" — presence means the email carries a generated document (never edited here). */
  attachment?: string
  /** Where subject/body are composed today. */
  builtWhere: 'client' | 'server'
  /** The edge function that performs the send. */
  sender: string
  editable: EmailCatalogEditable
  /** Representative subject, {{vars}} shown where templatable. */
  subjectExample: string
  /** Variant sends folded into this row (resends, reminders, [TEST] twins). */
  variants?: string[]
  /**
   * v2.2732: fixed-design emails can render themselves with sample data — the catalog shows a
   * Preview button that opens the result in a new tab, signed by whoever is looking.
   */
  preview?: (ctx: EmailCatalogPreviewContext) => { subject: string; html: string }
}

export type EmailCatalogPreviewContext = {
  origin: string
  viewer: { name: string; email: string; phone: string } | null
}

export const EMAIL_CATALOG_GROUP_LABELS: Record<EmailCatalogGroup, string> = {
  billing: 'Billing & money',
  lien: 'Lien paperwork',
  estimates_contracts: 'Estimates & contracts',
  bids: 'Bids & RFQs',
  digests: 'Digests & reports',
  team: 'Team & workflow',
  system: 'System & dev',
}

export const EMAIL_CATALOG: EmailCatalogEntry[] = [
  // ---- Billing & money ----
  {
    id: 'physical_invoice',
    name: 'Physical invoice email',
    group: 'billing',
    audience: 'customer',
    attachment: 'invoice PDF (+ hazmat notices)',
    builtWhere: 'client',
    sender: 'send-physical-invoice-email',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Click Plumbing Invoice #1006',
    variants: ['re-send ("Email again — PDF attached")'],
  },
  {
    id: 'hazmat_notice',
    name: 'Biohazard remediation fee notice',
    group: 'billing',
    audience: 'customer',
    attachment: 'notice PDF',
    builtWhere: 'client',
    sender: 'send-hazmat-notice-email',
    editable: { kind: 'templates', templateTypes: ['hazmat_notice'] },
    subjectExample: 'Biohazard Remediation Fee Notice — Job {{job_number}}',
  },
  {
    id: 'gc_statement_manual',
    name: 'GC statement (manual share)',
    group: 'billing',
    audience: 'customer',
    builtWhere: 'client',
    sender: 'send-gc-statement-email',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Click Plumbing open balances — {{gc_name}} (subject editable per send)',
  },
  {
    id: 'gc_statement_scheduled',
    name: 'GC statement (scheduled)',
    group: 'billing',
    audience: 'customer',
    builtWhere: 'server',
    sender: 'gc-statement-email-dispatch',
    editable: { kind: 'templates', templateTypes: ['gc_statement_scheduled'] },
    subjectExample: 'Click Plumbing open balances: {{gc_name}}',
  },
  {
    id: 'supply_house_job_account',
    name: 'Supply-house job-account share',
    group: 'billing',
    audience: 'customer',
    builtWhere: 'client',
    sender: 'send-supply-house-job-account',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Job account — {{job_label}}',
  },

  // ---- Lien paperwork ----
  {
    id: 'lien_filing_notice',
    name: '§ 53.056 notice of claim (email channel)',
    group: 'lien',
    audience: 'customer',
    attachment: '§ 53.056 notice PDF',
    builtWhere: 'server',
    sender: 'send-lien-filing-email',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Notice of claim for unpaid labor or materials — {{job_name}}',
    variants: ['owner-of-record and original-contractor recipients'],
  },
  {
    id: 'lien_release_to_customer',
    name: 'Signed lien release to customer',
    group: 'lien',
    audience: 'customer',
    attachment: 'signed release PDF',
    builtWhere: 'client',
    sender: 'send-lien-release-email',
    editable: { kind: 'templates', templateTypes: ['lien_release_to_customer'] },
    subjectExample: 'Release of lien — {{project}}',
  },

  // ---- Estimates & contracts ----
  {
    id: 'estimate_to_customer',
    name: 'Estimate to customer',
    group: 'estimates_contracts',
    audience: 'customer',
    builtWhere: 'server',
    sender: 'send-estimate-to-customer',
    editable: { kind: 'estimate_settings' },
    subjectExample: 'Estimate: {{title}}',
    variants: ['change-order overlay'],
  },
  {
    id: 'contract_for_signature',
    name: 'Contract for signature',
    group: 'estimates_contracts',
    audience: 'team',
    builtWhere: 'server',
    sender: 'send-contract-for-signature',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Please sign: {{doc}} · Click Plumbing and Electrical — subject/intro editable per send',
  },
  {
    id: 'estimate_accepted_staff',
    name: 'Estimate accepted (staff notify)',
    group: 'estimates_contracts',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'accept-estimate',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Quote #{{n}} accepted — {{customer}}',
  },

  {
    id: 'signed_agreement_staff',
    name: 'Signed agreement — staff notice',
    group: 'estimates_contracts',
    audience: 'team',
    builtWhere: 'server',
    sender: 'accept-estimate · sign-bid-room',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Signed — {{project}} — $56,343 (Bid room proposal #412)',
    variants: ['Estimate #N'],
    preview: ({ origin }) =>
      buildSignedAgreementEmail({
        kind: 'bid',
        estimateNumber: 412,
        title: 'Hunter Road Sound Studio',
        projectAddress: '2530 Hunter Rd, San Marcos, TX 78666',
        customerName: 'Knight Contracting',
        signerName: 'Mark Knight',
        optionName: 'To Plans',
        totalCents: 5_634_300,
        signedAtLabel: 'Sept 4, 2026 · 9:12 AM',
        origin,
        job: null,
        autoCreateOn: false,
      }),
  },
  // ---- Bids & RFQs ----
  {
    id: 'bid_room_link',
    name: 'Bid room link / proposal to GC',
    group: 'bids',
    audience: 'customer',
    builtWhere: 'server',
    sender: 'send-bid-room-link',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Plumbing proposal — {{project}} — $56,343 · Click Plumbing',
    variants: ['Revised … (rev N)'],
    preview: ({ origin, viewer }) => buildBidRoomLinkEmailPreview({ origin, sender: viewer }),
  },
  {
    id: 'bid_pricing_package',
    name: 'Bid pricing package',
    group: 'bids',
    audience: 'customer',
    builtWhere: 'server',
    sender: 'send-bid-pricing-package',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Pricing — {{bid}}',
  },
  {
    id: 'bid_room_activity_staff',
    name: 'Bid room activity (staff notify)',
    group: 'bids',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'sign-bid-room',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Bid room — {{project}}',
  },
  {
    id: 'rfq_price_request',
    name: 'RFQ price request to supply house',
    group: 'bids',
    audience: 'customer',
    builtWhere: 'server',
    sender: 'send-rfq-email',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Price request — {{bid}}',
    variants: ['reminder', 're-send'],
  },

  // ---- Digests & reports ----
  {
    id: 'paid_job',
    name: 'Paid job / payment progress',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'paid-job-email',
    editable: { kind: 'templates', templateTypes: ['paid_job'] },
    subjectExample: 'Payment recorded — {{job_label}}',
    variants: ['[TEST] send-now'],
  },
  {
    id: 'ready_to_bill',
    name: 'Ready to bill notify',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'paid-job-email',
    editable: { kind: 'templates', templateTypes: ['ready_to_bill'] },
    subjectExample: 'Ready to bill — {{job_label}}',
    variants: ['[TEST] send-now'],
  },
  {
    id: 'money_waiting',
    name: 'Money waiting digest',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'money-waiting-email-dispatch',
    editable: { kind: 'templates', templateTypes: ['money_waiting'] },
    subjectExample: 'Money waiting — {{date}}',
  },
  {
    id: 'billed_awaiting',
    name: 'Billed awaiting payment digest',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'billed-report-email',
    editable: { kind: 'templates', templateTypes: ['billed_awaiting'] },
    subjectExample: 'Billed awaiting payment — {{date}}',
  },
  {
    id: 'payment_forecast',
    name: 'Payment forecast digest',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'payment-forecast-email-dispatch',
    editable: { kind: 'templates', templateTypes: ['payment_forecast'] },
    subjectExample: 'Payment forecast — {{date}}',
  },
  {
    id: 'crew_day',
    name: 'Crew day digest',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'crew-day-email-dispatch',
    editable: { kind: 'templates', templateTypes: ['crew_day'] },
    subjectExample: 'Crew day — {{date}}',
  },
  {
    id: 'weekly_money',
    name: 'Weekly money movement',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'weekly-money-email-dispatch',
    editable: { kind: 'templates', templateTypes: ['weekly_money'] },
    subjectExample: 'Weekly money movement — week of {{week_start}}',
  },
  {
    id: 'weekly_movement',
    name: 'Weekly movement',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'weekly-movement-email-dispatch',
    editable: { kind: 'templates', templateTypes: ['weekly_movement'] },
    subjectExample: 'Click Plumbing and Electrical — weekly movement',
  },
  {
    id: 'recurring_job_report',
    name: 'Recurring job activity report',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'recurring-job-report-dispatch',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Job activity report — {{job_label}}',
    variants: ['[TEST] send'],
  },
  {
    id: 'schedule_day',
    name: 'Dispatch schedule — one day',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'schedule-day-email-dispatch',
    editable: { kind: 'templates', templateTypes: ['schedule_day'] },
    subjectExample: "Tomorrow's schedule — {{date}}",
  },
  {
    id: 'schedule_share',
    name: 'Dispatch schedule share',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'schedule-share-dispatch',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Schedule — {{range}}',
    variants: ['instant', 'recurring'],
  },
  {
    id: 'report_email',
    name: 'Field report email',
    group: 'digests',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'send-report-email',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Report — {{template}} · {{job_label}}',
  },

  // ---- Team & workflow ----
  {
    id: 'workflow_notifications',
    name: 'Workflow stage notifications (11 templates)',
    group: 'team',
    audience: 'team',
    builtWhere: 'server',
    sender: 'send-workflow-notification',
    editable: {
      kind: 'templates',
      templateTypes: [
        'stage_assigned_started',
        'stage_assigned_complete',
        'stage_assigned_reopened',
        'stage_me_started',
        'stage_me_complete',
        'stage_me_reopened',
        'stage_next_complete_or_approved',
        'stage_prior_rejected',
        'work_order_offered',
        'work_order_accepted',
        'work_order_declined',
      ],
    },
    subjectExample: '(per template — edit below)',
  },
  {
    id: 'invitation',
    name: 'User invitation',
    group: 'team',
    audience: 'team',
    builtWhere: 'server',
    sender: 'invite-user',
    editable: { kind: 'templates', templateTypes: ['invitation'] },
    subjectExample: '(template — edit below)',
  },
  {
    id: 'sign_in',
    name: 'Sign-in link email',
    group: 'team',
    audience: 'team',
    builtWhere: 'server',
    sender: 'send-sign-in-email',
    editable: { kind: 'templates', templateTypes: ['sign_in'] },
    subjectExample: '(template — edit below)',
  },
  {
    id: 'portal_request_staff',
    name: 'Customer-portal request (staff notify)',
    group: 'team',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'submit-portal-request',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Portal request — {{customer}}',
  },
  {
    id: 'task_reminder_fallback',
    name: 'Task reminder (email fallback)',
    group: 'team',
    audience: 'team',
    builtWhere: 'server',
    sender: 'send-scheduled-reminders',
    editable: { kind: 'hardcoded' },
    subjectExample: 'Task reminder',
  },

  // ---- System & dev ----
  {
    id: 'ct_roster_audit',
    name: 'CT↔PT roster audit (weekly, devs)',
    group: 'system',
    audience: 'internal',
    builtWhere: 'server',
    sender: 'ct-roster-audit',
    editable: { kind: 'hardcoded' },
    subjectExample: 'CT/PT roster audit — {{date}}',
  },
  {
    id: 'test_email',
    name: 'Dev test email',
    group: 'system',
    audience: 'internal',
    builtWhere: 'client',
    sender: 'test-email',
    editable: { kind: 'hardcoded' },
    subjectExample: '(whatever the tester types)',
  },
]

/** Rows for one group, catalog order preserved. */
export function emailCatalogByGroup(group: EmailCatalogGroup): EmailCatalogEntry[] {
  return EMAIL_CATALOG.filter((e) => e.group === group)
}
