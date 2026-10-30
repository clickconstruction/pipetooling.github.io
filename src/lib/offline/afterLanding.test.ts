import { describe, expect, it } from 'vitest'
import { afterLanding, reportIdOf, type AfterLandingIo } from './afterLanding'
import { newPress } from './outbox'

const T = 1_780_000_000_000

function io() {
  const calls: string[] = []
  const run: AfterLandingIo = {
    invokeFunction: async (name, body) => {
      calls.push(`fn:${name}:${JSON.stringify(body)}`)
    },
    stampMovedLines: async (jobId, moved, reportId) => {
      calls.push(`stamp:${jobId}:${moved.map((m) => `${m.fixtureId}=${m.to}`).join(',')}:${reportId}`)
    },
    propagateReportPct: async (jobId, fv) => {
      calls.push(`pct:${jobId}:${JSON.stringify(fv)}`)
    },
  }
  return { run, calls }
}

describe('afterLanding', () => {
  it('reads the report id the server answered', () => {
    expect(reportIdOf({ report_id: 'r1', late: true })).toBe('r1')
    expect(reportIdOf({ session_id: 's1' })).toBeNull()
    expect(reportIdOf(null)).toBeNull()
  })

  it('a landed report sends its two notifications, stamps the moved lines and mirrors the percent', async () => {
    const { run, calls } = io()
    const press = newPress({
      id: 'd',
      seq: 1,
      kind: 'field-report',
      userId: 'u',
      pressedAt: T,
      payload: { templateId: 't', fieldValues: { 'Percent complete': '40' }, jobLedgerId: 'j', projectId: null, bidId: null, lat: null, lng: null, movedLines: [{ fixtureId: 'f1', to: 40 }] },
    })
    await afterLanding(press, { report_id: 'r1' }, run)
    expect(calls).toEqual([
      'fn:send-report-notification:{"report_id":"r1"}',
      'fn:send-report-email:{"report_id":"r1"}',
      'stamp:j:f1=40:r1',
      'pct:j:{"Percent complete":"40"}',
    ])
  })

  it('a report on a bid or a project has nothing to stamp or mirror; a note needs nothing at all', async () => {
    const { run, calls } = io()
    await afterLanding(newPress({ id: 'e', seq: 1, kind: 'field-report', userId: 'u', pressedAt: T, payload: { templateId: 't', fieldValues: {}, jobLedgerId: null, projectId: 'p', bidId: null, lat: null, lng: null } }), { report_id: 'r2' }, run)
    expect(calls).toEqual(['fn:send-report-notification:{"report_id":"r2"}', 'fn:send-report-email:{"report_id":"r2"}'])
    calls.length = 0
    await afterLanding(newPress({ id: 'n', seq: 2, kind: 'job-note', userId: 'u', pressedAt: T, payload: { jobId: 'j', body: 'x' } }), { note_id: 'n1' }, run)
    expect(calls).toEqual([])
  })

  it('never throws when a follow-up fails', async () => {
    const run: AfterLandingIo = {
      invokeFunction: async () => {
        throw new Error('no network')
      },
      stampMovedLines: async () => {
        throw new Error('no network')
      },
      propagateReportPct: async () => {
        throw new Error('no network')
      },
    }
    const press = newPress({ id: 'd', seq: 1, kind: 'field-report', userId: 'u', pressedAt: T, payload: { templateId: 't', fieldValues: {}, jobLedgerId: 'j', projectId: null, bidId: null, lat: null, lng: null, movedLines: [{ fixtureId: 'f1', to: 40 }] } })
    await expect(afterLanding(press, { report_id: 'r1' }, run)).resolves.toBeUndefined()
  })
})
