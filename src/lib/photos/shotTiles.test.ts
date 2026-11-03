import { describe, expect, it } from 'vitest'
import { fileTimeOrNow, sendLostSignal } from './shotTiles'

describe('sendLostSignal', () => {
  const lost = (name: string) => Object.assign(new Error('The phone has no signal.'), { name, kind: 'network' })

  it('is a lost signal when the io’s own error class says network', () => {
    expect(sendLostSignal(lost('ReportPhotoSendError'), 'ReportPhotoSendError')).toBe(true)
    expect(sendLostSignal(lost('PhotoSendError'), 'PhotoSendError')).toBe(true)
  })

  it('is not when the class is another io’s, the kind is a refusal, or the error is plain', () => {
    expect(sendLostSignal(lost('PhotoSendError'), 'ReportPhotoSendError')).toBe(false)
    expect(sendLostSignal(Object.assign(new Error('Refused.'), { name: 'PhotoSendError', kind: 'server' }), 'PhotoSendError')).toBe(false)
    expect(sendLostSignal(new Error('The bucket refused it.'), 'PhotoSendError')).toBe(false)
    expect(sendLostSignal('no signal', 'PhotoSendError')).toBe(false)
    expect(sendLostSignal(null, 'PhotoSendError')).toBe(false)
  })
})

describe('fileTimeOrNow', () => {
  const now = Date.parse('2026-11-03T15:00:00.000Z')

  it('reads the file’s own time when it is already past', () => {
    expect(fileTimeOrNow({ lastModified: Date.parse('2026-10-30T13:48:00.000Z') }, now)).toBe('2026-10-30T13:48:00.000Z')
  })

  it('reads now for a file with no time or one in the future', () => {
    expect(fileTimeOrNow({ lastModified: 0 }, now)).toBe('2026-11-03T15:00:00.000Z')
    expect(fileTimeOrNow({ lastModified: now + 60_000 }, now)).toBe('2026-11-03T15:00:00.000Z')
  })
})
