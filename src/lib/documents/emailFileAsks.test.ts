import { describe, expect, it } from 'vitest'
import { parseEmailFiles } from '../../../supabase/functions/_shared/messagesEmailFiles'
import { BOERNE, FAIR_OAKS, HELOTES, IMG_2041, KB, ROCK_CLAUSE } from '../../test/fixtures/jobFilesDemo'
import { emailFileAsk } from './emailFileAsks'
import { jobFiles, type JobFile } from './jobFiles'
import { draftFromDevice, draftFromJob, waysOut, type FileWay } from './outgoing'

/**
 * Messages, cut 7e: a file on the message as `messages-email` takes it, from the mock-up's screen 4 (Greg, a trade
 * partner with a portal: B482's addendum 2 and plan set, and the rock clause from this computer).
 */

const boerne = jobFiles(BOERNE)
const byName = (files: readonly JobFile[], name: string) => files.find((f) => f.name === name)!
const way = (f: JobFile): FileWay => waysOut([draftFromJob(f)], 'email')[0]!

describe('emailFileAsk', () => {
  it('sends the addendum from Drive as the file, by its Drive id', () => {
    const addendum = byName(boerne, 'Addendum 2.pdf')
    expect(emailFileAsk(way(addendum), { audience: 'trade', hasPortal: true, job: addendum })).toEqual({
      key: 'drive:drv-addendum-2',
      source: 'drive',
      ref: 'drv-addendum-2',
      path: null,
      name: 'Addendum 2.pdf',
      mime: '',
      way: 'file',
      page: null,
    })
  })

  it('sends a plan set as their portal at the plans, by its Drive folder, and as our link to someone with no portal', () => {
    const plans = byName(boerne, 'Boerne Retail Shell plans, rev 2')
    const greg = emailFileAsk(way(plans), { audience: 'trade', hasPortal: true, job: plans })
    expect(greg).toMatchObject({ source: 'drive', ref: 'boerne-rev-2-folder', way: 'link', page: 'plans' })
    expect(emailFileAsk(way(plans), { audience: 'arch', hasPortal: false, job: plans })).toMatchObject({ way: 'link', page: null })
    expect(emailFileAsk(way(plans), { audience: 'trade', hasPortal: true, job: { ...plans, driveUrl: null } })).toBeNull()
  })

  it('sends a paper the app makes as its page, and our contract by its send', () => {
    const payApp = byName(jobFiles(FAIR_OAKS), 'Pay application 3.pdf')
    const asLink: FileWay = { file: draftFromJob(payApp), way: 'link', why: null }
    expect(emailFileAsk(asLink, { audience: 'customer', hasPortal: true, job: payApp })).toMatchObject({ source: 'paper', ref: 'payapp:payapp-3', way: 'link', page: 'bills' })
    const contract = byName(jobFiles(HELOTES), 'Our contract.pdf')
    expect(emailFileAsk(way(contract), { audience: 'customer', hasPortal: true, job: contract })).toMatchObject({ source: 'paper', ref: 'contract:contract-helotes', way: 'file', page: null })
  })

  it('reads a file that came in and a sent copy’s file by their own refs', () => {
    const arrived = jobFiles({ arrived: [{ id: 'att-1', name: 'Hillside COI 2027.pdf', bytes: 380 * KB, mime: 'application/pdf', drive_file_id: null, at: '2026-10-12T14:12:00Z' }] })[0]!
    expect(emailFileAsk(way(arrived), { audience: 'trade', hasPortal: true, job: arrived })).toMatchObject({ source: 'arrived', ref: 'att-1', way: 'file' })
    const sent = jobFiles({ sent: [{ sentId: 'sd-1', name: 'Bid tab.pdf', path: 'sd-1/1-bid-tab.pdf', type: 'application/pdf', bytes: 96 * KB, sent_at: '2026-10-09T21:42:00Z' }] })[0]!
    expect(emailFileAsk(way(sent), { audience: 'trade', hasPortal: true, job: sent })).toMatchObject({ source: 'sent', ref: 'sd-1', path: 'sd-1/1-bid-tab.pdf', way: 'file' })
  })

  it('sends a file from this computer with its bytes into Sent by us, and a photo into Photos', () => {
    const rock = draftFromDevice(ROCK_CLAUSE.key, ROCK_CLAUSE.name, ROCK_CLAUSE.bytes, 'pdf', 'computer')
    const photo = draftFromDevice(IMG_2041.key, IMG_2041.name, IMG_2041.bytes, 'image', 'photo')
    const [rockWay, photoWay] = waysOut([rock, photo], 'email')
    expect(emailFileAsk(rockWay!, { audience: 'trade', hasPortal: true, device: { base64: 'JVBERi0=', mime: 'application/pdf' } })).toMatchObject({
      source: 'device',
      ref: '',
      way: 'file',
      landing: 'sent',
      base64: 'JVBERi0=',
    })
    expect(emailFileAsk(photoWay!, { audience: 'trade', hasPortal: true, device: { base64: '/9j/', mime: 'image/jpeg' } })).toMatchObject({ way: 'picture', landing: 'photos' })
    expect(emailFileAsk(rockWay!, { audience: 'trade', hasPortal: true })).toBeNull()
  })

  it('makes asks the function’s parser takes, all of them in one list', () => {
    const addendum = byName(boerne, 'Addendum 2.pdf')
    const plans = byName(boerne, 'Boerne Retail Shell plans, rev 2')
    const rock = waysOut([draftFromDevice(ROCK_CLAUSE.key, ROCK_CLAUSE.name, ROCK_CLAUSE.bytes, 'pdf', 'computer')], 'email')[0]!
    const asks = [
      emailFileAsk(way(addendum), { audience: 'trade', hasPortal: true, job: addendum }),
      emailFileAsk(way(plans), { audience: 'trade', hasPortal: true, job: plans }),
      emailFileAsk(rock, { audience: 'trade', hasPortal: true, device: { base64: 'JVBERi0=', mime: 'application/pdf' } }),
    ]
    // The fixtures' Drive ids are made up and short; the function's parser reads real ones of ten characters or more.
    const real = asks.map((a) => (a && a.source === 'drive' ? { ...a, ref: `${a.ref}-000000` } : a))
    expect(parseEmailFiles(real)?.map((a) => [a.source, a.way, a.page])).toEqual([
      ['drive', 'file', null],
      ['drive', 'link', 'plans'],
      ['device', 'file', null],
    ])
  })
})
