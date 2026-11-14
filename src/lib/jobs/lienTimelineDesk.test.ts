import { describe, expect, it } from 'vitest'
import { buildLienTimelineFromDesk, buildLienTimelineFromWindow, lienTimelineMonthsFromDesk, lienWindowDeskAffidavit, lienWindowDeskNotice } from './lienTimelineDesk'
import type { LienAffidavitEntry, LienAffidavitGateKey } from './lienDeskAffidavits'
import type { LienDeskItemRow, LienNoticeMonthRow } from './lienDesk'
import type { JobLienFilingRow } from './lienDeadlines'
import type { JobWorkMonths } from './forecastWorkMonths'

const TODAY = '2026-09-23'
const filing = (over: Partial<JobLienFilingRow>): JobLienFilingRow =>
  ({ id: 'f', job_id: 'j1', kind: 'notice_53_056', amount: 0, county: '', created_at: '2026-09-01T12:00:00Z', created_by: null, fields: {}, filed_at: '2026-09-01', invoice_ids: [], months_covered: [], recording_number: '', sends: [], serve_due: null, served_at: null, voided_at: null, ...over }) as JobLienFilingRow

const month = (key: string, due: string, daysLeft: number): JobWorkMonths['months'][number] => ({ key, label: key, weeks: [], people: ['M'], hours: 20, pendingHours: 0, dayCount: 3, hoursShare: 50, notice: { due, daysLeft, state: daysLeft < 0 ? 'closed' : 'open' } as never })

describe('buildLienTimelineFromWindow (v2.3781)', () => {
  it('reads the months from the forecast’s sessions and the sent ones from the notice filings; a closed month says only that the window closed', () => {
    const wm: JobWorkMonths = { jobId: 'j1', role: 'sub', propertyKind: 'non_residential', months: [month('2026-06', '2026-09-15', -8), month('2026-07', '2026-10-15', 22)], totalHours: 40, sessionCount: 6, pendingSessions: 0, lastMonthKey: '2026-07', affidavitDue: '2026-11-16' }
    const t = buildLienTimelineFromWindow({ workMonths: wm, filings: [filing({ months_covered: ['2026-07'] })], job: { id: 'j1', created_at: '2026-05-02T00:00:00Z', last_work_date: '2026-07-20' }, isSub: true, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY })
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]))
    expect(by['notice:2026-06']!.state).toBe('missed')
    expect(by['notice:2026-06']!.words).toBe('window closed')
    expect(by['notice:2026-07']!.state).toBe('done')
    expect(by['affidavit']!.date).toBe('2026-11-16')
    expect(t.next.kind).toBe('affidavit')
    expect(t.next.aside).toBe('')
  })
  it('a job with no sessions is dated from its creation month, and a filed affidavit runs the tail', () => {
    const t = buildLienTimelineFromWindow({ workMonths: null, filings: [], job: { id: 'j1', created_at: '2026-07-09T14:00:00Z', last_work_date: null }, isSub: true, propertyKind: '', openBalance: 4_100, todayYmd: TODAY })
    expect(t.steps[0]!.words).toBe('dated from the job’s creation · no clock hours')
    // No kind set: July's notice dates as residential, the 2nd month (v2.5031); commercial would be Oct 15.
    expect(t.steps.find((s) => s.kind === 'notice')?.date).toBe('2026-09-15')
    expect(t.kindUnknown).toBe(true)
    const filed = buildLienTimelineFromWindow({ workMonths: null, filings: [filing({ id: 'a', kind: 'affidavit', filed_at: '2026-07-14', served_at: '2026-07-16', recording_number: '2026-0412', county: 'Comal' })], job: { id: 'j1', created_at: '2026-01-05T00:00:00Z', last_work_date: '2026-03-28' }, isSub: true, propertyKind: 'non_residential', openBalance: 12_400, todayYmd: TODAY })
    expect(filed.steps.find((s) => s.kind === 'affidavit')?.dateWords).toBe('filed Jul 14')
    expect(filed.steps.find((s) => s.kind === 'suit')?.date).toBe('2027-07-15')
    expect(filed.next.kind).toBe('suit')
  })
  it('a direct job’s sessions still fold into months, and the path names no § 53.056 notice on them (v2.6102, punch list #213)', () => {
    const wm: JobWorkMonths = { jobId: 'j1', role: 'direct', propertyKind: 'non_residential', months: [month('2026-07', '2026-10-15', 22), month('2026-08', '2026-11-16', 54)], totalHours: 40, sessionCount: 6, pendingSessions: 0, lastMonthKey: '2026-08', affidavitDue: '2026-12-15' }
    const t = buildLienTimelineFromWindow({ workMonths: wm, filings: [], job: { id: 'j1', created_at: '2026-05-02T00:00:00Z', last_work_date: '2026-08-20' }, isSub: false, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY })
    expect(t.steps.filter((s) => s.kind === 'notice').map((s) => s.words)).toEqual(['not required · contracted with the owner'])
    expect(t.next.kind).toBe('affidavit')
    expect(t.waitingOn?.words).toBe('the affidavit to be filed')
  })
})

describe('the demand letter through the window adapter (v2.3877)', () => {
  const letter = (over: Partial<import('./demandLetterTracking').JobDemandLetterRow> = {}) =>
    ({ id: 'd1', job_id: 'j1', amount: 8940, created_at: '2026-09-14T16:00:00Z', created_by: null, deadline_date: '2026-09-28', debtor_party: 'gc', exhibits: [], fields: {}, invoice_ids: ['i1'], recipient_address: '', recipient_email: '', recipient_name: 'Dunmere Mallin', sent_at: '2026-09-14T16:10:00Z', sent_method: 'certified', tracking_number: '', voided_at: null, ...over }) as import('./demandLetterTracking').JobDemandLetterRow
  it('folds the live sent letters, owing up to the job’s balance; a voided letter is dropped; no letters draws nothing', () => {
    const src = { workMonths: null, filings: [], job: { id: 'j1', created_at: '2026-06-09T14:00:00Z', last_work_date: '2026-07-30' }, isSub: true, propertyKind: 'non_residential', openBalance: 8_940, todayYmd: TODAY }
    const t = buildLienTimelineFromWindow({ ...src, demandLetters: [letter(), letter({ id: 'old', voided_at: '2026-09-15T00:00:00Z', sent_at: '2026-09-01T00:00:00Z' })] })
    expect(t.steps.find((s) => s.kind === 'demand')).toMatchObject({ state: 'due', dateWords: 'reply by Sep 28', move: 'gc' })
    expect(t.waitingOn?.who).toBe('gc')
    const paid = buildLienTimelineFromWindow({ ...src, openBalance: 0, demandLetters: [letter()] })
    expect(paid.steps.find((s) => s.kind === 'demand')).toMatchObject({ state: 'done', dateWords: 'paid' })
    expect(buildLienTimelineFromWindow(src).steps.some((s) => s.kind === 'demand')).toBe(false)
  })
})

describe('an evening instant keeps its day on the timeline (v2.4468)', () => {
  // 00:30 UTC is 7:30 pm CDT (6:30 pm CST in winter) the evening before.
  it('dates a job with no sessions from its creation month in the company calendar, as list_lien_notice_months does', () => {
    const fromCreation = (created_at: string) => buildLienTimelineFromWindow({ workMonths: null, filings: [], job: { id: 'j1', created_at, last_work_date: null }, isSub: true, propertyKind: 'non_residential', openBalance: 4_100, todayYmd: TODAY }).steps.find((s) => s.kind === 'notice')
    expect(fromCreation('2026-10-01T00:30:00Z')).toMatchObject({ key: 'notice:2026-09', date: '2026-12-15' })
    expect(fromCreation('2026-12-01T00:30:00+00:00')?.key).toBe('notice:2026-11')
    expect(fromCreation('2026-10-01T12:00:00Z')?.key).toBe('notice:2026-10')
  })

  it('reads a notice and a release with no filed day by the day their rows were made', () => {
    const wm: JobWorkMonths = { jobId: 'j1', role: 'sub', propertyKind: 'non_residential', months: [month('2026-07', '2026-10-15', 22)], totalHours: 20, sessionCount: 3, pendingSessions: 0, lastMonthKey: '2026-07', affidavitDue: '2026-11-16' }
    const job = { id: 'j1', created_at: '2026-06-09T14:00:00Z', last_work_date: '2026-07-20' }
    const notice = filing({ id: 'n', months_covered: ['2026-07'], filed_at: null, created_at: '2026-09-16T00:30:00Z' })
    const t = buildLienTimelineFromWindow({ workMonths: wm, filings: [notice], job, isSub: true, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY })
    expect(t.steps.find((s) => s.key === 'notice:2026-07')?.words).toBe('sent Sep 15')
    const affidavit = filing({ id: 'a', kind: 'affidavit', filed_at: '2026-07-14', served_at: '2026-07-16' })
    const release = filing({ id: 'r', kind: 'release_of_record', filed_at: null, created_at: '2026-12-02T00:30:00Z' })
    const released = buildLienTimelineFromWindow({ workMonths: wm, filings: [notice, affidavit, release], job, isSub: true, propertyKind: 'non_residential', openBalance: 0, todayYmd: '2026-12-10' })
    expect(released.steps.find((s) => s.kind === 'release')?.dateWords).toBe('released Dec 1')
    expect(released.next.words).toBe('Released Dec 1 — the clock stopped.')
  })

  it('reads the desk’s sent, skipped and noted stamps by the Central day', () => {
    const row = { job_id: 'j1', work_month: '2026-07', approved_hours: 20, deadline: '2026-10-15', noticed: true, open_balance: 5_000, customer_id: 'gc', gc_customer_id: 'gc', property_kind: 'non_residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null } as LienNoticeMonthRow
    const sent = { id: 'i', job_id: 'j1', kind: 'notice_53_056', status: 'sent', months: ['2026-07'], fields: {}, voided_at: null, created_at: '2026-09-10T15:00:00Z', updated_at: '2026-09-16T00:30:00Z', sent_at: '2026-09-16T00:30:00Z' } as unknown as LienDeskItemRow
    expect(lienTimelineMonthsFromDesk('j1', [row], [sent], TODAY)).toEqual([{ key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'sent', at: '2026-09-15' }])
    const noted = { ...sent, status: 'missed', months: ['2026-06'], sent_at: null, fields: { notice: {}, gcEmail: '', windowClosed: { name: 'Taunya', at: '2026-12-02T00:30:00Z' } } } as unknown as LienDeskItemRow
    expect(lienTimelineMonthsFromDesk('j1', [], [noted], TODAY, 'non_residential')).toMatchObject([{ key: '2026-06', outcome: 'missed', at: '2026-12-01' }])
    const noon = { ...sent, sent_at: '2026-09-16T12:00:00Z' } as LienDeskItemRow
    expect(lienTimelineMonthsFromDesk('j1', [row], [noon], TODAY)[0]!.at).toBe('2026-09-16')
  })
})

describe('the Lien window’s header names the desk’s step on a notice in work (v2.7077, punch list #325, PR 6)', () => {
  // A commercial sub job worked in July: the notice by Oct 15, 22 days out.
  const wm: JobWorkMonths = { jobId: 'j1', role: 'sub', propertyKind: 'non_residential', months: [month('2026-07', '2026-10-15', 22)], totalHours: 20, sessionCount: 3, pendingSessions: 0, lastMonthKey: '2026-07', affidavitDue: '2026-11-16' }
  const src = { workMonths: wm, filings: [], job: { id: 'j1', created_at: '2026-05-02T00:00:00Z', last_work_date: '2026-07-20' }, isSub: true, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY }
  const entry = (pile: string, hold_until: string | null = null) => ({ pile, item: hold_until ? { hold_until } : null }) as never

  it('with no word from the desk the header reads Draft, as before', () => {
    const t = buildLienTimelineFromWindow(src)
    expect(t.next.words).toBe('Draft the Jul notice — 22 days.')
    expect(t.waitingOn).toEqual({ who: 'ours', words: 'the notice to be drafted and mailed' })
    expect(buildLienTimelineFromWindow({ ...src, deskNotice: null }).next.words).toBe(t.next.words)
  })

  it.each([
    ['needs_owner', 'Find the owner, then send the Jul notice — 22 days.', 'the owner’s name for the notice', '22 days · owner of record missing'],
    ['to_draft', 'Draft the Jul notice — 22 days.', 'the notice to be drafted and mailed', '22 days · to draft'],
    ['awaiting', 'Approve the Jul notice — 22 days.', 'the leader’s approval of the notice', '22 days · awaiting approval'],
    ['ready', 'Send the Jul notice — 22 days.', 'the notice to be mailed', '22 days · ready to send'],
    ['printed', 'Record the mailing of the Jul notice — 22 days.', 'the envelope’s certified number to be typed in', '22 days · in the mail · tracking owed'],
  ])('a notice on the %s pile: %s', (pile, next, waiting, stepWords) => {
    const t = buildLienTimelineFromWindow({ ...src, deskNotice: lienWindowDeskNotice(entry(pile)) })
    expect(t.next.kind).toBe('notice')
    expect(t.next.words).toBe(next)
    expect(t.waitingOn).toEqual({ who: 'ours', words: waiting })
    expect(t.steps.find((s) => s.key === 'notice:2026-07')!.words).toBe(stepWords)
  })

  it('a held notice says when it asks again', () => {
    const t = buildLienTimelineFromWindow({ ...src, deskNotice: lienWindowDeskNotice(entry('held', '2026-10-05')) })
    expect(t.next.words).toBe('Held — the Jul notice re-asks Oct 5; mail by Oct 15.')
    expect(t.waitingOn?.words).toBe('the hold to lift')
  })

  it('a job with no desk entry, or one on a pile that is no step, hands over nothing', () => {
    expect(lienWindowDeskNotice(null)).toBeNull()
    expect(lienWindowDeskNotice(undefined)).toBeNull()
    expect(lienWindowDeskNotice(entry('missed'))).toBeNull()
    expect(lienWindowDeskNotice(entry('printed'))).toEqual({ state: 'printed', holdUntil: null })
  })

  it('the desk’s word never reaches a job that sends no notice: an original contractor still reads File the affidavit', () => {
    const direct = buildLienTimelineFromWindow({ ...src, isSub: false, deskNotice: { state: 'awaiting', holdUntil: null } })
    expect(direct.next.kind).toBe('affidavit')
    expect(direct.next.words.startsWith('File the affidavit')).toBe(true)
  })
})

describe('the Lien window’s header names the desk’s step on an affidavit in work (v2.7187, punch list #335, row 2)', () => {
  // A commercial sub job worked in July, its notice sent Sep 1: the affidavit by Nov 16, 54 days out.
  const wm: JobWorkMonths = { jobId: 'j1', role: 'sub', propertyKind: 'non_residential', months: [month('2026-07', '2026-10-15', 22)], totalHours: 20, sessionCount: 3, pendingSessions: 0, lastMonthKey: '2026-07', affidavitDue: '2026-11-16' }
  const src = { workMonths: wm, filings: [filing({ months_covered: ['2026-07'] })], job: { id: 'j1', created_at: '2026-05-02T00:00:00Z', last_work_date: '2026-07-20' }, isSub: true, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY }
  const GATES: LienAffidavitGateKey[] = ['owner', 'legal', 'contractor', 'notice', 'homestead']
  const entry = (pile: string, missing: LienAffidavitGateKey[] = [], hold_until: string | null = null) =>
    ({ pile, gates: [...new Set([...GATES, ...missing])].map((key) => ({ key, ok: !missing.includes(key), label: key })), item: hold_until ? { hold_until } : null }) as unknown as LienAffidavitEntry
  const affidavitStep = (t: ReturnType<typeof buildLienTimelineFromWindow>) => t.steps.find((s) => s.key === 'affidavit')!

  it('with no word from the desk the header reads File the affidavit, as before', () => {
    const t = buildLienTimelineFromWindow(src)
    expect(t.next).toMatchObject({ kind: 'affidavit', words: 'File the affidavit — 54 days.', date: '2026-11-16', daysLeft: 54 })
    expect(t.waitingOn).toEqual({ who: 'ours', words: 'the affidavit to be filed' })
    expect(affidavitStep(t).words).toBe('54 days')
    expect(buildLienTimelineFromWindow({ ...src, deskAffidavit: null }).next.words).toBe(t.next.words)
  })

  it.each([
    ['to_draft', 'Draft the affidavit — 54 days.', 'the affidavit to be drafted', '54 days · to draft'],
    ['awaiting', 'Approve the affidavit — 54 days.', 'the leader’s approval of the affidavit', '54 days · awaiting approval'],
    ['ready', 'File the affidavit — 54 days.', 'the affidavit to be filed', '54 days · ready to file'],
  ])('an affidavit on the %s pile: %s', (pile, next, waiting, stepWords) => {
    const t = buildLienTimelineFromWindow({ ...src, deskAffidavit: lienWindowDeskAffidavit(entry(pile)) })
    expect(t.next).toMatchObject({ kind: 'affidavit', words: next, affidavitState: pile, date: '2026-11-16', daysLeft: 54 })
    expect(t.waitingOn).toEqual({ who: 'ours', words: waiting })
    expect(affidavitStep(t).words).toBe(stepWords)
  })

  it.each([
    [['homestead_answer'], 'Answer the homestead question, then file the affidavit — 54 days.', 'a yes or a no on the homestead question', '54 days · the homestead answer missing'],
    [['owner'], 'Find the owner, then file the affidavit — 54 days.', 'the owner of record and a mailing address', '54 days · owner of record missing'],
    [['legal'], 'Add the legal description, then file the affidavit — 54 days.', 'the county and legal description on the property record', '54 days · legal description missing'],
    [['contractor'], 'Add the GC’s address, then file the affidavit — 54 days.', 'the general contractor’s address', '54 days · the general contractor\'s address missing'],
    [['homestead'], 'Homestead, ask the attorney — 54 days.', 'the attorney to be asked about a homestead lien', '54 days · homestead missing'],
    [['legal', 'owner'], 'Fix the property record, then file the affidavit — 54 days · legal description, owner of record missing.', 'the property record to be completed', '54 days · legal description, owner of record missing'],
  ] as Array<[LienAffidavitGateKey[], string, string, string]>)('an affidavit held by %j: %s', (missing, next, waiting, stepWords) => {
    const t = buildLienTimelineFromWindow({ ...src, deskAffidavit: lienWindowDeskAffidavit(entry('needs_property', missing)) })
    expect(t.next).toMatchObject({ kind: 'affidavit', words: next, affidavitState: 'needs_property', daysLeft: 54 })
    expect(t.waitingOn).toEqual({ who: 'ours', words: waiting })
    expect(affidavitStep(t).words).toBe(stepWords)
  })

  it('public property has no day to race: the fact, and who to ask', () => {
    const t = buildLienTimelineFromWindow({ ...src, deskAffidavit: lienWindowDeskAffidavit(entry('needs_property', ['public_owner'])) })
    expect(t.next).toMatchObject({ kind: 'affidavit', words: 'Public property, no lien — ask the attorney about the bond.', date: '', daysLeft: null, tone: 'amber' })
    expect(t.waitingOn).toEqual({ who: 'ours', words: 'the attorney to be asked about the payment bond' })
  })

  it('a held affidavit says when it asks again, and its last day', () => {
    const t = buildLienTimelineFromWindow({ ...src, deskAffidavit: lienWindowDeskAffidavit(entry('held', [], '2026-10-05')) })
    expect(t.next.words).toBe('Held — the affidavit re-asks Oct 5; file by Nov 16.')
    expect(t.waitingOn?.words).toBe('the hold to lift')
    expect(affidavitStep(t).words).toBe('54 days · held · re-asks Oct 5')
    expect(buildLienTimelineFromWindow({ ...src, deskAffidavit: lienWindowDeskAffidavit(entry('held')) }).next.words).toBe('Held — the affidavit waits on its hold; file by Nov 16.')
  })

  it('a job with no affidavit entry, or one that is filed or missed, hands over nothing; the closed gates go only with a paper they hold', () => {
    expect(lienWindowDeskAffidavit(null)).toBeNull()
    expect(lienWindowDeskAffidavit(undefined)).toBeNull()
    expect(lienWindowDeskAffidavit(entry('filed'))).toBeNull()
    expect(lienWindowDeskAffidavit(entry('missed'))).toBeNull()
    expect(lienWindowDeskAffidavit(entry('needs_property', ['owner', 'legal']))).toEqual({ state: 'needs_property', missing: ['legal', 'owner'], holdUntil: null })
    expect(lienWindowDeskAffidavit(entry('to_draft', ['notice']))).toEqual({ state: 'to_draft', missing: [], holdUntil: null })
  })

  it('a notice still to send comes first: the affidavit’s word waits its turn, and a filed lien never reads Draft', () => {
    // No notice filing: July's window is open, so the header is the notice's.
    const owing = buildLienTimelineFromWindow({ ...src, filings: [], deskAffidavit: lienWindowDeskAffidavit(entry('to_draft')) })
    expect(owing.next.kind).toBe('notice')
    expect(owing.next.affidavitState).toBeUndefined()
    // On file: the header moves on to the service, whatever the desk's entry still says.
    const filed = buildLienTimelineFromWindow({ ...src, filings: [...src.filings, filing({ id: 'a', kind: 'affidavit', filed_at: '2026-09-20', serve_due: '2026-09-25' })], deskAffidavit: lienWindowDeskAffidavit(entry('to_draft')) })
    expect(filed.next.kind).toBe('serve')
  })

  it('the desk’s own timeline names the step too, from the entry it already holds', () => {
    const affidavit = { ...entry('awaiting'), jobId: 'j1', isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-11-16', daysLeft: 54 } as LienAffidavitEntry
    const row = { job_id: 'j1', work_month: '2026-07', approved_hours: 20, deadline: '2026-10-15', noticed: true } as unknown as LienNoticeMonthRow
    const sent = { id: 'i1', job_id: 'j1', kind: 'notice_53_056', status: 'sent', months: ['2026-07'], sent_at: '2026-09-01T15:00:00Z', voided_at: null, created_at: '2026-08-30T00:00:00Z', fields: {} } as unknown as LienDeskItemRow
    const t = buildLienTimelineFromDesk('j1', { rows: [row], items: [sent], filings: [], entry: null, affidavit, isSub: true, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY })
    expect(t.next).toMatchObject({ kind: 'affidavit', words: 'Approve the affidavit — 54 days.', affidavitState: 'awaiting' })
    expect(t.waitingOn).toEqual({ who: 'ours', words: 'the leader’s approval of the affidavit' })
  })
})
