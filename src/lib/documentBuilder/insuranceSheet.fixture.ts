/**
 * The first draft of the standing sheet for insurance requirements for subs (punch list #404, step 3). The words were
 * written for this file. They are placeholders in plain words, and no insurance agent or attorney has read them. The
 * sample the owner gave came from another company: none of its wording or names is here, and none may be added.
 *
 * Every name and address is made up. Every amount is the placeholder `An amount`: the app sets no amount and offers
 * none, since an amount is a number the company's own agent sets. A sheet cannot be published while one is left.
 *
 * `sheet.ts` holds every rule and reads only the `SheetDef` exported here.
 */
import { SHEET_NEW, type SheetDef } from './sheet'

const CO = 'Acme Plumbing'

export const INSURANCE_SHEET_FIXTURE: SheetDef = {
  fields: {
    co: CO,
    addr1: '2200 Made Up Road',
    addr2: 'Austin, TX 78700',
    title: 'INSURANCE REQUIREMENTS',
    sub: 'For subcontractors on',
    lead: 'The certificate must name as additional insured:',
    at: 'for work at',
    holder: 'Certificate holder:',
    hName: CO,
    hAddr1: '2200 Made Up Road',
    hAddr2: 'Austin, TX 78700',
    colA: 'Coverage',
    colB: 'Least amount',
    foot: 'Ask your insurance agent what this line should say.',
  },
  open: [
    { key: 'o1', text: 'Before you start work, send us a certificate of insurance for this job.' },
    { key: 'o2', text: 'Keep it current while you are on the job. Send a new one when it renews or your insurer changes.' },
    { key: 'o3', text: 'Give this page to your insurance agent. It says what the certificate must show.' },
  ],
  cover: [
    { key: 'cgl', label: 'Commercial general liability', limit: SHEET_NEW.coverLimit },
    { key: 'auto', label: 'Commercial auto liability', limit: SHEET_NEW.coverLimit },
    { key: 'wc', label: "Workers' compensation", limit: SHEET_NEW.coverLimit },
    { key: 'el', label: "Employer's liability", limit: SHEET_NEW.coverLimit },
    { key: 'umb', label: 'Umbrella', limit: SHEET_NEW.coverLimit },
  ],
}
