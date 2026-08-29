import { describe, expect, it } from 'vitest'

import {
  buildJobShareDeepLink,
  buildJobShareFunctionUrl,
  buildJobSharePreviewUrl,
  buildJobSharePayload,
  buildJobShareTitle,
  generateJobShareToken,
  runJobShare,
  sha256Hex,
  type JobSharePayload,
} from './jobShare'

const fields = { hcpNumber: '951', jobName: 'Shearer Pinpoint', jobAddress: '717 Trinity St, Lockhart, TX' }

describe('buildJobShareTitle', () => {
  it('joins job # and name', () => {
    expect(buildJobShareTitle(fields)).toBe('Job #951 — Shearer Pinpoint')
  })

  it('degrades to just the name when the job # is missing', () => {
    expect(buildJobShareTitle({ ...fields, hcpNumber: '  ' })).toBe('Shearer Pinpoint')
  })

  it('degrades to just the job # when the name is missing', () => {
    expect(buildJobShareTitle({ ...fields, jobName: null })).toBe('Job #951')
  })

  it('falls back to "Job" when both are missing', () => {
    expect(buildJobShareTitle({ hcpNumber: null, jobName: undefined, jobAddress: null })).toBe('Job')
  })
})

describe('buildJobShareDeepLink', () => {
  it('builds the jobDetail deep link and encodes the id', () => {
    expect(buildJobShareDeepLink('abc 123', 'https://pipetooling.com')).toBe(
      'https://pipetooling.com/jobs?jobDetail=abc%20123',
    )
  })

  it('strips a trailing slash from the origin', () => {
    expect(buildJobShareDeepLink('x', 'https://pipetooling.com/')).toBe('https://pipetooling.com/jobs?jobDetail=x')
  })
})

describe('buildJobSharePayload', () => {
  it('puts title and address on separate lines of the text', () => {
    const p = buildJobSharePayload('j1', fields, 'https://pipetooling.com')
    expect(p.title).toBe('Job #951 — Shearer Pinpoint')
    expect(p.text).toBe('Job #951 — Shearer Pinpoint\n717 Trinity St, Lockhart, TX')
    expect(p.url).toBe('https://pipetooling.com/jobs?jobDetail=j1')
  })

  it('omits the address line when missing', () => {
    const p = buildJobSharePayload('j1', { ...fields, jobAddress: '  ' }, 'https://pipetooling.com')
    expect(p.text).toBe('Job #951 — Shearer Pinpoint')
  })
})

describe('generateJobShareToken', () => {
  it('produces 32 lowercase hex chars from 16 random bytes', () => {
    const token = generateJobShareToken({
      getRandomValues: ((arr: Uint8Array) => {
        arr.set(Array.from({ length: arr.length }, (_, i) => i * 16 + 1))
        return arr
      }) as Crypto['getRandomValues'],
    })
    expect(token).toMatch(/^[0-9a-f]{32}$/)
    expect(token.startsWith('0111213141')).toBe(true)
  })

  it('uses real crypto by default and does not repeat', () => {
    expect(generateJobShareToken()).not.toBe(generateJobShareToken())
  })
})

describe('sha256Hex', () => {
  it('matches the known sha256 vector for "abc"', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('buildJobShareFunctionUrl', () => {
  it('builds the edge function URL and encodes the token', () => {
    expect(buildJobShareFunctionUrl('https://x.supabase.co/', 'ab c')).toBe(
      'https://x.supabase.co/functions/v1/job-share?t=ab%20c',
    )
  })
})

const payload: JobSharePayload = {
  title: 'Job #951 — Shearer Pinpoint',
  text: 'Job #951 — Shearer Pinpoint\n717 Trinity St, Lockhart, TX',
  url: 'https://pipetooling.com/jobs?jobDetail=j1',
}

describe('runJobShare', () => {
  it('uses the native share sheet when available', async () => {
    const calls: unknown[] = []
    const outcome = await runJobShare(payload, {
      share: async (data) => {
        calls.push(data)
      },
    })
    expect(outcome).toBe('shared')
    expect(calls).toEqual([{ title: payload.title, text: payload.text, url: payload.url }])
  })

  it('reports canceled (not failed) when the user dismisses the sheet', async () => {
    const abort = new Error('canceled')
    abort.name = 'AbortError'
    const outcome = await runJobShare(payload, {
      share: async () => {
        throw abort
      },
      clipboard: {
        writeText: async () => {
          throw new Error('should not fall through on cancel')
        },
      },
    })
    expect(outcome).toBe('canceled')
  })

  it('falls back to the clipboard when share is unavailable', async () => {
    let copied: string | null = null
    const outcome = await runJobShare(payload, {
      clipboard: {
        writeText: async (text) => {
          copied = text
        },
      },
    })
    expect(outcome).toBe('copied')
    expect(copied).toBe(`${payload.text}\n${payload.url}`)
  })

  it('falls back to the clipboard when share throws a non-abort error', async () => {
    let copied: string | null = null
    const outcome = await runJobShare(payload, {
      share: async () => {
        throw new Error('NotAllowedError-ish')
      },
      clipboard: {
        writeText: async (text) => {
          copied = text
        },
      },
    })
    expect(outcome).toBe('copied')
    expect(copied).not.toBeNull()
  })

  it('reports failed when neither share nor clipboard is available', async () => {
    expect(await runJobShare(payload, {})).toBe('failed')
  })

  it('reports failed when the clipboard write throws', async () => {
    const outcome = await runJobShare(payload, {
      clipboard: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    })
    expect(outcome).toBe('failed')
  })
})

describe('buildJobSharePreviewUrl', () => {
  it('builds the branded share URL with an encoded token', () => {
    expect(buildJobSharePreviewUrl('ab c')).toBe('https://share.clicktooling.com/?t=ab%20c')
  })
})
