/**
 * The Sub NDA's send to a GC, as a sample (punch list #416, part 3): what Settings → What customers see draws for the
 * email a GC gets and for the block on the page they already open. Both are made up here, in the browser. No link,
 * table or function is read, so the sample shows the day this merges and needs no deploy.
 *
 * The builder on the sample page is the placeholder first draft, the same words **Load the first draft** writes. No
 * attorney has read them, and no clause wording is among them.
 *
 * Pure: no React, no supabase.
 */
import { customerBuildersFrom, type CustomerBuilder } from './customerPageBuilders'
import { SECRECY_PAPER_FIXTURE } from './secrecyPaper.fixture'
import { BUILDER_SEND_NOTE, builderSendEmail, type CustomerPageBuilder } from './sendWords'

/** The made-up send's id. The page never tells the office a sample was opened. */
export const SAMPLE_BUILDER_SEND_ID = 'sample-builder-send'

/** What the customer portal would answer for the sample GC: one builder, about all their jobs, at revision 1, not opened yet. */
export function sampleCustomerPageAnswer(): CustomerPageBuilder[] {
  return [{ sendId: SAMPLE_BUILDER_SEND_ID, builderKey: 'sub-nda', aboutJobId: null, aboutJob: null, revision: 1, contents: SECRECY_PAPER_FIXTURE, openedOn: null, opened: false, changed: false }]
}

/** The sample's builders as the page reads them: the made-up answer through the page's own parse, as a real answer goes. */
export function sampleCustomerBuilders(): CustomerBuilder[] {
  return customerBuildersFrom(sampleCustomerPageAnswer())
}

/**
 * The sample GC's page with the made-up builder on it. An answer that already carries a builder is left as it reads,
 * so a later sample from the function wins over this one.
 */
export function withSampleBuilders<T extends { builders: CustomerBuilder[] }>(payload: T): T {
  return payload.builders.length > 0 ? payload : { ...payload, builders: sampleCustomerBuilders() }
}

/** The first send's subject and lines, about all their jobs, on the note a send starts with. */
export function sampleBuilderSendWords(company: string): { subject: string; lines: string[] } {
  return builderSendEmail({ company, aboutJob: null, note: BUILDER_SEND_NOTE, why: 'first' })
}
