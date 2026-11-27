// @vitest-environment jsdom
/**
 * The trade's portal on a phone (finding 290, the walk of 2026-11-27: its presses stood about 30 px at every width).
 * The portal's shell carries a mark and one style rule, and the rule grows every press inside the shell on a phone.
 * A test page applies no screen-width rule, so the heights are measured in the pictures and not here. This holds the
 * wiring: the mark, the rule, and that every press of the page is inside the shell. The sample is the function's own.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { installDomShims } from '../../test/renderSmokeMocks'
import { readTradePortalAnswer, sentMessages, tradeFilesByProject } from '../../lib/gc/tradePortalPage'
import { tradePortalState } from '../../lib/gc/tradePortalState'
import { phoneThumbPressesCss } from '../../lib/phonePress'
import { gcTradePortalSample, gcTradePortalSampleFlow, gcTradePortalSampleSchedules, gcTradePortalSampleScheduleWork, gcTradePortalSampleThread } from '../../../supabase/functions/_shared/gcTradePortalSample'
import { PortalPressContext, type PortalPress } from './gcTradePortalPress'
import { GcTradePortalView } from './GcTradePortalView'

installDomShims()
afterEach(cleanup)

const TODAY = '2026-11-27'
/** The sample's presses go nowhere and say nothing, as on the sample portal. */
const press: PortalPress = { preview: false, send: async () => null, upload: async () => ({ problem: null, file: null }), openPaper: async () => null, lateWaiting: async () => [] }

function portal() {
  const page = readTradePortalAnswer(true, {
    today: TODAY,
    slice: gcTradePortalSample(TODAY),
    schedules: gcTradePortalSampleSchedules(TODAY),
    ...gcTradePortalSampleScheduleWork(TODAY),
    flow: gcTradePortalSampleFlow(TODAY),
    thread: gcTradePortalSampleThread(TODAY),
    sample: true,
  })
  if (page.kind !== 'ready') throw new Error('the sample did not read')
  const mapped = tradePortalState(page.slice, page.today)
  return render(
    <PortalPressContext.Provider value={press}>
      <GcTradePortalView
        state={mapped.state}
        partnerId={mapped.partnerId}
        lang="en"
        messages={sentMessages(page.slice)}
        planUrl={() => ''}
        files={tradeFilesByProject(page.slice)}
        schedules={page.schedules}
        scheduleWork={page.scheduleWork}
        scheduleTodos={page.scheduleTodos}
        flow={page.flow}
        thread={page.thread}
      />
    </PortalPressContext.Provider>,
  )
}
const shell = () => document.querySelector<HTMLElement>('[data-trade-portal]')
const pressesOutsideTheShell = () => Array.from(document.querySelectorAll('button, a[href]')).filter((el) => !shell()?.contains(el))

describe('GcTradePortalView · presses on a phone', () => {
  it('marks its shell and carries the one rule that grows the presses inside it', () => {
    portal()
    expect(shell()).not.toBeNull()
    const rules = Array.from(shell()!.querySelectorAll('style')).map((s) => s.textContent)
    expect(rules).toContain(phoneThumbPressesCss('[data-trade-portal]'))
  })

  it('draws every press of the home, of Messages and of a job inside the shell', () => {
    portal()
    expect(document.querySelectorAll('[data-trade-portal] button').length).toBeGreaterThan(10)
    expect(pressesOutsideTheShell()).toEqual([])
    fireEvent.click(screen.getByRole('tab', { name: 'Messages' }))
    expect(pressesOutsideTheShell()).toEqual([])
    fireEvent.click(screen.getByRole('tab', { name: 'Your portal' }))
    fireEvent.click(screen.getByRole('button', { name: /^Sample Dental Office/ }))
    expect(document.querySelectorAll('[data-trade-portal] button').length).toBeGreaterThan(20)
    expect(document.querySelectorAll('[data-trade-portal] a[href]').length).toBeGreaterThan(3)
    expect(pressesOutsideTheShell()).toEqual([])
  })
})
