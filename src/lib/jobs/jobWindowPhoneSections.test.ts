import { describe, expect, it } from 'vitest'
import { foldCountWords, keepPhoneFolds, newestCustomerLines, nextOnSite, openThreadWords, PHONE_FOLDS, readPhoneFolds, splitFirstSentence, threadRows, waitingOnWords, type PhoneFoldKey } from './jobWindowPhoneSections'
import type { JobActivityMessage } from './jobActivityMessages'
import type { SummaryLine } from './threadSummary'

describe('nextOnSite', () => {
  const block = (work_date: string, time_start: string, time_end: string, name: string | null) => ({ work_date, time_start, time_end, users: { name } })

  it('picks the earliest block on or after today and puts the hours on their own line', () => {
    const w = nextOnSite([block('2026-11-20', '13:00:00', '15:00:00', 'Robert'), block('2026-11-14', '08:00:00', '12:00:00', 'Sample leader'), block('2026-11-10', '08:00:00', '12:00:00', 'Robert')], '2026-11-14')
    expect(w).toEqual({ day: 'Saturday, November 14, 2026', hours: '8:00 AM–12:00 PM', who: 'Sample leader' })
  })

  it('names everyone on the same block, and says nobody with no name', () => {
    expect(nextOnSite([block('2026-11-14', '08:00:00', '12:00:00', 'Sample leader'), block('2026-11-14', '08:00:00', '12:00:00', 'Luis')], '2026-11-14')?.who).toBe('Sample leader and Luis')
    expect(nextOnSite([block('2026-11-14', '08:00:00', '12:00:00', 'A'), block('2026-11-14', '08:00:00', '12:00:00', 'B'), block('2026-11-14', '08:00:00', '12:00:00', 'C')], '2026-11-14')?.who).toBe('A and 2 more')
    expect(nextOnSite([block('2026-11-14', '08:00:00', '12:00:00', null)], '2026-11-14')?.who).toBe('')
    expect(nextOnSite([block('2026-11-10', '08:00:00', '12:00:00', 'Robert')], '2026-11-14')).toBeNull()
  })
})

describe('waitingOnWords', () => {
  const now = '2026-11-14T18:00:00Z'
  it('says who the job waits on from the bar’s verb, the verb the door when it is ours', () => {
    expect(waitingOnWords({ status: 'ready_to_bill', verb: { label: 'Bill it', tone: 'blue', target: 'bill' }, lastActivityIso: '2026-11-08T18:00:00Z', nowIso: now })).toEqual({ lead: 'The office, to', verb: 'bill it', ours: true, quiet: 'Nothing has happened for 6 days.', act: null })
    expect(waitingOnWords({ status: 'billed', verb: { label: 'Mark paid', tone: 'blue', target: 'status' }, lastActivityIso: null, nowIso: now })).toEqual({ lead: 'The customer, to', verb: 'pay', ours: false, quiet: '', act: 'Mark paid' })
    expect(waitingOnWords({ status: 'working', verb: { label: 'Ready to bill', tone: 'blue', target: 'status' }, lastActivityIso: '2026-11-13T18:00:00Z', nowIso: now })).toEqual({ lead: 'The crew, to', verb: 'finish the work', ours: false, quiet: '', act: 'Ready to bill' })
  })
  it('says nobody on a paid job', () => {
    expect(waitingOnWords({ status: 'paid', verb: null, lastActivityIso: null, nowIso: now })).toMatchObject({ lead: 'Nobody.', verb: 'The job is paid.', ours: false, act: null })
  })
})

describe('threadRows', () => {
  const line = (key: SummaryLine['key'], text: string, href: string | null): SummaryLine => ({ key, label: key, text, href, doorWord: '' })
  it('splits the first sentence from the rest and ends each row in its act', () => {
    const rows = threadRows([line('stands', 'The last word was Dana’s, a text last Saturday. The job is Working at 34%.', '/messages?thread=c&at=m'), line('theirs', 'Nothing promised yet. A day Dana gives for a payment or an answer lands here.', null), line('ours', 'Nothing open. A call, a price or a date we said we would give lands here.', null)])
    expect(rows.map((r) => [r.label, r.value, r.sub, r.act, r.door])).toEqual([
      ['Last word', 'The last word was Dana’s, a text last Saturday.', 'The job is Working at 34%.', 'Reply', 'line'],
      ['They promised', 'Nothing promised yet.', 'A day Dana gives for a payment or an answer lands here.', 'Write it down', 'thread'],
      ['We owe them', 'Nothing open.', 'A call, a price or a date we said we would give lands here.', 'Mark it', 'thread'],
    ])
  })
  it('offers Change it once a promise or a debt is written', () => {
    const rows = threadRows([line('stands', 'No calls, texts or emails with Dana on this job yet.', null), line('theirs', 'Dana promised a decision by Thu Oct 29. Said last Friday.', '/messages?thread=c&at=p'), line('ours', 'We owe Dana a start date by Mon Nov 2. Marked last Friday.', null)])
    expect(rows.map((r) => r.act)).toEqual(['Open the thread', 'Change it', 'Change it'])
    expect(splitFirstSentence('One sentence only')).toEqual({ value: 'One sentence only', sub: '' })
  })
})

describe('the bubbles and the door', () => {
  const m = (id: string, at: string, direction: 'in' | 'out', channel: JobActivityMessage['channel'] = 'text', kind: JobActivityMessage['contact']['kind'] = 'customer'): JobActivityMessage =>
    ({ id, contactId: 'c', contact: { name: 'Dana', kind }, channel, direction, at, who: 'Robert', body: `b${id}` }) as JobActivityMessage
  it('takes the two newest lines with the customer, oldest first for the bubbles, never a note or an event', () => {
    const lines = [m('1', '2026-11-01T00:00:00Z', 'out'), m('2', '2026-11-05T00:00:00Z', 'in'), m('3', '2026-11-07T00:00:00Z', 'out', 'note'), m('4', '2026-11-09T00:00:00Z', 'in', 'event'), m('5', '2026-11-13T00:00:00Z', 'in'), m('6', '2026-11-12T00:00:00Z', 'out', 'email', 'trade')]
    expect(newestCustomerLines(lines).map((x) => x.id)).toEqual(['2', '5'])
    expect(newestCustomerLines(null)).toEqual([])
    expect(openThreadWords(56)).toBe('Open the thread · 56 ›')
    expect(openThreadWords(0)).toBe('Open the thread ›')
  })
})

describe('the folds', () => {
  it('lists the six folds in order and keeps the open ones per device', () => {
    expect(PHONE_FOLDS.map((f) => f.title)).toEqual(['Questions on this job', 'Activity', 'Money', 'Plans and papers', 'Work and time', 'Their journey'])
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(readPhoneFolds(storage).size).toBe(0)
    keepPhoneFolds(new Set<PhoneFoldKey>(['money', 'work']), storage)
    expect([...readPhoneFolds(storage)]).toEqual(['money', 'work'])
    storage.setItem('job_window_phone_folds_open', '["money","nonsense",3]')
    expect([...readPhoneFolds(storage)]).toEqual(['money'])
    storage.setItem('job_window_phone_folds_open', 'not json')
    expect(readPhoneFolds(storage).size).toBe(0)
    expect(foldCountWords(6, 'answered')).toBe('6 answered')
    expect(foldCountWords(56)).toBe('56')
    expect(foldCountWords(null)).toBe('')
  })
})
