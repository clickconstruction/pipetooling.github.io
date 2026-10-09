import { describe, expect, it } from 'vitest'
import { RUN_LABEL_HEADERS, runLabelCsv, runLabelFilename, runLabelRows, runLabelSavedWords, splitCityStateZip } from './lienRunLabels'
import { runMailing } from './lienRunPaper'
import { runEnvelopes } from './runEnvelopes'
import type { RunNotice, RunRecipient } from './lienDeskRun'
import { plainWordsFailures } from '../plainWords'

const owner = (over: Partial<RunRecipient> = {}): RunRecipient => ({ key: 'owner', label: 'Owner of record', name: 'TC/JP SEGUIN 2019 LLC', address: '9993 IH 10 WEST SUITE 102, SAN ANTONIO, TX 78230', email: '', method: 'certified_mail', tracking: '', ...over })
const gc = (over: Partial<RunRecipient> = {}): RunRecipient => ({ key: 'original_contractor', label: 'Original contractor', name: 'Southern Post Construction', address: '2209 N. 23rd St., McAllen, TX 78501', email: 'ap@southernpost.test', method: 'certified_mail', tracking: '', ...over })
const notice = (over: Partial<RunNotice> = {}): RunNotice => ({
  itemId: 'it878', jobId: 'j878', kind: 'notice_53_056', label: '878 · Take 5- Seguin', jobNumber: '878', months: ['2026-09'], amount: 38625,
  fields: { noticeDate: '2026-09-24', projectDescription: 'Take 5', claimantName: 'Click', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Southern Post Construction', contractedWithIfDifferent: '', claimAmount: '38625.00', contactPerson: 'M', claimantAddress: '5501 Balcones Dr' },
  extras: {}, coverLetter: null, coverNote: null, ownerUnconfirmed: false, recipients: [owner(), gc()], ...over,
})

describe('the run’s addresses for the label service (v2.4977)', () => {
  it('splits city, state and ZIP, and leaves a line that is not that shape as the city', () => {
    expect(splitCityStateZip('SAN ANTONIO, TX 78230')).toEqual({ city: 'SAN ANTONIO', state: 'TX', zip: '78230' })
    expect(splitCityStateZip('Buda TX 78610')).toEqual({ city: 'Buda', state: 'TX', zip: '78610' })
    expect(splitCityStateZip('AUSTIN, TX 78755-8054')).toEqual({ city: 'AUSTIN', state: 'TX', zip: '78755-8054' })
    expect(splitCityStateZip('Schertz, TX')).toEqual({ city: 'Schertz, TX', state: '', zip: '' })
  })

  it('an address typed with no comma before the city takes the city from the line before (Loberg on the live run)', () => {
    const [env] = runEnvelopes([notice({ recipients: [gc({ name: 'Loberg Contracting', address: '311 E Illinois Ave. Palatine, Il 60067' })] })])
    expect(runLabelRows(runMailing([env!]))[0]).toMatchObject({ line1: '311 E Illinois Ave.', line2: '', city: 'Palatine', state: 'IL', zip: '60067' })
  })

  it('one row per envelope that goes out on paper, numbered as the sheet is, with the jobs inside as the reference; held, email and hand envelopes are left out', () => {
    const envs = runEnvelopes([
      notice(),
      notice({ itemId: 'it898', jobId: 'j898', label: '898 · Reliant', jobNumber: '898', amount: 4800, recipients: [owner({ name: 'SABRA TEXAS HOLDINGS LP', address: '% SABRA HEALTH CARE REIT INC, 18500 VON KARMAN AVE STE 550, IRVINE, CA 92612' }), gc()] }),
      notice({ itemId: 'it1008', jobId: 'j1008', label: '1008 · Trip', jobNumber: '1008', amount: 0, recipients: [gc({ name: 'RMC- Dudley Mason', address: '', email: '' })] }),
      notice({ itemId: 'it5', jobId: 'j5', label: '5 · Hand', jobNumber: '5', amount: 100, recipients: [owner({ name: 'Walk In', address: '1 Main St, Kyle, TX 78640', method: 'hand' })] }),
    ])
    const rows = runLabelRows(runMailing(envs))
    expect(rows).toEqual([
      { envelope: 1, name: 'TC/JP SEGUIN 2019 LLC', line1: '9993 IH 10 WEST SUITE 102', line2: '', city: 'SAN ANTONIO', state: 'TX', zip: '78230', reference: 'Envelope 1 · 878' },
      { envelope: 2, name: 'Southern Post Construction', line1: '2209 N. 23rd St.', line2: '', city: 'McAllen', state: 'TX', zip: '78501', reference: 'Envelope 2 · 878, 898' },
      { envelope: 3, name: 'SABRA TEXAS HOLDINGS LP', line1: '% SABRA HEALTH CARE REIT INC', line2: '18500 VON KARMAN AVE STE 550', city: 'IRVINE', state: 'CA', zip: '92612', reference: 'Envelope 3 · 898' },
    ])
  })

  it('the CSV carries the vendor’s headers, a BOM, and quotes a field with a comma', () => {
    const csv = runLabelCsv([{ envelope: 1, name: 'Smith, John & Jane', line1: '1 Main St', line2: '', city: 'Kyle', state: 'TX', zip: '78640', reference: 'Envelope 1 · 5' }])
    expect(csv.startsWith('﻿' + RUN_LABEL_HEADERS.join(','))).toBe(true)
    expect(csv).toContain('\r\n,"Smith, John & Jane",1 Main St,,Kyle,TX,78640,,Envelope 1 · 5\r\n')
    expect(runLabelFilename('2026-10-08')).toBe('certified-labels_2026-10-08.csv')
    expect(runLabelSavedWords(13)).toBe('Saved 13 addresses for the label service. Upload the file as a batch.')
    expect(runLabelSavedWords(1)).toMatch(/^Saved 1 address /)
    for (const w of [runLabelSavedWords(13), runLabelSavedWords(0)]) expect(plainWordsFailures(w)).toEqual([])
  })
})
