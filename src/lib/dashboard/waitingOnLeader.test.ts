import { describe, expect, it } from 'vitest'
import { SHORT_DASHBOARD_ALONE_KEYS } from './shortDashboard'
import { buildWaitingOnLeader, canSeeWaitingOnLeader, WAITING_ON_LEADER_MIRRORS, WAITING_ON_LEADER_WORDS, type WaitingOnLeaderInput, type WaitingOnLeaderPaper } from './waitingOnLeader'

const paper = (over: Partial<WaitingOnLeaderPaper> = {}): WaitingOnLeaderPaper => ({ itemId: 'i1', label: '650 · Alder Creek Lofts', dueYmd: '2026-11-20', askedYmd: '2026-11-13', runGc: null, ...over })

const nothing: WaitingOnLeaderInput = { leaders: [{ id: 'm1', name: 'Marcus Reed' }], lien: { approve: [], sign: [] }, waivers: [], lineBudgets: null, tags: [] }

describe('who sees the card', () => {
  it('is the office that is not the leader', () => {
    expect(canSeeWaitingOnLeader('assistant')).toBe(true)
    expect(canSeeWaitingOnLeader('controller')).toBe(true)
    for (const role of ['dev', 'master_technician', 'estimator', 'primary', 'helpers', 'subcontractor', 'superintendent', null]) expect(canSeeWaitingOnLeader(role)).toBe(false)
  })
})

describe('the rows are the leader\'s own short list', () => {
  it('every row stands for a line that is his alone, and every such line has a row', () => {
    const mirrored = Object.values(WAITING_ON_LEADER_MIRRORS).flat()
    for (const key of mirrored) expect(SHORT_DASHBOARD_ALONE_KEYS.has(key)).toBe(true)
    expect([...SHORT_DASHBOARD_ALONE_KEYS].sort()).toEqual([...mirrored].sort())
  })
})

describe('buildWaitingOnLeader', () => {
  it('is null when nothing waits, and before anything is read', () => {
    expect(buildWaitingOnLeader(nothing)).toBeNull()
    expect(buildWaitingOnLeader({ leaders: [], lien: null, waivers: null, lineBudgets: null, tags: null })).toBeNull()
  })

  it('names the one leader by first name', () => {
    const card = buildWaitingOnLeader({ ...nothing, lien: { approve: [paper()], sign: [] } })!
    expect(card.title).toBe('Waiting on Marcus')
    expect(card.leaderName).toBe('Marcus Reed')
  })

  it('says the leader when there are two, or none', () => {
    const two = buildWaitingOnLeader({ ...nothing, leaders: [{ id: 'm1', name: 'Marcus' }, { id: 'm2', name: 'Dana' }], lien: { approve: [paper()], sign: [] } })!
    expect(two.title).toBe('Waiting on the leader')
    expect(two.leaderName).toBeNull()
    expect(buildWaitingOnLeader({ ...nothing, leaders: [], lien: { approve: [paper()], sign: [] } })!.title).toBe('Waiting on the leader')
  })

  it('a notice to approve: when he was asked, the first window, and a reminder of one message each', () => {
    const card = buildWaitingOnLeader({ ...nothing, lien: { approve: [paper(), paper({ itemId: 'i2', label: '702 · Pine Hollow Clinic', dueYmd: '2026-11-18', askedYmd: '2026-11-16' })], sign: [] } })!
    const row = card.rows[0]!
    expect(row.key).toBe('approve')
    expect(row.title).toBe('2 lien notices to approve')
    expect(row.detail).toBe('Asked Nov 13. First window closes Nov 18.')
    expect(row.remind?.notices.map((p) => p.itemId)).toEqual(['i1', 'i2'])
    expect(row.remind?.signatures).toEqual([])
    expect(row.open?.href).toBe('/lien-desk?tab=notices&pile=awaiting')
    expect(card.count).toBe(2)
    expect(card.code).toBeNull()
  })

  it('names the run a notice is in', () => {
    const one = buildWaitingOnLeader({ ...nothing, lien: { approve: [paper({ runGc: 'Calloway Construction' }), paper({ itemId: 'i2' })], sign: [] } })!
    expect(one.rows[0]!.detail).toContain('1 is in the run for Calloway Construction.')
    const two = buildWaitingOnLeader({ ...nothing, lien: { approve: [paper({ runGc: 'Calloway Construction' }), paper({ itemId: 'i2', runGc: 'Ridgeway Builders' })], sign: [] } })!
    expect(two.rows[0]!.detail).toContain('2 are in runs for 2 GCs.')
  })

  it('a notice to sign: one message for the lot, and the press for his code', () => {
    const card = buildWaitingOnLeader({ ...nothing, lien: { approve: [], sign: [paper({ askedYmd: null })] } })!
    const row = card.rows[0]!
    expect(row.key).toBe('sign')
    expect(row.title).toBe('1 lien notice to sign')
    expect(row.detail).toBe('Approved. The run holds it until Marcus signs. First window closes Nov 20.')
    expect(row.remind?.signatures.map((p) => p.itemId)).toEqual(['i1'])
    expect(row.remind?.notices).toEqual([])
    expect(card.code).toEqual({ label: 'Marcus is here, sign with the signing code', href: '/lien-desk?tab=notices&pile=ready' })
  })

  it('a window that has passed reads closed, the day itself reads today, and no date given keeps closes (v2.7616)', () => {
    const detail = (todayYmd: string | null) => buildWaitingOnLeader({ ...nothing, todayYmd, lien: { approve: [paper({ askedYmd: null, dueYmd: '2026-11-16' })], sign: [paper({ itemId: 'i9', askedYmd: null, dueYmd: '2026-11-16' })] } })!.rows.map((r) => r.detail)
    expect(detail('2026-11-17')).toEqual(['First window closed Nov 16.', 'Approved. The run holds it until Marcus signs. First window closed Nov 16.'])
    expect(detail('2026-11-16')[0]).toBe('First window closes today.')
    expect(detail('2026-11-15')[0]).toBe('First window closes Nov 16.')
    expect(detail(null)[0]).toBe('First window closes Nov 16.')
  })

  it('a paper with no desk item stays out of the reminder with its reason', () => {
    const card = buildWaitingOnLeader({ ...nothing, lien: { approve: [paper({ itemId: null })], sign: [] } })!
    expect(card.rows[0]!.remind?.ready).toBe(0)
    expect(card.rows[0]!.remind?.held).toHaveLength(1)
  })

  it('a waiver, a tagged note and the line budgets have no reminder, and say where to look', () => {
    const card = buildWaitingOnLeader({
      ...nothing,
      waivers: [{ jobId: 'j2', askedYmd: '2026-11-15' }, { jobId: 'j1', askedYmd: '2026-11-12' }],
      tags: [{ jobId: 'j3', askedYmd: '2026-11-16' }],
      lineBudgets: { lines: 3, projects: 2 },
    })!
    expect(card.rows.map((r) => r.key)).toEqual(['waivers', 'tagged-notes', 'line-budgets'])
    for (const row of card.rows) expect(row.remind).toBeNull()
    const [waivers, tags, budgets] = card.rows
    expect(waivers!.title).toBe('2 lien waivers to sign')
    expect(waivers!.detail).toBe('Asked Nov 12. Each goes out when Marcus signs.')
    expect(waivers!.open).toEqual({ label: 'Open the job', href: '/jobs?edit=j1' })
    expect(tags!.title).toBe('1 tagged job note to answer')
    expect(tags!.open?.href).toBe('/jobs?edit=j3')
    expect(budgets!.title).toBe('3 assumed lines on 2 projects to review')
    expect(budgets!.detail).toBe('Awarded this week. The review is on Marcus’s Dashboard.')
    expect(budgets!.open).toBeNull()
    expect(card.count).toBe(6)
    expect(card.code).toBeNull()
  })

  it('keeps his page\'s order: approve, sign, waivers, tagged notes, line budgets', () => {
    const card = buildWaitingOnLeader({ leaders: nothing.leaders, lien: { approve: [paper()], sign: [paper({ itemId: 'i9' })] }, waivers: [{ jobId: 'j1', askedYmd: null }], tags: [{ jobId: 'j2', askedYmd: null }], lineBudgets: { lines: 1, projects: 1 } })!
    expect(card.rows.map((r) => r.key)).toEqual(['approve', 'sign', 'waivers', 'tagged-notes', 'line-budgets'])
    expect(card.count).toBe(5)
  })

  it('shows what did arrive when the desk is not read', () => {
    const card = buildWaitingOnLeader({ ...nothing, lien: null, tags: [{ jobId: 'j2', askedYmd: null }] })!
    expect(card.rows.map((r) => r.key)).toEqual(['tagged-notes'])
    expect(card.rows[0]!.detail).toBe('A teammate is waiting on the answer.')
  })
})

describe('the words', () => {
  it('say who to tell when no reminder goes', () => {
    expect(WAITING_ON_LEADER_WORDS.noReminder('Marcus')).toBe('No reminder goes for this yet. Tell Marcus yourself.')
    expect(WAITING_ON_LEADER_WORDS.noReminder('')).toBe('No reminder goes for this yet. Tell the leader yourself.')
    expect(WAITING_ON_LEADER_WORDS.notRead('The lien waivers')).toBe('The lien waivers could not be read, so this list may be short.')
  })
})
