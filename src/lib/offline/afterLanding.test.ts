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

// Punch list #229, PR 6: a kept report's photos take the report's id once it lands.
describe('afterLanding, the photos', () => {
  it('attaches the sent photos, answers their questions, drops the bytes, then sends the notifications', async () => {
    const calls: string[] = []
    const run: AfterLandingIo = {
      invokeFunction: async (name) => {
        calls.push(`fn:${name}`)
      },
      stampMovedLines: async () => {},
      propagateReportPct: async () => {
        calls.push('pct')
      },
      attachPhotos: async (reportId, photos) => {
        calls.push(`attach:${reportId}:${photos.map((p) => `${p.id}/${p.stageName}/${p.caption}`).join(',')}`)
        return { failedIds: ['b'] }
      },
      answerQuestions: async (writes, who) => {
        calls.push(`answer:${who.userId}:${who.name}:${writes.map((w) => `${w.questionId}=${w.reportPhotoId}`).join(',')}`)
      },
      dropKeptPhotos: async (ids) => {
        calls.push(`drop:${ids.join(',')}`)
      },
    }
    const photo = (id: string, sent: boolean, questionId: string | null) => ({ id, sent, fixtureId: 'r', stageName: 'Rough In', caption: 'Rough In', questionId, questionWords: questionId ? 'Did the water test hold?' : null, takenAt: '2026-11-01T13:00:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: 'Luis Ortega' })
    const press = newPress({
      id: 'd',
      seq: 1,
      kind: 'field-report',
      userId: 'u',
      pressedAt: T,
      payload: { templateId: 't', fieldValues: {}, jobLedgerId: 'j', projectId: null, bidId: null, lat: null, lng: null, photos: [photo('a', true, 'q1'), photo('b', true, 'q1'), photo('c', false, null)] },
    })
    await afterLanding(press, { report_id: 'r1' }, run)
    // c was never sent, so it is not attached; b did not attach, so a answers the question; the bytes of both sent go.
    expect(calls).toEqual(['attach:r1:a/Rough In/Rough In,b/Rough In/Rough In', 'answer:u:Luis Ortega:q1=a', 'drop:a,b', 'fn:send-report-notification', 'fn:send-report-email', 'pct'])
  })

  // Punch list #244, PR 5.
  it('a job photos press drops the sent shots’ bytes and writes the one thread line, and nothing else', async () => {
    const calls: string[] = []
    const run: AfterLandingIo = {
      invokeFunction: async (name) => {
        calls.push(`fn:${name}`)
      },
      stampMovedLines: async () => {
        calls.push('stamp')
      },
      propagateReportPct: async () => {
        calls.push('pct')
      },
      dropKeptPhotos: async (ids) => {
        calls.push(`drop:${ids.join(',')}`)
      },
      postThreadLine: async (jobId, userId, body) => {
        calls.push(`thread:${jobId}:${userId}:${body}`)
        return true
      },
    }
    const jp = (id: string, sent: boolean, description: string) => ({ id, sent, fixtureId: null, stageName: null, caption: description || 'Job photo', description, questionId: null, questionWords: null, takenAt: '2026-11-02T20:41:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: 'Carla Nguyen' })
    const press = newPress({ id: 'jp', seq: 1, kind: 'job-photos', userId: 'u', pressedAt: T, payload: { jobLedgerId: 'j', photos: [jp('a', true, 'Meter location'), jp('b', true, ''), jp('c', false, 'Never sent')] } })
    await afterLanding(press, { added: 2 }, run)
    expect(calls).toEqual(['drop:a,b', 'thread:j:u:Added 2 photos: Meter location'])
  })

  // Punch list #273, v2.6628: a landed task photo drops its bytes and tells the card's strip; nothing on a job's thread.
  it('a landed task photo press drops the sent shot’s bytes and announces it to the card', async () => {
    const calls: string[] = []
    const run: AfterLandingIo = {
      invokeFunction: async () => {
        calls.push('fn')
      },
      stampMovedLines: async () => {
        calls.push('stamp')
      },
      propagateReportPct: async () => {
        calls.push('pct')
      },
      dropKeptPhotos: async (ids) => {
        calls.push(`drop:${ids.join(',')}`)
      },
      postThreadLine: async () => {
        calls.push('thread')
        return true
      },
      announceTaskPhotos: (ids) => {
        calls.push(`announce:${ids.join(',')}`)
      },
    }
    const shot = (id: string, sent: boolean) => ({ id, sent, kind: 'progress' as const, percentAt: 75, criterionId: null, lineBody: null, takenAt: '2026-11-07T20:41:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: 'Mateo Ruiz' })
    const press = newPress({ id: 'tp', seq: 1, kind: 'task-photo', userId: 'u', pressedAt: T, payload: { instanceId: 'inst-1', photos: [shot('a', true)] } })
    await afterLanding(press, { instance_id: 'inst-1', photo_ids: ['a'] }, run)
    expect(calls).toEqual(['drop:a', 'announce:a'])
    const nothingSent = newPress({ id: 'tp2', seq: 2, kind: 'task-photo', userId: 'u', pressedAt: T, payload: { instanceId: 'inst-1', photos: [shot('b', false)] } })
    calls.length = 0
    await afterLanding(nothingSent, {}, run)
    expect(calls).toEqual([])
  })
})
