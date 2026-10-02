import { describe, expect, it } from 'vitest'
import {
  lienStatusDeskPath,
  lienStatusEmailHtml,
  lienStatusEmailText,
  lienStatusGroups,
  lienStatusMonthsWords,
  lienStatusSubject,
  lienStatusText,
  parseLienStatusPayload,
  type LienStatusHouseJob,
  type LienStatusJob,
  type LienStatusPayload,
} from '../../../supabase/functions/_shared/lienDeskStatus'

/** The notice desk read on Wed Oct 1, 2026 at 2:14 PM (production, the dev login): 23 notices, 10 GCs. */
const OCT = '2026-10-15'
const NOV = '2026-11-16'
let seq = 0
function job(number: string, name: string, gc: string, owed: number, months: string[], where: LienStatusJob['where'], byYmd = OCT, sinceYmd = ''): LienStatusJob {
  seq += 1
  return { jobId: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`, number, name, gc, owed, months, where, byYmd, sinceYmd }
}
const RMC = 'RMC- Dudley Mason'
const KNIGHT = 'Knight Contracting'
const JOBS: LienStatusJob[] = [
  job('927', 'Mike Holub- Candelria', 'Michael Holub', 7429, ['2026-07', '2026-08', '2026-09'], 'owner'),
  job('1002', 'Terrell- Sewer line repair', 'Heron Construction Group', 4050, ['2026-08'], 'owner'),
  job('804', 'Summit GC- Auto Zone', 'Summit General Contractors', 3553, ['2026-07', '2026-08', '2026-09'], 'owner'),
  job('891', 'Take 5- Liberty Hill', 'Burd & Assoc.', 27199, ['2026-07', '2026-08'], 'draft'),
  job('258', 'Dudley Mason', RMC, 9800, ['2026-07', '2026-08'], 'draft'),
  job('858', 'Service Visit, 9703 Lenox Hl', RMC, 7902, ['2026-08'], 'draft'),
  job('843', 'Michael Palmer- Jacob Roberts', 'Michael Palmer', 7152, ['2026-08', '2026-09'], 'draft'),
  job('898', 'Reliant Health', KNIGHT, 4800, ['2026-07'], 'draft'),
  job('813', 'Reliant Health- Electrical', KNIGHT, 4421, ['2026-07'], 'draft'),
  job('866', 'Omar Khan- Lennox', RMC, 3500, ['2026-08'], 'draft'),
  job('883', 'TF Harper- Mission Hills Drains', 'TF Harper', 2918, ['2026-07'], 'draft'),
  job('915', 'Reliant Health', KNIGHT, 2712, ['2026-07'], 'draft'),
  job('868', 'Service Visit, 1875 Co Rd 777', RMC, 2650, ['2026-08'], 'draft'),
  job('789', 'Knight Contracting- Reliant Health', KNIGHT, 2245, ['2026-07', '2026-08'], 'draft'),
  job('867', 'Service Visit, 628 Terrell Rd', RMC, 1710, ['2026-08'], 'draft'),
  job('800', 'Service Visit, 233 Palomino Trail', RMC, 1600, ['2026-08'], 'draft'),
  job('880', 'Reliant Health- HVAC', KNIGHT, 1380, ['2026-07'], 'draft'),
  job('863', 'Service Visit, 628 Terrell Rd', RMC, 1049, ['2026-08'], 'draft'),
  job('853', 'Service Visit, 628 Terrell Rd', RMC, 595, ['2026-08'], 'draft'),
  job('922', 'Michael Palmer (Ivan Kopecky)', 'Michael Palmer', 5000, ['2026-09'], 'draft', NOV),
  job('650', 'ATI Schertz', 'Loberg Contracting', 15722, ['2026-07'], 'draft'),
  job('878', 'Take 5- Seguin', 'Southern Post Construction', 38625, ['2026-07', '2026-08', '2026-09'], 'approval', OCT, '2026-09-24'),
  job('273', 'Dudley (Lennox)', RMC, 17585, ['2026-07', '2026-08'], 'approval', OCT, '2026-09-22'),
]
const OCT1: LienStatusPayload = {
  v: 1,
  asOf: '2026-10-01T19:14:00.000Z',
  todayYmd: '2026-10-01',
  gc: null,
  jobs: JOBS,
  liens: [
    { number: '881', name: 'Dudley Mason', gc: RMC, owed: 1050, byYmd: OCT, needs: ['notice'] },
    { number: '838', name: 'Bruce Hall', gc: '', owed: 350, byYmd: OCT, needs: ['owner', 'legal'] },
    { number: '890', name: 'Dudley Mason', gc: RMC, owed: 285, byYmd: OCT, needs: ['notice'] },
  ],
  kindsUnset: 6,
  trackingOwed: 0,
  pastWindow: { jobs: 18, owed: 43022 },
  retainage: { jobs: 0, held: 0, firstYmd: '' },
}
const knight = (): LienStatusPayload => ({ ...OCT1, gc: KNIGHT, jobs: JOBS.filter((j) => j.gc === KNIGHT), liens: [], kindsUnset: 3, pastWindow: { jobs: 0, owed: 0 } })

describe('lienStatusText — the share sheet’s message (v2.4311)', () => {
  it('the whole desk on Oct 1 reads as drawn: count, money, first date, approvals, GCs, what is left', () => {
    expect(lienStatusText(OCT1)).toBe(
      [
        'Liens, Thu Oct 1, 2:14 PM',
        '',
        'We are about to send lien notices on 23 jobs.',
        '$173,597 is owed on them.',
        'The first must be mailed by Oct 15, in 14 days.',
        '',
        'Waiting for approval:',
        '• Take 5- Seguin, Southern Post Construction, $38,625',
        '• Dudley (Lennox), RMC- Dudley Mason, $17,585',
        '',
        'By GC:',
        '• RMC- Dudley Mason, 9 jobs, $46,391',
        '• Southern Post Construction, 1 job, $38,625',
        '• Burd & Assoc., 1 job, $27,199',
        '• Loberg Contracting, 1 job, $15,722',
        '• Knight Contracting, 5 jobs, $15,558',
        '• Michael Palmer, 2 jobs, $12,152',
        '• 4 more GCs, 4 jobs, $17,950',
        '',
        'Still to do: draft 18 notices. Find 3 owners of record. Set the property kind on 6 jobs.',
        'Liens to file: 3 jobs, $1,685, the first by Oct 15. None is ready to file yet.',
        '',
        'Open the Lien desk:',
      ].join('\n'),
    )
  })

  it('one GC lists its jobs, says when all of them are due, and warns about kinds not set', () => {
    expect(lienStatusText(knight())).toBe(
      [
        'Knight Contracting liens, Thu Oct 1, 2:14 PM',
        '',
        'We are about to send lien notices on 5 Knight Contracting jobs.',
        '$15,558 is owed on them.',
        'All 5 must be mailed by Oct 15, in 14 days.',
        '',
        '• 898 Reliant Health, Jul, $4,800, to draft',
        '• 813 Reliant Health- Electrical, Jul, $4,421, to draft',
        '• 915 Reliant Health, Jul, $2,712, to draft',
        '• 789 Knight Contracting- Reliant Health, Jul and Aug, $2,245, to draft',
        '• 880 Reliant Health- HVAC, Jul, $1,380, to draft',
        '',
        '3 Knight Contracting jobs have no property kind set. If any is a home, its dates come a month sooner.',
        '',
        'Open the Lien desk on job 898:',
      ].join('\n'),
    )
  })

  it('a GC whose jobs fall on two dates names the later one on its line', () => {
    const palmer = { ...OCT1, gc: 'Michael Palmer', jobs: JOBS.filter((j) => j.gc === 'Michael Palmer'), liens: [], kindsUnset: 0, pastWindow: { jobs: 0, owed: 0 } }
    const text = lienStatusText(palmer)
    expect(text).toContain('The first must be mailed by Oct 15, in 14 days.')
    expect(text).toContain('• 922 Michael Palmer (Ivan Kopecky), Sep, $5,000, to draft, mail by Nov 16')
  })

  it('one job, a date tomorrow, held and approved notices, a lost window', () => {
    const one: LienStatusPayload = {
      ...OCT1,
      gc: RMC,
      todayYmd: '2026-10-14',
      jobs: [job('273', 'Dudley (Lennox)', RMC, 17585, ['2026-08'], 'ready')],
      liens: [],
      kindsUnset: 1,
      pastWindow: { jobs: 2, owed: 1335 },
    }
    const text = lienStatusText(one)
    expect(text).toContain('We are about to send a lien notice on 1 RMC- Dudley Mason job.')
    expect(text).toContain('$17,585 is owed on it.')
    expect(text).toContain('It must be mailed tomorrow, Oct 15.')
    expect(text).toContain('• 273 Dudley (Lennox), Aug, $17,585, approved for the next run')
    expect(text).toContain('1 RMC- Dudley Mason job has no property kind set. If it is a home, its dates come a month sooner.')
    expect(text).toContain('2 more jobs passed their lien window. $1,335 is still owed there, with no lien.')

    const desk = { ...OCT1, jobs: [job('1', 'A', 'G', 100, ['2026-09'], 'ready'), job('2', 'B', 'G', 50, ['2026-09'], 'held')], liens: [], kindsUnset: 0 }
    const t2 = lienStatusText(desk)
    expect(t2).toContain('Approved for the next run: 1 notice, $100.')
    expect(t2).toContain('Held for now: 1 notice, $50.')
    expect(t2).not.toContain('Waiting for approval:')
  })

  it('an empty desk says so in one sentence', () => {
    const empty = { ...OCT1, jobs: [], liens: [], kindsUnset: 0 }
    expect(lienStatusText(empty)).toBe(['Liens, Thu Oct 1, 2:14 PM', '', 'No lien notice is due in the next 30 days.', '', 'Open the Lien desk:'].join('\n'))
    expect(lienStatusSubject(empty)).toBe('Liens, Oct 1: no notice due in the next 30 days')
  })

  it('names retainage notices when the desk has any', () => {
    const t = lienStatusText({ ...OCT1, retainage: { jobs: 2, held: 9100, firstYmd: '2026-11-30' } })
    expect(t).toContain('Retainage notices to send: 2 jobs, $9,100 held, the first by Nov 30.')
  })

  it('words the months the way a sentence would', () => {
    expect(lienStatusMonthsWords(['2026-08'])).toBe('Aug')
    expect(lienStatusMonthsWords(['2026-08', '2026-07'])).toBe('Jul and Aug')
    expect(lienStatusMonthsWords(['2026-07', '2026-08', '2026-09'])).toBe('Jul, Aug and Sep')
  })
})

describe('the subject, the link and the groups', () => {
  it('leads with the count, the money and the first date', () => {
    expect(lienStatusSubject(OCT1)).toBe('Liens, Oct 1: 23 notices due, $173,597, first by Oct 15')
    expect(lienStatusSubject(knight())).toBe('Knight Contracting liens, Oct 1: 5 notices due, $15,558, first by Oct 15')
  })

  it('opens the desk, or the desk on a GC’s first job', () => {
    expect(lienStatusDeskPath(OCT1)).toBe('/jobs?tab=stages&liendesk=1')
    const k = knight()
    expect(lienStatusDeskPath(k)).toBe(`/jobs?tab=stages&liendesk=1&liendeskJob=${k.jobs.find((j) => j.number === '898')!.jobId}`)
  })

  it('groups by GC, most money first, each GC soonest first then biggest', () => {
    const groups = lienStatusGroups(JOBS)
    expect(groups.map((g) => g.name).slice(0, 3)).toEqual([RMC, 'Southern Post Construction', 'Burd & Assoc.'])
    expect(groups[0]!.jobs[0]!.number).toBe('273')
    expect(groups.find((g) => g.name === 'Michael Palmer')!.jobs.map((j) => j.number)).toEqual(['843', '922'])
  })
})

describe('the team email', () => {
  const o = { appUrl: 'https://clicktooling.com/', senderName: 'Grace', note: 'Seguin and Lennox wait on you. Both must be mailed by Oct 15.', readerIsLeader: true }

  it('puts the note on top, speaks to the leader, links the desk and signs with the sender', () => {
    const html = lienStatusEmailHtml(OCT1, o)
    expect(html).toContain('<b>Grace wrote:</b> Seguin and Lennox wait on you.')
    expect(html).toContain('We are about to send lien notices on 23 jobs.')
    expect(html).toContain('Waiting for your approval')
    expect(html).toContain('since Sep 24')
    expect(html).toContain('href="https://clicktooling.com/jobs?tab=stages&amp;liendesk=1"')
    expect(html).toContain('Past the window')
    expect(html).toContain('18 jobs passed their lien window. $43,022 is still owed on them. Collections has them.')
    expect(html).toContain('Grace sent this from the Lien desk in ClickTooling.')
    expect(lienStatusEmailHtml(OCT1, { ...o, readerIsLeader: false })).toContain('Waiting for approval')
  })

  it('one GC’s email says the kind point once, under Still to do, and shows no empty approvals tile', () => {
    const text = lienStatusEmailText(knight(), { ...o, note: '' })
    expect(text).toContain('• Set the property kind on 3 jobs. If any is a home, its dates come a month sooner.')
    expect(text).not.toContain('Knight Contracting jobs have no property kind set')
    expect(text.match(/property kind/g)).toHaveLength(1)
    const html = lienStatusEmailHtml(knight(), { ...o, note: '' })
    expect(html.match(/property kind/g)).toHaveLength(1)
    expect(html).toContain('>None</div>')
    expect(html).toContain('waiting for approval')
    expect(html).not.toContain('wait for your approval')
  })

  it('escapes every name it prints', () => {
    const bad = { ...OCT1, jobs: [job('1', '<img src=x onerror=alert(1)>', 'GC & "Co"', 10, ['2026-09'], 'draft')], liens: [] }
    const html = lienStatusEmailHtml(bad, { ...o, note: '<b>hi</b>' })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('GC &amp; &quot;Co&quot;')
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;')
  })

  it('has a plain twin with every job under its GC and the link spelled out', () => {
    const text = lienStatusEmailText(OCT1, o)
    expect(text.startsWith('Grace wrote: Seguin and Lennox wait on you.')).toBe(true)
    expect(text).toContain('Waiting for your approval:')
    expect(text).toContain('• 878 Take 5- Seguin, Southern Post Construction, Jul, Aug and Sep, $38,625, since Sep 24')
    expect(text).toContain('RMC- Dudley Mason, 9 jobs, $46,391, first by Oct 15')
    expect(text).toContain('  • 853 Service Visit, 628 Terrell Rd, Aug, $595, to draft')
    expect(text).toContain('• 838 Bruce Hall, $350. We contracted with the owner. It needs the owner of record and the legal description.')
    expect(text).toContain('Open the Lien desk: https://clicktooling.com/jobs?tab=stages&liendesk=1')
  })
})

describe('parseLienStatusPayload — what the server accepts', () => {
  it('takes the desk’s payload as it is', () => {
    expect(parseLienStatusPayload(JSON.parse(JSON.stringify(OCT1)))).toEqual(OCT1)
  })

  it('refuses anything off the drawn shape', () => {
    const bad = (patch: Record<string, unknown>) => parseLienStatusPayload({ ...JSON.parse(JSON.stringify(OCT1)), ...patch })
    expect(bad({ v: 2 })).toBeNull()
    expect(bad({ todayYmd: 'Oct 1' })).toBeNull()
    expect(bad({ gc: '' })).toBeNull()
    expect(bad({ jobs: [{ ...JOBS[0], where: 'sent' }] })).toBeNull()
    expect(bad({ jobs: [{ ...JOBS[0], jobId: 'javascript:alert(1)' }] })).toBeNull()
    expect(bad({ jobs: [{ ...JOBS[0], owed: Number.POSITIVE_INFINITY }] })).toBeNull()
    expect(bad({ jobs: [{ ...JOBS[0], months: ['July'] }] })).toBeNull()
    expect(bad({ jobs: Array.from({ length: 501 }, () => JOBS[0]) })).toBeNull()
    expect(bad({ liens: [{ number: '1', name: 'x', gc: '', owed: 1, byYmd: '', needs: ['money'] }] })).toBeNull()
    expect(bad({ retainage: { jobs: 1, held: -5, firstYmd: '' } })).toBeNull()
    expect(parseLienStatusPayload(null)).toBeNull()
  })

  it('trims and caps long strings instead of refusing them', () => {
    const long = 'x'.repeat(400)
    const p = parseLienStatusPayload({ ...JSON.parse(JSON.stringify(OCT1)), gc: ` ${long} ` })!
    expect(p.gc).toHaveLength(160)
  })
})

describe('the houses list — lien jobs where a supply house is also owed (v2.4407)', () => {
  const HOUSES: LienStatusHouseJob[] = [
    { number: '891', name: 'Take 5- Liberty Hill', gc: 'Burd & Assoc.', owed: 27199, housesOwed: 6258, houses: 1, house: 'Reece', byYmd: OCT, jobAccount: false },
    { number: '650', name: 'ATI Schertz', gc: 'Loberg Contracting', owed: 15722, housesOwed: 15007, houses: 3, house: 'Reece', byYmd: OCT, jobAccount: false },
    { number: '251', name: 'Michael Palmer', gc: 'Michael Palmer', owed: 4720, housesOwed: 4958, houses: 3, house: 'Reece', byYmd: NOV, jobAccount: true },
    { number: '881', name: 'Dudley Mason', gc: '', owed: 1050, housesOwed: 61, houses: 1, house: 'Moore Supply', byYmd: '', jobAccount: false },
  ]
  const P: LienStatusPayload = { v: 1, asOf: '2026-10-01T19:14:00.000Z', todayYmd: '2026-10-01', gc: null, jobs: [], liens: [], kindsUnset: 0, trackingOwed: 0, pastWindow: { jobs: 0, owed: 0 }, retainage: { jobs: 0, held: 0, firstYmd: '' }, houses: HOUSES }

  it('says the list in the text: the soonest house notice first, then the most owed', () => {
    expect(lienStatusText(P)).toBe(
      [
        'Lien jobs where a supply house is also owed, Thu Oct 1, 2:14 PM',
        '',
        '4 lien jobs still owe a supply house.',
        '$48,691 is owed to us on them.',
        '$26,284 is owed to the houses.',
        '',
        '• 650 ATI Schertz, Loberg Contracting. Us $15,722. 3 houses $15,007. Reece’s notice by Oct 15.',
        // A GC's own full stop is not doubled.
        '• 891 Take 5- Liberty Hill, Burd & Assoc. Us $27,199. Reece $6,258. Its notice by Oct 15.',
        // A job named for its GC says the name once.
        '• 251 Michael Palmer. Us $4,720. 3 houses $4,958 on a job account. Reece’s notice by Nov 16.',
        // No open window: the money only.
        '• 881 Dudley Mason. Us $1,050. Moore Supply $61.',
        '',
        'A supply house can send its own notice on the same property. Each date is our estimate.',
        '',
        'Open the Lien desk:',
      ].join('\n'),
    )
  })

  it('folds past twelve jobs in the text and names them all in the email', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ ...HOUSES[0]!, number: String(100 + i), housesOwed: 100 }))
    const text = lienStatusText({ ...P, houses: many })
    expect(text.split('\n').filter((l) => l.startsWith('• '))).toHaveLength(13)
    expect(text).toContain('• 2 more jobs, $200 to houses')
    const email = lienStatusEmailText({ ...P, houses: many }, { appUrl: 'https://clicktooling.com', senderName: 'Grace' })
    expect(email.split('\n').filter((l) => l.startsWith('• '))).toHaveLength(14)
  })

  it('gives the subject, the email text and the email its own words', () => {
    expect(lienStatusSubject(P)).toBe('Supply houses also owed, Oct 1: 4 lien jobs, $26,284 to houses')
    const text = lienStatusEmailText(P, { appUrl: 'https://clicktooling.com', senderName: 'Grace', note: 'For Friday.' })
    expect(text).toContain('Grace wrote: For Friday.')
    expect(text).toContain('4 lien jobs still owe a supply house.')
    expect(text).toContain('Open the Lien desk: https://clicktooling.com/jobs?tab=stages&liendesk=1')
    expect(text).not.toContain('about to send')
    const html = lienStatusEmailHtml(P, { appUrl: 'https://clicktooling.com', senderName: 'Grace' })
    expect(html).toContain('4 lien jobs still owe a supply house.')
    expect(html).toContain('owed to supply houses')
    expect(html).toContain('first house notice, in 14 days')
    expect(html).toContain('<b>650 ATI Schertz</b>')
    expect(html).toContain('TO HOUSES')
    expect(html).not.toContain('By GC')
    expect(html).not.toContain('A notice keeps our right')
  })

  it('says so when no job owes a house', () => {
    expect(lienStatusText({ ...P, houses: [] })).toContain('No lien job owes a supply house right now.')
  })

  it('the server takes the list as drawn and refuses one off its shape', () => {
    expect(parseLienStatusPayload(JSON.parse(JSON.stringify(P)))).toEqual(P)
    // A payload from before the list reads as it always did.
    expect(parseLienStatusPayload(JSON.parse(JSON.stringify(OCT1)))).not.toHaveProperty('houses')
    const bad = (h: Record<string, unknown>) => parseLienStatusPayload({ ...JSON.parse(JSON.stringify(P)), houses: [{ ...HOUSES[0], ...h }] })
    expect(bad({ housesOwed: -1 })).toBeNull()
    expect(bad({ houses: 0 })).toBeNull()
    expect(bad({ house: '' })).toBeNull()
    expect(bad({ byYmd: 'Oct 15' })).toBeNull()
    expect(bad({ jobAccount: 'yes' })).toBeNull()
    expect(parseLienStatusPayload({ ...JSON.parse(JSON.stringify(P)), houses: 'all' })).toBeNull()
  })
})
