import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUNCTIONS = join(__dirname, '..', '..', '..', 'supabase', 'functions')
const read = (slug: string) => readFileSync(join(FUNCTIONS, slug, 'index.ts'), 'utf8')

/**
 * The customer's thread gets a line when an agreement goes and a line when it is signed (the guide *send a homeowner
 * the warranty*, "What it leaves behind"; GLOSSARY → Warranty in place of a contract). send-job-contract writes the
 * sent line for the link send and sign-job-contract the signed line, both through `_shared/jobContractThreadLine.ts`;
 * the On paper send (share-job-contract `send_to_sign`) wrote none until v2.6489. Read from the sources since the
 * functions run in Deno.
 */
describe('the thread line an agreement send leaves', () => {
  it.each(['send-job-contract', 'share-job-contract'])('%s imports the shared writer', (slug) => {
    expect(read(slug)).toContain("import { writeJobAgreementThreadLine } from '../_shared/jobContractThreadLine.ts'")
  })

  it('the On paper send writes the sent line with the row’s kind, its heading and the send’s time, after the email went', () => {
    const source = read('share-job-contract')
    const branch = source.slice(source.indexOf('// send_to_sign:'), source.indexOf('let pdf: Uint8Array | null = null'))
    expect(branch).toContain('writeJobAgreementThreadLine(admin, {')
    const call = branch.slice(branch.indexOf('writeJobAgreementThreadLine(admin, {'))
    const line = call.slice(0, call.indexOf('\n'))
    expect(line).toContain("event: 'sent'")
    expect(line).toContain('kind: draftKind')
    expect(line).toContain('heading: agreementHeading(draftKind, jobRow)')
    expect(line).toContain('sentAtIso: nowIsoPaper')
    expect(line).toContain('signerName: null')
    // A line must never say the paper went when it did not: the email goes first, then the event, then the line.
    expect(branch.indexOf('sendEmailViaResend(')).toBeLessThan(branch.indexOf("event_type: 'sent'"))
    expect(branch.indexOf("event_type: 'sent'")).toBeLessThan(branch.indexOf('writeJobAgreementThreadLine('))
  })

  it('the link send writes the same line', () => {
    const line = read('send-job-contract').split('\n').find((l) => l.includes('writeJobAgreementThreadLine(admin, {')) ?? ''
    expect(line).toContain("event: 'sent'")
    expect(line).toContain('signerName: null')
  })
})
