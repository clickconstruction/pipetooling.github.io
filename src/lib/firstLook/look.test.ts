import { describe, expect, it } from 'vitest'
import {
  FIRST_LOOK_SAMPLE_WORDS,
  firstLookSampleOf,
  firstLookSamplePayload,
  FIRST_LOOK_ALPHABET,
  FIRST_LOOK_CAPS,
  FIRST_LOOK_CODE_RE,
  clockWords,
  firstLookAskLine,
  firstLookAskedWords,
  firstLookBytesWords,
  firstLookClientWords,
  firstLookClosesWords,
  firstLookCode,
  firstLookCountWords,
  firstLookDeskName,
  firstLookDeskStanding,
  firstLookExpiry,
  firstLookFileFacts,
  firstLookKindOfMime,
  firstLookMimeOf,
  firstLookObjectPath,
  firstLookPageView,
  firstLookSendLabel,
  firstLookSentLine,
  firstLookSignRefusal,
  firstLookSniff,
  firstLookState,
  firstLookThanks,
  firstNameOf,
  hexOf,
  mintFirstLookCode,
  canOpenFirstLooks,
  showUsPath,
} from './look'

const bytesOf = (...parts: Array<number | string>): Uint8Array => {
  const out: number[] = []
  for (const p of parts) {
    if (typeof p === 'number') out.push(p)
    else for (const ch of p) out.push(ch.charCodeAt(0))
  }
  while (out.length < 16) out.push(0)
  return new Uint8Array(out)
}

describe('first look: the code', () => {
  it('reads ten letters of the alphabet, lower-cased, and nothing else', () => {
    expect(firstLookCode(' K7M2P9XQ4D ')).toBe('k7m2p9xq4d')
    expect(firstLookCode('k7m2p9xq4')).toBeNull()
    expect(firstLookCode('k7m2p9xq4dd')).toBeNull()
    expect(firstLookCode('k7m2p9xq4l')).toBeNull() // l is a look-alike, not in the alphabet
    expect(firstLookCode('k7m2p9xq40')).toBeNull()
    expect(firstLookCode(null)).toBeNull()
  })

  it('mints ten letters and throws away a byte at or past 248', () => {
    const feed = [new Uint8Array([248, 255, 0, 30, 31, 62, 249, 5, 6, 7, 8, 9, 10, 11])]
    const code = mintFirstLookCode(() => feed.shift() ?? new Uint8Array(32))
    expect(code).toMatch(FIRST_LOOK_CODE_RE)
    // 0 → '2', 30 → 'z', 31 → '2' again (31 % 31), 62 → '2', then 5,6,7,8,9,10 by their place in the alphabet.
    expect(code).toBe(`2z22${FIRST_LOOK_ALPHABET[5]}${FIRST_LOOK_ALPHABET[6]}${FIRST_LOOK_ALPHABET[7]}${FIRST_LOOK_ALPHABET[8]}${FIRST_LOOK_ALPHABET[9]}${FIRST_LOOK_ALPHABET[10]}`)
  })

  it('asks for more bytes when a draw comes up short, and gives up on a source that never helps', () => {
    let asks = 0
    const code = mintFirstLookCode(() => {
      asks++
      return asks === 1 ? new Uint8Array([250, 251, 1]) : new Uint8Array(32).fill(3)
    })
    expect(code).toBe(`${FIRST_LOOK_ALPHABET[1]}${(FIRST_LOOK_ALPHABET[3] ?? '').repeat(9)}`)
    expect(() => mintFirstLookCode(() => new Uint8Array(32).fill(255))).toThrow()
  })

  it('every letter is as likely as another over a spread of bytes', () => {
    const seen = new Map<string, number>()
    for (let b = 0; b < 248; b++) {
      const letter = FIRST_LOOK_ALPHABET[b % FIRST_LOOK_ALPHABET.length] ?? ''
      seen.set(letter, (seen.get(letter) ?? 0) + 1)
    }
    expect(new Set(seen.values())).toEqual(new Set([8]))
    expect(seen.size).toBe(31)
  })

  it('hex and the paths', () => {
    expect(hexOf(new Uint8Array([0, 15, 255]))).toBe('000fff')
    expect(showUsPath('k7m2p9xq4d')).toBe('/show/k7m2p9xq4d')
    expect(firstLookObjectPath('look', 'file', 'video/quicktime')).toBe('look/file.mov')
    expect(firstLookObjectPath('look', 'file', 'IMAGE/JPEG; charset=x')).toBe('look/file.jpg')
    expect(firstLookObjectPath('look', 'file', 'text/plain')).toBe('look/file.bin')
  })
})

describe('first look: what a link may take', () => {
  const none = { photos: 0, videos: 0, photoSigns: 0, videoSigns: 0 }

  it('knows a photo from a video from neither', () => {
    expect(firstLookKindOfMime('image/jpeg')).toBe('photo')
    expect(firstLookKindOfMime('IMAGE/HEIC')).toBe('photo')
    expect(firstLookKindOfMime('video/quicktime')).toBe('video')
    expect(firstLookKindOfMime('video/mp4; codecs=avc1')).toBe('video')
    expect(firstLookKindOfMime('application/pdf')).toBeNull()
    expect(firstLookKindOfMime('')).toBeNull()
    expect(firstLookKindOfMime(null)).toBeNull()
  })

  it('reads a file\'s type from the phone, or from its name when the phone gives none', () => {
    expect(firstLookMimeOf({ type: 'video/quicktime', name: 'IMG_0042.MOV' })).toBe('video/quicktime')
    expect(firstLookMimeOf({ type: '', name: 'IMG_0042.MOV' })).toBe('video/quicktime')
    expect(firstLookMimeOf({ type: '', name: 'drip.mp4' })).toBe('video/mp4')
    expect(firstLookMimeOf({ type: null, name: 'label.JPEG' })).toBe('image/jpeg')
    expect(firstLookMimeOf({ type: '', name: 'quote.pdf' })).toBe('')
    expect(firstLookMimeOf({ type: '', name: 'no-ending' })).toBe('')
    // A type the phone did give is trusted over the name: a PDF named .jpg is still not a photo.
    expect(firstLookMimeOf({ type: 'application/pdf', name: 'quote.jpg' })).toBe('')
  })

  it('takes a photo and a video inside the caps', () => {
    expect(firstLookSignRefusal({ mime: 'image/jpeg', bytes: 700_000 }, none)).toBeNull()
    expect(firstLookSignRefusal({ mime: 'video/mp4', bytes: FIRST_LOOK_CAPS.videoBytes }, none)).toBeNull()
  })

  it('refuses in words what it will not take', () => {
    expect(firstLookSignRefusal({ mime: 'application/pdf', bytes: 10 }, none)?.code).toBe('kind')
    expect(firstLookSignRefusal({ mime: 'image/jpeg', bytes: 0 }, none)?.code).toBe('empty')
    expect(firstLookSignRefusal({ mime: 'image/jpeg', bytes: FIRST_LOOK_CAPS.photoBytes + 1 }, none)?.code).toBe('photo-big')
    const big = firstLookSignRefusal({ mime: 'video/mp4', bytes: FIRST_LOOK_CAPS.videoBytes + 1 }, none)
    expect(big?.code).toBe('video-big')
    expect(big?.words).toContain('50 MB')
    expect(firstLookSignRefusal({ mime: 'image/jpeg', bytes: 10 }, { ...none, photos: 20, photoSigns: 20 })?.code).toBe('photos-full')
    expect(firstLookSignRefusal({ mime: 'video/mp4', bytes: 10 }, { ...none, videos: 3, videoSigns: 3 })?.code).toBe('videos-full')
    // A link that was handed addresses and never finished a file is stopped too, each kind by its own count.
    expect(firstLookSignRefusal({ mime: 'image/jpeg', bytes: 10 }, { ...none, photos: 1, photoSigns: FIRST_LOOK_CAPS.photoSigns })?.code).toBe('signs-full')
    expect(firstLookSignRefusal({ mime: 'video/mp4', bytes: 10 }, { ...none, videoSigns: FIRST_LOOK_CAPS.videoSigns })?.code).toBe('signs-full')
    expect(firstLookSignRefusal({ mime: 'video/mp4', bytes: 10 }, { ...none, photoSigns: FIRST_LOOK_CAPS.photoSigns })).toBeNull()
  })

  it('a video is not stopped by a full set of photos, nor a photo by a full set of videos', () => {
    expect(firstLookSignRefusal({ mime: 'video/mp4', bytes: 10 }, { ...none, photos: 20, photoSigns: 20 })).toBeNull()
    expect(firstLookSignRefusal({ mime: 'image/png', bytes: 10 }, { ...none, videos: 3, videoSigns: 3 })).toBeNull()
  })
})

describe('first look: the first bytes of a file', () => {
  it('reads a picture', () => {
    expect(firstLookSniff(bytesOf(0xff, 0xd8, 0xff, 0xe0))).toBe('photo')
    expect(firstLookSniff(bytesOf(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('photo')
    expect(firstLookSniff(bytesOf('RIFF', 1, 2, 3, 4, 'WEBP'))).toBe('photo')
    expect(firstLookSniff(bytesOf(0, 0, 0, 0x18, 'ftyp', 'heic'))).toBe('photo')
    expect(firstLookSniff(bytesOf(0, 0, 0, 0x18, 'ftyp', 'mif1'))).toBe('photo')
  })

  it('reads a video', () => {
    expect(firstLookSniff(bytesOf(0, 0, 0, 0x14, 'ftyp', 'qt  '))).toBe('video')
    expect(firstLookSniff(bytesOf(0, 0, 0, 0x18, 'ftyp', 'isom'))).toBe('video')
    expect(firstLookSniff(bytesOf(0, 0, 0, 0x18, 'ftyp', 'mp42'))).toBe('video')
    expect(firstLookSniff(bytesOf(0x1a, 0x45, 0xdf, 0xa3))).toBe('video')
    // An older camera's movie opens with no ftyp.
    expect(firstLookSniff(bytesOf(0, 0, 0, 8, 'wide', 0, 0, 0, 0, 'mdat'))).toBe('video')
    expect(firstLookSniff(bytesOf(0, 0, 0x10, 0, 'moov'))).toBe('video')
  })

  it('reads anything else as neither', () => {
    expect(firstLookSniff(bytesOf('%PDF-1.7'))).toBeNull()
    expect(firstLookSniff(bytesOf('MZ', 0x90, 0))).toBeNull()
    expect(firstLookSniff(bytesOf('<html><body>'))).toBeNull()
    expect(firstLookSniff(new Uint8Array([0xff, 0xd8]))).toBeNull()
  })
})

describe('first look: a look\'s state', () => {
  const now = '2026-11-12T12:00:00.000Z'
  it('open, closed, run out', () => {
    expect(firstLookState({ closed_at: null, expires_at: '2026-11-13T00:00:00.000Z' }, now)).toBe('open')
    expect(firstLookState({ closed_at: '2026-11-12T11:00:00.000Z', expires_at: '2026-11-13T00:00:00.000Z' }, now)).toBe('closed')
    expect(firstLookState({ closed_at: null, expires_at: now }, now)).toBe('expired')
  })
  it('a link made now takes files for seven days', () => {
    expect(firstLookExpiry(now)).toBe('2026-11-19T12:00:00.000Z')
  })
})

describe('first look: the words', () => {
  it('counts', () => {
    expect(firstLookCountWords(3, 1)).toBe('3 photos and 1 video')
    expect(firstLookCountWords(1, 0)).toBe('1 photo')
    expect(firstLookCountWords(0, 2)).toBe('2 videos')
    expect(firstLookCountWords(0, 0)).toBe('')
  })

  it('names who asked, or nobody', () => {
    expect(firstNameOf('  Rosa Delgado ')).toBe('Rosa')
    expect(firstNameOf('')).toBe('')
    expect(firstLookAskedWords('Rosa Delgado')).toBe('Rosa asked for a look. Add a few photos or a short video. We price it before we come out.')
    expect(firstLookAskedWords('')).toMatch(/^We asked for a look\./)
  })

  it('the send press says exactly what it will do, or why it waits', () => {
    expect(firstLookSendLabel({ photos: 3, videos: 1, sending: 0, percent: null, waitingForSignal: false })).toEqual({ label: 'Send 3 photos and 1 video', ready: true })
    expect(firstLookSendLabel({ photos: 3, videos: 0, sending: 1, percent: 62, waitingForSignal: false })).toEqual({ label: 'Waiting for one file, 62%', ready: false })
    expect(firstLookSendLabel({ photos: 0, videos: 0, sending: 2, percent: null, waitingForSignal: false })).toEqual({ label: 'Waiting for 2 files', ready: false })
    expect(firstLookSendLabel({ photos: 3, videos: 0, sending: 1, percent: 10, waitingForSignal: true })).toEqual({ label: 'Sends when the signal is back', ready: false })
    expect(firstLookSendLabel({ photos: 0, videos: 0, sending: 0, percent: null, waitingForSignal: false }).ready).toBe(false)
  })

  it('the thank-you promises only the office\'s own hours', () => {
    const open = firstLookThanks({ askedBy: 'Rosa', photos: 3, videos: 1, officeOpen: true, closesWords: '5 PM', opensWords: null })
    expect(open.got).toBe('Got it. Rosa has your 3 photos and 1 video.')
    expect(open.steps[0]).toBe('Rosa looks at them today, before 5 PM.')
    const shut = firstLookThanks({ askedBy: 'Rosa', photos: 1, videos: 0, officeOpen: false, closesWords: null, opensWords: 'tomorrow at 7:30 AM' })
    expect(shut.steps[0]).toBe('We look first thing tomorrow at 7:30 AM.')
    const nobody = firstLookThanks({ askedBy: '', photos: 0, videos: 1, officeOpen: true, closesWords: null, opensWords: null })
    expect(nobody.got).toBe('Got it. We have your 1 video.')
    expect(nobody.steps[0]).toBe('The office looks at them today.')
    expect(open.steps).toHaveLength(3)
  })

  it('names the closing time only when it is a real one', () => {
    expect(firstLookClosesWords({ closes: '17:00', always: false })).toBe('5 PM')
    expect(firstLookClosesWords({ closes: '23:29', always: false })).toBe('11:29 PM')
    // A day that runs to midnight is around the clock said in hours: no *before 11:59 PM*.
    expect(firstLookClosesWords({ closes: '23:59', always: false })).toBeNull()
    expect(firstLookClosesWords({ closes: '23:30', always: false })).toBeNull()
    expect(firstLookClosesWords({ closes: '17:00', always: true })).toBeNull()
    expect(firstLookClosesWords({ closes: 'late', always: false })).toBeNull()
  })

  it('the thread line is keyed by the send, so a second send is a second line', () => {
    expect(firstLookSentLine({ lookId: 'L', sentCount: 1, photos: 3, videos: 1 })).toEqual({ key: 'look:L:sent:1', body: '📷 Sent 3 photos and 1 video through the Show us link.' })
    expect(firstLookSentLine({ lookId: 'L', sentCount: 2, photos: 4, videos: 1 }).key).toBe('look:L:sent:2')
  })

  it('the ask names who is writing', () => {
    expect(firstLookAskLine({ customerFirst: 'Dana', me: 'Rosa Delgado', url: 'https://x/show/abc' })).toBe(
      'Hi Dana, this is Rosa with Click Plumbing. So we can price this before we come out, send us a few photos or a short video here: https://x/show/abc Or reply to this text with the photos.',
    )
    expect(firstLookAskLine({ customerFirst: 'Dana', me: 'Rosa Delgado', url: 'u', lang: 'es' })).toBe(
      'Hola Dana, habla Rosa de Click Plumbing. Para darle un precio antes de ir, envíenos unas fotos o un video corto aquí: u O responda a este mensaje con las fotos.',
    )
    expect(firstLookAskLine({ customerFirst: null, me: '{me}', url: '{show}' })).toMatch(/^Hi, this is \{me\} with Click Plumbing\..*\{show\} Or reply/)
    expect(firstLookAskLine({ customerFirst: null, me: '', url: 'u' })).toMatch(/^Hi, this is the office with Click Plumbing\./)
  })

  it('sizes, clocks and phones', () => {
    expect(firstLookBytesWords(25_270_000)).toBe('24.1 MB')
    expect(firstLookBytesWords(612 * 1024)).toBe('612 KB')
    expect(firstLookBytesWords(0)).toBe('')
    expect(clockWords('17:00')).toBe('5 PM')
    expect(clockWords('07:30')).toBe('7:30 AM')
    expect(clockWords('12:00')).toBe('12 PM')
    expect(clockWords('00:15')).toBe('12:15 AM')
    expect(clockWords('25:00')).toBe('')
    expect(clockWords(null)).toBe('')
    expect(firstLookClientWords('Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1')).toBe('iPhone Safari')
    expect(firstLookClientWords('Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36')).toBe('Android Chrome')
    expect(firstLookClientWords('Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0 Mobile/15E148 Safari/604.1')).toBe('iPhone Chrome')
    expect(firstLookClientWords(null)).toBe('Other browser')
  })

  it('what the desk says an upload was like', () => {
    expect(firstLookFileFacts({ bytes: 25_270_000, road: 'pieces', resumed: 2, took_ms: 38_400, seconds: 24.2, client: 'iPhone Safari' })).toBe('24.1 MB · 24 s long · in pieces · picked up 2 times · took 38 s · iPhone Safari')
    expect(firstLookFileFacts({ bytes: 700_000, road: 'whole', resumed: 0, took_ms: 1_900, seconds: null, client: null })).toBe('684 KB · in one go · took 1.9 s')
    expect(firstLookFileFacts({ bytes: null, road: null, resumed: 0, took_ms: null, seconds: null, client: null })).toBe('')
  })
})

describe('first look: what the page reads', () => {
  const good = {
    ok: true,
    look: { askedBy: 'Rosa', photos: 2, videos: 1, sentCount: 0 },
    caps: { photos: 20, videos: 3, photoBytes: 8_388_608, videoBytes: 52_428_800 },
    office: { phone: '(512) 555-0100', open: true, closesWords: '5 PM', opensWords: null },
  }

  it('an open look', () => {
    const view = firstLookPageView(200, good)
    expect(view.kind).toBe('open')
    if (view.kind !== 'open') return
    expect(view.payload.look).toEqual({ askedBy: 'Rosa', photos: 2, videos: 1, sentCount: 0 })
    expect(view.payload.office.closesWords).toBe('5 PM')
    expect(view.payload.office.opensWords).toBeNull()
  })

  it('the stops', () => {
    expect(firstLookPageView(404, { error: 'not_found' })).toEqual({ kind: 'not_found' })
    expect(firstLookPageView(429, { code: 'locked' })).toEqual({ kind: 'locked' })
    expect(firstLookPageView(410, { error: 'closed', phone: '(512) 555-0100' })).toEqual({ kind: 'closed', phone: '(512) 555-0100' })
    expect(firstLookPageView(410, { error: 'expired' })).toEqual({ kind: 'expired', phone: '' })
  })

  it('an answer it cannot read is an error, never a throw', () => {
    expect(firstLookPageView(200, null)).toEqual({ kind: 'error', status: 200 })
    expect(firstLookPageView(200, { ok: true })).toEqual({ kind: 'error', status: 200 })
    expect(firstLookPageView(500, 'boom')).toEqual({ kind: 'error', status: 500 })
    expect(firstLookPageView(429, { error: 'Too many requests' })).toEqual({ kind: 'error', status: 429 })
  })

  it('caps the function left out fall back to the kernel\'s own', () => {
    const view = firstLookPageView(200, { ...good, caps: {} })
    expect(view.kind === 'open' && view.payload.caps.videoBytes).toBe(FIRST_LOOK_CAPS.videoBytes)
  })
})

describe('first look: the desk', () => {
  const file = (kind: 'photo' | 'video', finished: boolean) => ({ id: kind + String(finished), kind, mime: '', name: '', bytes: 1, seconds: null, road: null, resumed: 0, took_ms: null, client: null, finished_at: finished ? 'x' : null, url: null })

  it('names a look by its person, its label, or as a test', () => {
    expect(firstLookDeskName({ contactName: 'Dana Whitfield', label: 'x' })).toBe('Dana Whitfield')
    expect(firstLookDeskName({ contactName: null, label: ' My phone ' })).toBe('My phone')
    expect(firstLookDeskName({ contactName: null, label: '' })).toBe('A test look')
  })

  it('says where a look stands', () => {
    expect(firstLookDeskStanding({ state: 'open', openedAt: null, sentAt: null, files: [] })).toBe('Not opened yet')
    expect(firstLookDeskStanding({ state: 'open', openedAt: 'x', sentAt: null, files: [file('photo', false)] })).toBe('Opened, nothing in yet')
    expect(firstLookDeskStanding({ state: 'open', openedAt: 'x', sentAt: null, files: [file('photo', true), file('video', true)] })).toBe('1 photo and 1 video in, not sent yet')
    expect(firstLookDeskStanding({ state: 'open', openedAt: 'x', sentAt: 'x', files: [file('photo', true)] })).toBe('Sent 1 photo')
    expect(firstLookDeskStanding({ state: 'closed', openedAt: 'x', sentAt: 'x', files: [] })).toBe('Closed')
    expect(firstLookDeskStanding({ state: 'expired', openedAt: null, sentAt: null, files: [] })).toBe('Ran out')
  })

  it('opens for the owner and the developers alone', () => {
    expect(canOpenFirstLooks('dev')).toBe(true)
    expect(canOpenFirstLooks('master_technician')).toBe(true)
    for (const role of ['assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers', 'subcontractor'] as const) expect(canOpenFirstLooks(role)).toBe(false)
    expect(canOpenFirstLooks(null)).toBe(false)
  })
})

describe('the sample page (Settings → What customers see)', () => {
  const office = { phone: '(512) 555-0100', open: true, closesWords: '5 PM', opensWords: null }

  it('the two sample words pass as codes and name their sample; a real code names none', () => {
    expect(firstLookCode('sample')).toBe('sample')
    expect(firstLookCode('Sample-Done')).toBe('sample-done')
    expect(firstLookSampleOf('sample')).toBe('open')
    expect(firstLookSampleOf('sample-done')).toBe('done')
    expect(firstLookSampleOf('k7m2p9xq4d')).toBeNull()
    expect(firstLookSampleOf(null)).toBeNull()
    expect(firstLookCode('samples')).toBeNull()
  })

  it('the open sample has nothing in and no thank-you, with the office’s own phone and hours', () => {
    const p = firstLookSamplePayload('open', office)
    expect(p.look).toEqual({ askedBy: 'Rosa', photos: 0, videos: 0, sentCount: 0 })
    expect(p.office).toBe(office)
    expect(p.thanks).toBeNull()
  })

  it('the done sample opens on the thank-you the office’s hours give', () => {
    const p = firstLookSamplePayload('done', office)
    expect(p.look).toEqual({ askedBy: 'Rosa', photos: 3, videos: 1, sentCount: 1 })
    expect(p.thanks?.got).toBe('Got it. Rosa has your 3 photos and 1 video.')
    expect(p.thanks?.steps[0]).toBe('Rosa looks at them today, before 5 PM.')
  })

  it('the page reads the sample’s thank-you from the answer, and a real look’s answer carries none', () => {
    const done = firstLookPageView(200, firstLookSamplePayload('done', office))
    expect(done.kind === 'open' && done.payload.thanks?.got).toBe('Got it. Rosa has your 3 photos and 1 video.')
    const real = firstLookPageView(200, { ok: true, look: { askedBy: 'Rosa', photos: 0, videos: 0, sentCount: 0 }, caps: {}, office: {} })
    expect(real.kind === 'open' && real.payload.thanks).toBeNull()
  })

  it('a file on the sample is answered in words that nothing is sent', () => {
    expect(FIRST_LOOK_SAMPLE_WORDS).toBe('This is a sample of the page. Nothing is sent from it.')
  })
})
