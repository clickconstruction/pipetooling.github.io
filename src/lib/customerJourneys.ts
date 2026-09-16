/**
 * What customers see (Settings dev tab, v2.2758): the journeys — every surface a homeowner, a
 * general contractor and a subcontractor meets, in the order they meet them. Pure data so the
 * tab, the tests and the docs agree on what is rendered and where it comes from.
 *
 * A step renders one of four ways:
 *   page     — the real public page in an iframe, opened with the sample token
 *   email    — the real email builder, run in the browser over the live Settings
 *   external — sent by another system (Stripe), or typed by staff; named, not rendered
 *   paper    — a document built in the browser from the sample by the app's own builder (v2.3509):
 *              an HTML preview in the frame and the PDF the customer would open
 *   soon     — a surface this tab does not render yet (a "Next release" card)
 *
 * Every public route and every outside-facing email sender must have a step here or a named
 * exemption — `customerSurfaceRegistry.ts` is the registry and its test is the guard (v2.3505).
 * Five audiences since v2.3505: homeowner, general contractor, subcontractor, supply house, and
 * the collections law firm. Collections paper sits at the end of the journey it belongs to.
 */
import { SAMPLE_TOKEN, SAMPLE_TOKEN_DONE, SAMPLE_TOKEN_GC } from './customerSample'
import type { PaperId } from './journeys/paperSamples'

export type SampleEmailId = 'estimate' | 'bid-room' | 'bid-room-revised' | 'contract'

export type JourneyStepRender =
  | { kind: 'page'; path: string }
  | { kind: 'email'; email: SampleEmailId }
  | { kind: 'paper'; paper: PaperId }
  | { kind: 'external'; note: string }
  | { kind: 'soon'; note: string }

export type JourneyStep = {
  id: string
  label: string
  /** What sends or serves it — the function or route, in the app's own words. */
  sublabel: string
  /** When in the relationship it happens. */
  when: string
  /** What the person can do on this surface, in the office's words (v2.3507). */
  customerCan: string
  /** The help guide that covers sending it: a slug in src/content/help (v2.3507). */
  guide: string
  /** The Settings this surface reflects — the reason to look at it after a change. */
  reflects: string[]
  render: JourneyStepRender
}

export type JourneyId = 'homeowner' | 'gc' | 'sub' | 'house' | 'firm'

export type Journey = { id: JourneyId; title: string; subtitle: string; steps: JourneyStep[] }

export const ESTIMATE_SAMPLE_PATH = `/estimate/accept?t=${SAMPLE_TOKEN}`
export const ESTIMATE_SAMPLE_DONE_PATH = `/estimate/accept?t=${SAMPLE_TOKEN_DONE}`
/** The public terms page reads the live Settings; the token is only so the tab treats it like every other sample page. */
export const ESTIMATE_TERMS_SAMPLE_PATH = `/estimate/terms?t=${SAMPLE_TOKEN}`
export const BID_ROOM_SAMPLE_PATH = `/bid-room?t=${SAMPLE_TOKEN}`
export const BID_ROOM_SAMPLE_DONE_PATH = `/bid-room?t=${SAMPLE_TOKEN_DONE}`
export const CUSTOMER_PORTAL_SAMPLE_PATH = `/portal?t=${SAMPLE_TOKEN}`
export const GC_PORTAL_SAMPLE_PATH = `/portal?t=${SAMPLE_TOKEN_GC}`
export const SUB_PORTAL_SAMPLE_PATH = `/sub?t=${SAMPLE_TOKEN}`
export const CONTRACT_SAMPLE_PATH = `/contract/accept?t=${SAMPLE_TOKEN}`
export const CONTRACT_SAMPLE_DONE_PATH = `/contract/accept?t=${SAMPLE_TOKEN_DONE}`

export function customerJourneys(): Journey[] {
  return [
    {
      id: 'homeowner',
      title: 'Homeowner',
      subtitle: 'Sam Sample · an estimate, then a job, then a bill',
      steps: [
        {
          id: 'estimate-email',
          label: 'Estimate email',
          sublabel: 'Estimates → Send to customer',
          when: 'Day 0',
          customerCan: 'Open the estimate from the link, read the scope and the total, and reply to you by email.',
          guide: 'see-the-email-a-customer-gets-with-an-estimate',
          reflects: ['Estimate email body template', 'Acceptance page logo', 'Acceptance page footer'],
          render: { kind: 'email', email: 'estimate' },
        },
        {
          id: 'estimate-page',
          label: 'Accept page',
          sublabel: 'the link in that email',
          when: 'Days 0–14',
          customerCan: 'Read every line, pick an option where you offered one, and sign on the page, or decline with a reason.',
          guide: 'send-an-estimate-and-turn-it-into-a-job',
          reflects: ['Estimate customer copy (accept section, labels, checkbox)', 'Estimate public terms', 'Acceptance page footer', 'Acceptance page logo'],
          render: { kind: 'page', path: ESTIMATE_SAMPLE_PATH },
        },
        {
          id: 'estimate-terms',
          label: 'Terms page',
          sublabel: '/estimate/terms — the link on the accept page',
          when: 'Days 0–14',
          customerCan: 'Read the standard terms the estimate is offered under, in full.',
          guide: 'send-an-estimate-and-turn-it-into-a-job',
          reflects: ['Estimate public terms'],
          render: { kind: 'page', path: ESTIMATE_TERMS_SAMPLE_PATH },
        },
        {
          id: 'estimate-thankyou',
          label: 'Thank-you',
          sublabel: 'same page, after signing',
          when: 'Right after',
          customerCan: 'See that the signature went through and what happens next.',
          guide: 'tell-if-a-customer-opened-an-estimate-and-record-a-no',
          reflects: ['Thank-you heading and body'],
          render: { kind: 'page', path: ESTIMATE_SAMPLE_DONE_PATH },
        },
        {
          id: 'job-contract-email',
          label: 'Agreement email',
          sublabel: 'Jobs → Contract sweep → Send · send-job-contract',
          when: 'Before work starts',
          customerCan: 'Open the service agreement from the link in the email.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Standard terms (the customer Contract Book document, or the built-in wording)', 'Sender name and email'],
          render: { kind: 'soon', note: 'The service-agreement email the Contract sweep sends. The function builds it inline; a sample mode on the sender renders it here. Planned as PR 2.' },
        },
        {
          id: 'job-contract-page',
          label: 'Agreement to sign',
          sublabel: '/contract/sign — the link in that email',
          when: 'Same day',
          customerCan: 'Read the scope, the amount and the payment line, open the full terms, and sign on the page.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Standard terms', 'Payment line (50% down · on completion · progress)', 'Letterhead'],
          render: { kind: 'soon', note: 'The customer\'s own signing page (not the sub\'s contract below). Needs a sample branch in get-job-contract. Planned as PR 2.' },
        },
        {
          id: 'job-contract-reminder',
          label: 'Reminder',
          sublabel: 'remind-job-contracts — unsigned after a few days',
          when: 'Days later',
          customerCan: 'Be reminded that the agreement is still waiting, with the same link.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Reminder cadence', 'Sender name and email'],
          render: { kind: 'soon', note: 'The nudge an unsigned agreement gets. Same sample mode as the agreement email. Planned as PR 2.' },
        },
        {
          id: 'job-contract-signed',
          label: 'Signed',
          sublabel: 'same page, after signing · the signed copy by email',
          when: 'After signing',
          customerCan: 'See the signed agreement, and receive the signed PDF when the office emails it.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Signed banner wording', 'The signed-copy email (share-job-contract)'],
          render: { kind: 'soon', note: 'The page after the customer signs, and the signed PDF the office can email them. Planned as PR 2.' },
        },
        {
          id: 'bill-email',
          label: 'Bill email',
          sublabel: 'Stripe sends it',
          when: 'After the work',
          customerCan: 'Open the Stripe bill and pay it by card or bank.',
          guide: 'turn-a-bill-into-a-stripe-bill',
          reflects: [],
          render: { kind: 'external', note: 'Stripe sends the invoice email from its own template when you bill through Stripe. It is not built by this app, so it is not rendered here; Stripe → Settings → Emails shows it.' },
        },
        {
          id: 'bill-by-email',
          label: 'Bill by email',
          sublabel: 'Bill Customer → the email channel, with the PDF',
          when: 'After the work',
          customerCan: 'Read the bill as a PDF and pay it the way the payment instructions say.',
          guide: 'choose-who-gets-the-bill',
          reflects: ['Invoice letterhead and footer', 'Payment instructions', 'Sender name and email'],
          render: { kind: 'paper', paper: 'bill-by-email' },
        },
        {
          id: 'hazmat-notice',
          label: 'Hazmat notice',
          sublabel: 'send-hazmat-notice-email + /hazmat-notice, from the invoice footer',
          when: 'With the bill',
          customerCan: 'Read why a biohazard remediation fee is on the bill, and what the fee covers.',
          guide: 'charge-a-hazmat-fee',
          reflects: ['Biohazard Remediation Fee Notice wording', 'Testimonials on the notice'],
          render: { kind: 'paper', paper: 'hazmat-notice' },
        },
        {
          id: 'customer-portal',
          label: 'Portal',
          sublabel: 'my.clickplumbing.com/sam-sample',
          when: 'Any time',
          customerCan: 'See their open bills and pay them, see signed agreements, request a visit, or ask for a bid.',
          guide: 'share-a-customer-their-portal',
          reflects: ['Portal letterhead (portalCompany)', 'Request-a-visit and ask-us-to-bid forms', 'Agreements card'],
          render: { kind: 'page', path: CUSTOMER_PORTAL_SAMPLE_PATH },
        },
        {
          id: 'demand-letter',
          label: 'Demand letter',
          sublabel: 'when it goes wrong · Legal desk → Email with the PDF (send-lien-filing-email)',
          when: 'Past due',
          customerCan: 'Read the final demand, the statement of account and the invoice, and pay or respond by the deadline.',
          guide: 'send-a-final-demand-letter',
          reflects: ['Demand letter wording and the legal lines', 'Statement of account', 'Collections law firm named'],
          render: { kind: 'paper', paper: 'demand-letter' },
        },
        {
          id: 'lien-release',
          label: 'Lien release',
          sublabel: 'when it is over · send-lien-release-email',
          when: 'After payment',
          customerCan: 'Receive the signed lien release once the account is settled.',
          guide: 'give-a-customer-a-lien-release',
          reflects: ['Lien release form (Contract Forms)'],
          render: { kind: 'paper', paper: 'lien-release' },
        },
      ],
    },
    {
      id: 'gc',
      title: 'General contractor',
      subtitle: 'Sample Contracting · a bid, then the room, then a change order',
      steps: [
        {
          id: 'bid-room-email',
          label: 'Bid room email',
          sublabel: 'Bids → Cover Letter → Publish & send',
          when: 'Day 0',
          customerCan: 'Open the bid room from the link and see every option\'s price.',
          guide: 'send-a-bid-for-signature',
          reflects: ['Bid cover letter terms default (the validity days)', 'Sender signature (your name, phone, email)'],
          render: { kind: 'email', email: 'bid-room' },
        },
        {
          id: 'bid-room',
          label: 'Bid room',
          sublabel: 'the link in that email',
          when: 'Until signed',
          customerCan: 'Read the proposal, compare options, download the letter, and sign or decline.',
          guide: 'send-a-bid-for-signature',
          reflects: ['Bid cover letter terms default', 'Bid cover letter exclusions default', 'Header brand'],
          render: { kind: 'page', path: BID_ROOM_SAMPLE_PATH },
        },
        {
          id: 'pricing-package-email',
          label: 'Pricing package email',
          sublabel: 'Bids → Pricing → Send package (send-bid-pricing-package)',
          when: 'Bid day, when asked for the breakdown',
          customerCan: 'Open the Job Plans link and read the four-column pricing breakdown.',
          guide: 'send-a-bid-pricing-package',
          reflects: ['Pricing package wording', 'Sender name and email'],
          render: { kind: 'soon', note: 'The email that carries a bid\'s external pricing package: the Job Plans link and the four-column pricing. Planned as PR 4.' },
        },
        {
          id: 'bid-room-revised-email',
          label: 'Revised send',
          sublabel: 'Publish update & notify',
          when: 'When plans change',
          customerCan: 'See what changed in the revision and open the same room.',
          guide: 'send-a-bid-for-signature',
          reflects: ['Revision note wording'],
          render: { kind: 'email', email: 'bid-room-revised' },
        },
        {
          id: 'bid-room-signed',
          label: 'Signed, with a change order',
          sublabel: 'same room, after signing',
          when: 'During the job',
          customerCan: 'See the signed proposal and any change order added since.',
          guide: 'send-a-bid-for-signature',
          reflects: ['Signed banner wording', 'Change-order card'],
          render: { kind: 'page', path: BID_ROOM_SAMPLE_DONE_PATH },
        },
        {
          id: 'submittal-room',
          label: 'Submittal review room',
          sublabel: '/submittal — the one link the GC forwards to the architect',
          when: 'After award',
          customerCan: 'Read the product decisions in plain words, see which rows match the plans, and download the package.',
          guide: 'build-a-submittal-package',
          reflects: ['Product rows in the customer\'s words', 'The package PDF'],
          render: { kind: 'soon', note: 'The review room where the customer\'s architect reads the product decisions and downloads the package. Needs a sample branch in get-submittal-room. Planned as PR 4.' },
        },
        {
          id: 'submittal-decided',
          label: 'Their call back',
          sublabel: 'same room, after Send my review',
          when: 'Days later',
          customerCan: 'See the calls they made, who made them, and the summary they sent back.',
          guide: 'build-a-submittal-package',
          reflects: ['Decision labels and the summary'],
          render: { kind: 'soon', note: 'The room after the reviewer decides: who they said they were, the calls per row, the summary. Planned as PR 4.' },
        },
        {
          id: 'test-report-email',
          label: 'Test report email',
          sublabel: 'Stages → Test report → Send to the GC (send-test-report)',
          when: 'Each test',
          customerCan: 'Read the test report and pay the bill from the link in the email.',
          guide: 'file-a-test-report',
          reflects: ['Test report paper (the sample card above opens it)', 'Stripe pay link in the body', 'Sender name and email'],
          render: { kind: 'soon', note: 'The email that carries the hydrostatic or gas test report with the pay link. The Test report (sample) card above opens the paper today. Planned as PR 4.' },
        },
        {
          id: 'gc-portal',
          label: 'Portal as GC',
          sublabel: 'my.clickplumbing.com/sample-contracting',
          when: 'Any time',
          customerCan: 'See the properties they build for, each job\'s stage, their customers\' open bills, and pay what is theirs.',
          guide: 'share-a-customer-their-portal',
          reflects: ['Portal letterhead (portalCompany)', 'AS GC tags and owner names', 'Agreements card'],
          render: { kind: 'page', path: GC_PORTAL_SAMPLE_PATH },
        },
        {
          id: 'gc-statement-email',
          label: 'Statement email',
          sublabel: 'GC Review → Certify → send-gc-statement-email · the monthly round',
          when: 'Monthly',
          customerCan: 'Read the certified statement of what they owe across their jobs and pay from the link.',
          guide: 'run-your-gc-statement-round',
          reflects: ['Statement letterhead', 'Statement email wording', 'Sender name and email'],
          render: { kind: 'soon', note: 'The certified statement a GC receives, sent by hand from GC Review or by the monthly round. The builder already runs in the browser with a parity test. Planned as PR 4.' },
        },
        {
          id: 'owner-notice',
          label: 'Notice to the owner of record',
          sublabel: 'when it goes wrong · Lien desk → the § 53.056 notice (send-lien-filing-email)',
          when: 'Unpaid month',
          customerCan: 'Read the notice that their contractor has not paid, the months it covers, and the invoice enclosed.',
          guide: 'send-lien-notices-from-the-lien-desk',
          reflects: ['Notice wording and the cover letter', 'The invoice enclosed'],
          render: { kind: 'paper', paper: 'owner-notice' },
        },
      ],
    },
    {
      id: 'sub',
      title: 'Subcontractor',
      subtitle: "Sam's Plumbing LLC · the portal is their whole experience",
      steps: [
        {
          id: 'sub-portal-text',
          label: 'Portal link, texted',
          sublabel: 'People → Subs → 🌐 → Copy link',
          when: 'Once',
          customerCan: 'Open their portal from the address you texted them.',
          guide: 'share-a-sub-their-portal',
          reflects: [],
          render: { kind: 'external', note: 'Staff copy the address and text it themselves — there is no app-built message. The help guide suggests wording.' },
        },
        {
          id: 'sub-portal',
          label: 'Sub portal',
          sublabel: 'my.clickplumbing.com/sams-plumbing',
          when: 'Weekly',
          customerCan: 'See their sheets, what they are owed and when it pays, open offers, and their paperwork.',
          guide: 'share-a-sub-their-portal',
          reflects: ['Sub pay-run day and explainer (Settings)', 'Portal letterhead (portalCompany)', 'Paperwork states and the insurance-expiry nudge'],
          render: { kind: 'page', path: SUB_PORTAL_SAMPLE_PATH },
        },
        {
          id: 'sub-contract-email',
          label: 'Contract email',
          sublabel: 'People → Contracts → Send for signature',
          when: 'On hire',
          customerCan: 'Open the contract from the link in the email.',
          guide: 'send-one-contract-to-one-person',
          reflects: ['Your opening message and subject (typed per send)', 'Sender name and email (the Reply-To)', 'The sub\'s portal address, when they have one'],
          render: { kind: 'email', email: 'contract' },
        },
        {
          id: 'sub-contract',
          label: 'Contract to sign',
          sublabel: 'the link in that email, or Paperwork → Sign',
          when: 'On hire',
          customerCan: 'Read the agreement and sign it on the page.',
          guide: 'send-one-contract-to-one-person',
          reflects: ['Signing page chrome and the agree checkbox wording'],
          render: { kind: 'page', path: CONTRACT_SAMPLE_PATH },
        },
        {
          id: 'sub-contract-signed',
          label: 'Signed',
          sublabel: 'same page, after signing',
          when: 'Right after',
          customerCan: 'See that it is signed and sign in to their portal.',
          guide: 'send-one-contract-to-one-person',
          reflects: ['Contract thank-you and the sign-in prompt'],
          render: { kind: 'page', path: CONTRACT_SAMPLE_DONE_PATH },
        },
      ],
    },
    {
      id: 'house',
      title: 'Supply house',
      subtitle: 'Sample Supply Co. · a quote request answered at the counter, and a job account',
      steps: [
        {
          id: 'quote-email',
          label: 'Quote request email',
          sublabel: 'Bids → Price requests → Ask houses (send-rfq-email), or the link pasted by hand',
          when: 'Bid week',
          customerCan: 'Open the quote page from the link.',
          guide: 'send-a-supply-house-a-quote-link',
          reflects: ['RFQ email wording', 'Sender name and email'],
          render: { kind: 'soon', note: 'The email a supply house gets with the quote link. Staff can also paste the link into their own email or text. Planned as PR 6.' },
        },
        {
          id: 'quote-page',
          label: 'Quote page',
          sublabel: '/q/:token — fixture names and counts, never prices',
          when: 'Same day',
          customerCan: 'Price each line on their phone, one at a time, and send the quote back.',
          guide: 'send-a-supply-house-a-quote-link',
          reflects: ['Scope lines', 'Needed-by date'],
          render: { kind: 'soon', note: 'The mobile page the counter fills in one line at a time. Needs a sample branch in get-rfq-quote-page. Planned as PR 6.' },
        },
        {
          id: 'quote-submitted',
          label: 'Submitted',
          sublabel: 'same page, after Send quote',
          when: 'After sending',
          customerCan: 'See that the quote went through.',
          guide: 'send-a-supply-house-a-quote-link',
          reflects: ['Thank-you wording'],
          render: { kind: 'soon', note: 'The page after the house sends its quote. Planned as PR 6.' },
        },
        {
          id: 'job-account-email',
          label: 'Job account email',
          sublabel: 'Jobs → Share with supply house (send-supply-house-job-account)',
          when: 'When a job opens an account',
          customerCan: 'Read which job is opening an account, who to bill, and the company particulars.',
          guide: 'share-job-with-supply-house',
          reflects: ['Job account email wording', 'Company particulars'],
          render: { kind: 'soon', note: 'The set-up email a supply house receives when a job opens an account with them, one email per house. Planned as PR 6.' },
        },
      ],
    },
    {
      id: 'firm',
      title: 'Collections law firm',
      subtitle: 'Sample & Partner, PLLC · every attorney-ready matter, and the emails that say something moved',
      steps: [
        {
          id: 'firm-confirm-email',
          label: 'Confirm email',
          sublabel: 'submit-legal-portal — nothing is sent before this is confirmed',
          when: 'Once, on setup',
          customerCan: 'Confirm their email address so matters can reach them.',
          guide: 'manage-who-at-the-law-firm-gets-emails',
          reflects: ['Firm email wording', 'Portal link'],
          render: { kind: 'soon', note: 'The one email a firm recipient must confirm before any matter reaches them. Sample mode on the dispatcher renders it. Planned as PR 6.' },
        },
        {
          id: 'firm-confirmed-page',
          label: 'Confirmed page',
          sublabel: '?confirm=<token> — the plain page behind that link',
          when: 'Once',
          customerCan: 'See that the address is confirmed, or paused after unsubscribe.',
          guide: 'manage-who-at-the-law-firm-gets-emails',
          reflects: ['Confirmed / unsubscribed page wording'],
          render: { kind: 'soon', note: 'The small page that says the address is confirmed, or paused after unsubscribe. Planned as PR 6.' },
        },
        {
          id: 'firm-portal',
          label: 'Firm portal',
          sublabel: '/legal — the five-section packet per matter',
          when: 'Any time',
          customerCan: 'Read every attorney-ready matter as one packet, record fees and steps, and ask the office a question.',
          guide: 'share-your-attorney-their-portal',
          reflects: ['Company particulars for filing', 'Held entries never leave'],
          render: { kind: 'soon', note: 'The firm\'s no-login portal: every attorney-ready matter as Account · Paper · Their word · Evidence · Fees & steps. The sample must be built from the fixture only; no real matter can reach this frame. Planned as PR 6.' },
        },
        {
          id: 'firm-now-email',
          label: 'Now email',
          sublabel: 'one per event, for recipients on "now"',
          when: 'As things move',
          customerCan: 'Learn that something moved on a matter and open the portal.',
          guide: 'manage-who-at-the-law-firm-gets-emails',
          reflects: ['Event wording'],
          render: { kind: 'soon', note: 'The short factual email a firm recipient on "now" gets per event. Planned as PR 6.' },
        },
        {
          id: 'firm-digest-email',
          label: 'Digest email',
          sublabel: 'one a day, for recipients on "digest"',
          when: 'Chosen weekdays',
          customerCan: 'Read the day\'s digest of every open matter and what changed.',
          guide: 'manage-who-at-the-law-firm-gets-emails',
          reflects: ['Digest wording', 'Digest weekdays and time'],
          render: { kind: 'soon', note: 'The daily digest: every open matter plus the events since the last one. Planned as PR 6.' },
        },
      ],
    },
  ]
}

/** The first step a viewer should land on: the first renderable one. */
export function firstRenderableStep(journeys: Journey[]): { journeyId: JourneyId; stepId: string } | null {
  for (const j of journeys) {
    for (const s of j.steps) {
      if (s.render.kind === 'page' || s.render.kind === 'email' || s.render.kind === 'paper') return { journeyId: j.id, stepId: s.id }
    }
  }
  return null
}

export function findStep(journeys: Journey[], journeyId: JourneyId, stepId: string): JourneyStep | null {
  return journeys.find((j) => j.id === journeyId)?.steps.find((s) => s.id === stepId) ?? null
}
