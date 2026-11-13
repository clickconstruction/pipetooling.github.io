import { describe, expect, it } from 'vitest'
import { putOnBidLogLine, putOnBidWords, startBidName, VIEWER_PRESS_WORDS, viewerPresses, type ViewerFacts } from './emailViewerActions'

const email = (over: Partial<ViewerFacts> = {}): ViewerFacts => ({ jobId: null, channel: 'email', direction: 'in', invitation: false, role: 'assistant', ...over })

describe('viewerPresses: which presses the email viewer’s row offers (v2.6509)', () => {
  it('an invitation to bid offers Start a bid and Put it on a bid, and no change order, even on a job', () => {
    expect(viewerPresses(email({ invitation: true }))).toEqual(['start_bid', 'put_on_bid'])
    expect(viewerPresses(email({ invitation: true, jobId: 'project:p-church' }))).toEqual(['start_bid', 'put_on_bid'])
    expect(viewerPresses(email({ invitation: true, jobId: 'pipeline:j-579' }))).toEqual(['start_bid', 'put_on_bid'])
  })

  it('an email on no job offers the two bid presses too; a text on no job offers nothing', () => {
    expect(viewerPresses(email())).toEqual(['start_bid', 'put_on_bid'])
    expect(viewerPresses(email({ channel: 'text' }))).toEqual([])
    expect(viewerPresses(email({ direction: 'out' }))).toEqual([])
  })

  it('a line tied to a GC project offers Start a change order; one on a Pipeline job leaves it to the estimate', () => {
    expect(viewerPresses(email({ jobId: 'project:p-church' }))).toEqual(['change_order'])
    expect(viewerPresses(email({ jobId: 'project:p-church', channel: 'text' }))).toEqual(['change_order'])
    expect(viewerPresses(email({ jobId: 'pipeline:j-579' }))).toEqual([])
  })

  it('a line tied to a bid offers Open the bid, whatever else it is', () => {
    expect(viewerPresses(email({ jobId: 'bid:b-512' }))).toEqual(['open_bid'])
    expect(viewerPresses(email({ jobId: 'bid:b-512', invitation: true }))).toEqual(['open_bid'])
    expect(viewerPresses(email({ jobId: 'bid:b-512', channel: 'text' }))).toEqual(['open_bid'])
  })

  it('offers nothing to someone off the office team, nor on a note or an event', () => {
    expect(viewerPresses(email({ role: 'superintendent', invitation: true }))).toEqual([])
    expect(viewerPresses(email({ role: null }))).toEqual([])
    expect(viewerPresses(email({ channel: 'note', direction: 'team', jobId: 'project:p-church' }))).toEqual([])
    expect(viewerPresses(email({ channel: 'event', direction: 'team' }))).toEqual([])
  })

  it('each press has a label and a hover card in plain words', () => {
    expect(VIEWER_PRESS_WORDS.start_bid.label).toBe('Start a bid')
    expect(VIEWER_PRESS_WORDS.put_on_bid.label).toBe('Put it on a bid…')
    expect(VIEWER_PRESS_WORDS.open_bid.label).toBe('Open the bid')
    expect(VIEWER_PRESS_WORDS.change_order.label).toBe('Start a change order')
    for (const w of Object.values(VIEWER_PRESS_WORDS)) expect(w.tip.length).toBeGreaterThan(20)
  })
})

describe('the words around the presses', () => {
  it('the bid’s name starts with what the reader read, else the subject', () => {
    expect(startBidName({ subject: 'Northeast Bible Church Elementary Building - Invitation to Bid' }, { project: 'Northeast Bible Church Elementary Building' })).toBe('Northeast Bible Church Elementary Building')
    expect(startBidName({ subject: ' Re: fixture schedule ' }, null)).toBe('Re: fixture schedule')
    expect(startBidName({ subject: null }, { project: null })).toBe('')
  })

  it('the log line names what came in, from whom and the day, in the app’s time zone', () => {
    const line = { who: 'Glenn Gelwin', at: '2026-10-22T15:08:00Z', subject: 'Northeast Bible Church Elementary Building @ San Antonio - Invitation to Bid' }
    expect(putOnBidLogLine(line, 'invitation')).toBe('Invitation to bid came in by email from Glenn Gelwin, Oct 22.')
    expect(putOnBidLogLine(line, 'addendum')).toBe('Addendum came in by email from Glenn Gelwin, Oct 22.')
    expect(putOnBidLogLine({ ...line, subject: 'Re: fixture schedule' }, null)).toBe('An email came in from Glenn Gelwin, Oct 22: Re: fixture schedule.')
    // Late evening UTC is still the same civil day in Texas only until 7 PM; after midnight UTC it is the day before.
    expect(putOnBidLogLine({ who: '', at: '2026-10-23T02:00:00Z', subject: null }, null)).toBe('An email came in from someone, Oct 22.')
  })

  it('the toast names the bid', () => {
    expect(putOnBidWords({ num: 'B512', name: 'Oak Hill Clinic' })).toBe('Put on B512 Oak Hill Clinic. Its history says it came in by email.')
  })
})
