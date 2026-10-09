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

export type SampleEmailId = 'estimate' | 'bid-room' | 'bid-room-revised' | 'contract' | 'job-contract' | 'job-contract-paper' | 'job-contract-reminder' | 'job-contract-signed-copy' | 'test-report' | 'pricing-package' | 'gc-statement' | 'rfq-request' | 'job-account' | 'legal-welcome' | 'legal-confirm' | 'legal-now' | 'legal-digest' | 'bill-email' | 'gc-plan-question' | 'gc-trade-email' | 'gc-pay-app' | 'gc-certify-ask' | 'gc-certified' | 'gc-change-order' | 'gc-reminder' | 'gc-interest-bill' | 'submittal-room-link'

/** Every email the tab builds in the browser — the order it builds them in. */
export const SAMPLE_EMAIL_IDS: readonly SampleEmailId[] = ['estimate', 'bid-room', 'bid-room-revised', 'contract', 'job-contract', 'job-contract-paper', 'job-contract-reminder', 'job-contract-signed-copy', 'test-report', 'pricing-package', 'gc-statement', 'rfq-request', 'job-account', 'legal-welcome', 'legal-confirm', 'legal-now', 'legal-digest', 'bill-email', 'gc-plan-question', 'gc-trade-email', 'gc-pay-app', 'gc-certify-ask', 'gc-certified', 'gc-change-order', 'gc-reminder', 'gc-interest-bill', 'submittal-room-link']

export type JourneyStepRender =
  | { kind: 'page'; path: string; /** v2.3512: `path` is a full URL on another origin (a page an edge function serves). */ absolute?: boolean }
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
/** The pay page (punch list #35, v2.3754) renders a sample bill for the sample token and never forwards. */
export const PAY_SAMPLE_PATH = `/pay/${SAMPLE_TOKEN}`
export const ESTIMATE_SAMPLE_DONE_PATH = `/estimate/accept?t=${SAMPLE_TOKEN_DONE}`
/** The public terms page reads the live Settings; the token is only so the tab treats it like every other sample page. */
export const ESTIMATE_TERMS_SAMPLE_PATH = `/estimate/terms?t=${SAMPLE_TOKEN}`
export const BID_ROOM_SAMPLE_PATH = `/bid-room?t=${SAMPLE_TOKEN}`
export const BID_ROOM_SAMPLE_DONE_PATH = `/bid-room?t=${SAMPLE_TOKEN_DONE}`
export const CUSTOMER_PORTAL_SAMPLE_PATH = `/portal?t=${SAMPLE_TOKEN}`
export const GC_PORTAL_SAMPLE_PATH = `/portal?t=${SAMPLE_TOKEN_GC}`
export const SUB_PORTAL_SAMPLE_PATH = `/sub?t=${SAMPLE_TOKEN}`
/** GC mode's trade partner portal (P1b-ii-b): `gc-trade-portal` answers the sample token with a made-up company. */
export const TRADE_PORTAL_SAMPLE_PATH = `/t/${SAMPLE_TOKEN}`
export const CONTRACT_SAMPLE_PATH = `/contract/accept?t=${SAMPLE_TOKEN}`
export const CONTRACT_SAMPLE_DONE_PATH = `/contract/accept?t=${SAMPLE_TOKEN_DONE}`
/** The customer's own agreement (v2.3510) — not the sub's contract above. */
export const JOB_CONTRACT_SAMPLE_PATH = `/contract/sign?t=${SAMPLE_TOKEN}`
export const JOB_CONTRACT_SAMPLE_DONE_PATH = `/contract/sign?t=${SAMPLE_TOKEN_DONE}`
/** The GC's submittal review room (v2.3511): open, and after the architect's review. */
export const SUBMITTAL_ROOM_SAMPLE_PATH = `/submittal?t=${SAMPLE_TOKEN}`
export const SUBMITTAL_ROOM_SAMPLE_DONE_PATH = `/submittal?t=${SAMPLE_TOKEN_DONE}`
/** The supply house's quote page (v2.3512): open, and with the house's own last prices on offer. */
export const RFQ_SAMPLE_PATH = `/q/${SAMPLE_TOKEN}`
export const RFQ_SAMPLE_DONE_PATH = `/q/${SAMPLE_TOKEN_DONE}`
/** The collections law firm's portal (v2.3512) — with one sample matter since v2.3639. */
export const LEGAL_PORTAL_SAMPLE_PATH = `/legal?t=${SAMPLE_TOKEN}`
/** The page the firm's confirm link lands on (v2.3521 — the app serves it; the function's HTML was relayed as text/plain). */
export const LEGAL_CONFIRMED_SAMPLE_PATH = `/legal/confirm?t=${SAMPLE_TOKEN}`

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
          sublabel: 'the Terms link on the accept page',
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
          sublabel: 'Jobs → Contract sweep → Send',
          when: 'Before work starts',
          customerCan: 'Open the service agreement from the link in the email.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Standard terms (the customer Contract Book document, or the built-in wording)', 'Sender name and email'],
          render: { kind: 'email', email: 'job-contract' },
        },
        {
          id: 'job-contract-paper-email',
          label: 'Agreement PDF',
          sublabel: 'Jobs → Contract sweep → Email the PDF to sign',
          when: 'Before work starts',
          customerCan: 'Print the attached agreement, sign and date it, and send it back — or sign on a screen from the link under it.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Standard terms (the customer Contract Book document, or the built-in wording)', 'Sender name and email'],
          render: { kind: 'email', email: 'job-contract-paper' },
        },
        {
          id: 'job-contract-page',
          label: 'Agreement to sign',
          sublabel: 'the link in that email',
          when: 'Same day',
          customerCan: 'Read the scope, the amount and the payment line, open the full terms, and sign on the page.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Standard terms', 'Payment line (50% down · on completion · progress)', 'Letterhead'],
          render: { kind: 'page', path: JOB_CONTRACT_SAMPLE_PATH },
        },
        {
          id: 'job-contract-reminder',
          label: 'Reminder',
          sublabel: 'sent by the app when an agreement sits unsigned a few days',
          when: 'Days later',
          customerCan: 'Be reminded that the agreement is still waiting, with the same link.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Reminder cadence', 'Sender name and email'],
          render: { kind: 'email', email: 'job-contract-reminder' },
        },
        {
          id: 'job-contract-signed',
          label: 'Signed',
          sublabel: 'same page, after signing',
          when: 'After signing',
          customerCan: 'See the signed agreement on the page, any time, from the same link.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Signed banner wording'],
          render: { kind: 'page', path: JOB_CONTRACT_SAMPLE_DONE_PATH },
        },
        {
          id: 'job-contract-signed-email',
          label: 'Signed copy',
          sublabel: 'sent by the app the moment they sign · Share on the signed agreement sends it again',
          when: 'Right after signing',
          customerCan: 'Keep the signed PDF from the email; the link in it stays live.',
          guide: 'get-a-job-contract-signed',
          reflects: ['Sender name and email'],
          render: { kind: 'email', email: 'job-contract-signed-copy' },
        },
        {
          id: 'bill-email',
          label: 'Bill email',
          sublabel: 'Send Email invoice on a Stripe bill',
          when: 'After the work',
          customerCan: 'See the amount and the due date, press Pay now to pay by card or bank on Stripe, keep the attached PDF, and scan the code or type the short address to open their statement.',
          guide: 'turn-a-bill-into-a-stripe-bill',
          reflects: ['Company name and phone', 'Sender name and email (replies go to whoever sent it)'],
          render: { kind: 'email', email: 'bill-email' },
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
          id: 'pay-code',
          label: 'Pay code',
          sublabel: 'the QR code on a lien notice, or from View bill → /pay/…',
          when: 'After the work',
          customerCan: "Scan the code (or type the address) and land on a page that names the bill and what is still owed, then opens Stripe's payment page — with a Pay now button if the forward is blocked. A bill already paid says Paid.",
          guide: 'ready-to-bill-pipeline',
          reflects: ['Company name and phone (the page and its Call button)'],
          render: { kind: 'page', path: PAY_SAMPLE_PATH },
        },
        {
          id: 'hazmat-notice',
          label: 'Hazmat notice',
          sublabel: 'the notice link on the invoice, and its companion email',
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
          sublabel: 'when it goes wrong · Legal desk → Email with the PDF',
          when: 'Past due',
          customerCan: 'Read the final demand, the statement of account and the invoice, and pay or respond by the deadline.',
          guide: 'send-a-final-demand-letter',
          reflects: ['Demand letter wording and the legal lines', 'Statement of account', 'Collections law firm named'],
          render: { kind: 'paper', paper: 'demand-letter' },
        },
        {
          id: 'lien-release',
          label: 'Lien release',
          sublabel: 'when it is over · Lien release → Send',
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
          sublabel: 'Bids → Pricing → Send package',
          when: 'Bid day, when asked for the breakdown',
          customerCan: 'Open the Job Plans link and read the four-column pricing breakdown.',
          guide: 'send-a-bid-pricing-package',
          reflects: ['Pricing package wording', 'Sender name and email'],
          render: { kind: 'email', email: 'pricing-package' },
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
          id: 'submittal-room-email',
          label: 'Submittal link email',
          sublabel: 'Bids → Submittals → Share → Send the link, or the box on the Share window',
          when: 'After award, when a revision is shared',
          customerCan: 'Open their own link to the review room, and reply to the person who sent it.',
          guide: 'build-a-submittal-package',
          reflects: ['Company name and phone', 'Sender name and email'],
          render: { kind: 'email', email: 'submittal-room-link' },
        },
        {
          id: 'submittal-room',
          label: 'Submittal review room',
          sublabel: 'Bids → Submittals → Share — the one link the GC forwards to the architect',
          when: 'After award',
          customerCan: 'Read the product decisions in plain words, see which rows match the plans, and download the package.',
          guide: 'build-a-submittal-package',
          reflects: ['Product rows in the customer\'s words', 'The package PDF'],
          render: { kind: 'page', path: SUBMITTAL_ROOM_SAMPLE_PATH },
        },
        {
          id: 'submittal-decided',
          label: 'Their call back',
          sublabel: 'same room, after Send my review',
          when: 'Days later',
          customerCan: 'See the calls they made, who made them, and the summary they sent back.',
          guide: 'build-a-submittal-package',
          reflects: ['Decision labels and the summary'],
          render: { kind: 'page', path: SUBMITTAL_ROOM_SAMPLE_DONE_PATH },
        },
        {
          id: 'test-report-email',
          label: 'Test report email',
          sublabel: 'Stages → Test report → Send to the GC',
          when: 'Each test',
          customerCan: 'Read the test report and pay the bill from the link in the email.',
          guide: 'file-a-test-report',
          reflects: ['Test report paper (the sample card above opens it)', 'Stripe pay link in the body', 'Sender name and email'],
          render: { kind: 'email', email: 'test-report' },
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
          sublabel: 'GC Review → Certify, or the monthly round',
          when: 'Monthly',
          customerCan: 'Read the certified statement of what they owe across their jobs and pay from the link.',
          guide: 'run-your-gc-statement-round',
          reflects: ['Statement letterhead', 'Statement email wording', 'Sender name and email'],
          render: { kind: 'email', email: 'gc-statement' },
        },
        {
          id: 'plan-question-email',
          label: 'Question about the plans',
          sublabel: 'GC mode · GC projects → Questions → Send to the architect',
          when: 'While we bid a GC job',
          customerCan: 'Read the question a company asked about the plans and answer it by replying; the answer reaches every company quoting the trade and rides in the next set.',
          guide: 'ask-the-architect-about-the-plans',
          reflects: ['The project manager on the GC project (the Reply-To)', 'Sender name'],
          render: { kind: 'email', email: 'gc-plan-question' },
        },
        {
          id: 'gc-pay-app-email',
          label: 'GC mode: our pay application',
          sublabel: 'GC projects → Bill the customer → Send pay application, with the email tick on',
          when: 'Once a month, on bill day',
          customerCan: 'Read what the pay application asks and why, with its form attached. The bill to pay comes once the architect certifies it.',
          guide: 'bill-the-customer-on-a-gc-job',
          reflects: ['The pay application as it went', 'The project manager on the GC project (the Reply-To and the signer)'],
          render: { kind: 'email', email: 'gc-pay-app' },
        },
        {
          id: 'gc-certify-ask-email',
          label: 'GC mode: please certify',
          sublabel: 'The same Send, to the project\'s architect',
          when: 'With each pay application',
          customerCan: 'Read what we asked the customer for, check the form attached, and reply with the certificate.',
          guide: 'bill-the-customer-on-a-gc-job',
          reflects: ['The pay application as it went', 'The architect on the GC project'],
          render: { kind: 'email', email: 'gc-certify-ask' },
        },
        {
          id: 'gc-certified-email',
          label: 'GC mode: the certified bill',
          sublabel: 'GC projects → Bill the customer → Record the certificate, with the email tick on',
          when: 'When the architect certifies a pay application',
          customerCan: 'Read what the architect certified and when we expect it, then reply with the day they will pay. Their portal link shows when they have one.',
          guide: 'bill-the-customer-on-a-gc-job',
          reflects: ['The certificate as recorded', 'The customer’s usual days to pay', 'The customer’s portal link, when one is on'],
          render: { kind: 'email', email: 'gc-certified' },
        },
        {
          id: 'gc-change-order-email',
          label: 'GC mode: a change order to sign',
          sublabel: 'GC projects → Change orders → Send for signature, with the email tick on',
          when: 'When the job changes',
          customerCan: 'Read the change, what it adds to the price and to the job, and reply to sign it or ask.',
          guide: 'change-our-contract-with-the-customer',
          reflects: ['The change order as sent', 'The project manager on the GC project (the Reply-To and the signer)'],
          render: { kind: 'email', email: 'gc-change-order' },
        },
        {
          id: 'gc-reminder-email',
          label: 'GC mode: a reminder to pay',
          sublabel: 'GC projects → Bill the customer → Remind them to pay, on a late bill',
          when: 'Once a certified bill is past the day it was due',
          customerCan: 'Read what is still open and the day we ask them to pay by, then reply with the day they will pay. Their portal link shows when they have one.',
          guide: 'remind-a-customer-to-pay-a-gc-bill',
          reflects: ['The bill as certified, less what they paid', 'The pay-by day and the office’s own line', 'The customer’s portal link, when one is on'],
          render: { kind: 'email', email: 'gc-reminder' },
        },
        {
          id: 'gc-interest-bill-email',
          label: 'GC mode: our bill for the interest',
          sublabel: 'GC projects → Bill the customer → Bill the interest, with the email tick on',
          when: 'When interest has built up on late bills, on a job that charges it',
          customerCan: 'Read what the interest on their late bills comes to and the rate, then reply with the day they will pay. Their portal link shows when they have one.',
          guide: 'bill-the-customer-on-a-gc-job',
          reflects: ['The job’s rate and the contract’s days to pay', 'What built up and was not billed yet', 'The customer’s portal link, when one is on'],
          render: { kind: 'email', email: 'gc-interest-bill' },
        },
        {
          id: 'owner-notice',
          label: 'Notice to the owner of record',
          sublabel: 'when it goes wrong · Lien desk → the § 53.056 notice',
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
          id: 'gc-trade-portal',
          label: 'GC mode: a trade partner\'s portal',
          sublabel: 'GC projects → a company’s name → Their portal → Copy link (devs only for now)',
          when: 'From the first ask to quote',
          customerCan: 'See every ask to quote with its plans and scope lines, then send a quote, give a quote day, pass, ask about the plans and pick who gets our emails.',
          guide: 'share-a-trade-partner-its-portal',
          reflects: ['The company\'s asks, plans and questions on GC projects', 'Who gets our emails at the company'],
          render: { kind: 'page', path: TRADE_PORTAL_SAMPLE_PATH },
        },
        {
          id: 'gc-trade-email',
          label: 'GC mode: an email to a trade partner',
          sublabel: 'GC projects → Ask for quotes, a new set, an answer (devs only for now)',
          when: 'Each time we ask, remind, send plans or answer',
          customerCan: 'Read what we want and open its portal from the button. Every email carries the same link.',
          guide: 'email-a-trade-partner-from-gc-mode',
          reflects: ['The kind of email and who at the company gets it', 'The project manager on the GC project (the Reply-To and the signer)'],
          render: { kind: 'email', email: 'gc-trade-email' },
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
          sublabel: 'Bids → Price requests → Ask houses, or the link pasted by hand',
          when: 'Bid week',
          customerCan: 'Open the quote page from the link.',
          guide: 'send-a-supply-house-a-quote-link',
          reflects: ['RFQ email wording', 'Sender name and email'],
          render: { kind: 'email', email: 'rfq-request' },
        },
        {
          id: 'quote-page',
          label: 'Quote page',
          sublabel: 'the link in that email — names and counts, never prices',
          when: 'Same day',
          customerCan: 'Price each line on their phone, one at a time, and send the quote back.',
          guide: 'send-a-supply-house-a-quote-link',
          reflects: ['Scope lines', 'Needed-by date'],
          render: { kind: 'page', path: RFQ_SAMPLE_PATH },
        },
        {
          id: 'quote-submitted',
          label: 'Submitted',
          sublabel: 'same page, after Send quote',
          when: 'After sending',
          customerCan: 'See that the quote went through.',
          guide: 'send-a-supply-house-a-quote-link',
          reflects: ['Thank-you wording'],
          render: { kind: 'page', path: RFQ_SAMPLE_DONE_PATH },
        },
        {
          id: 'job-account-email',
          label: 'Job account email',
          sublabel: 'Jobs → Share with supply house',
          when: 'When a job opens an account',
          customerCan: 'Read which job is opening an account, who to bill, and the company particulars.',
          guide: 'share-job-with-supply-house',
          reflects: ['Job account email wording', 'Company particulars'],
          render: { kind: 'email', email: 'job-account' },
        },
      ],
    },
    {
      id: 'firm',
      title: 'Collections law firm',
      subtitle: 'Sample & Partner, PLLC · every attorney-ready matter, and the emails that say something moved',
      steps: [
        {
          id: 'firm-welcome-email',
          label: 'Welcome email',
          sublabel: 'Legal desk → Firm’s link → Send the firm their link',
          when: 'Once, on setup, and after a Rotate',
          customerCan: 'Learn who we are and what the portal is, open their link, and add the people who should hear from us.',
          guide: 'share-your-attorney-their-portal',
          reflects: ['Welcome email wording', 'Portal link', 'The sender’s name and phone'],
          render: { kind: 'email', email: 'legal-welcome' },
        },
        {
          id: 'firm-confirm-email',
          label: 'Confirm email',
          sublabel: 'sent when the firm adds a person on its portal — nothing else goes out until they confirm',
          when: 'Once, on setup',
          customerCan: 'Confirm their email address so matters can reach them.',
          guide: 'manage-who-at-the-law-firm-gets-emails',
          reflects: ['Firm email wording', 'Portal link'],
          render: { kind: 'email', email: 'legal-confirm' },
        },
        {
          id: 'firm-confirmed-page',
          label: 'Confirmed page',
          sublabel: 'the page behind the Yes, email me button',
          when: 'Once',
          customerCan: 'See that the address is confirmed, or paused after unsubscribe.',
          guide: 'manage-who-at-the-law-firm-gets-emails',
          reflects: ['Confirmed / unsubscribed page wording'],
          render: { kind: 'page', path: LEGAL_CONFIRMED_SAMPLE_PATH },
        },
        {
          id: 'firm-portal',
          label: 'Firm portal',
          sublabel: 'the one link the office shares with the firm — every matter as one packet',
          when: 'Any time',
          customerCan: 'Read every attorney-ready matter as one packet, record fees and steps, and ask the office a question.',
          guide: 'share-your-attorney-their-portal',
          reflects: ['Company particulars for filing', 'Held entries never leave'],
          render: { kind: 'page', path: LEGAL_PORTAL_SAMPLE_PATH },
        },
        {
          id: 'firm-now-email',
          label: 'Now email',
          sublabel: 'one per event, for people on "now"',
          when: 'As things move',
          customerCan: 'Learn that something moved on a matter and open the portal.',
          guide: 'manage-who-at-the-law-firm-gets-emails',
          reflects: ['Event wording'],
          render: { kind: 'email', email: 'legal-now' },
        },
        {
          id: 'firm-digest-email',
          label: 'Digest email',
          sublabel: 'one a day, for people on "digest"',
          when: 'Chosen weekdays',
          customerCan: 'Read the day\'s digest of every open matter and what changed.',
          guide: 'manage-who-at-the-law-firm-gets-emails',
          reflects: ['Digest wording', 'Digest weekdays and time'],
          render: { kind: 'email', email: 'legal-digest' },
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
