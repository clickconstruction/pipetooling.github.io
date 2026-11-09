// @vitest-environment jsdom
/**
 * Punch list #205, PR 6: the Word to every trade window on main's test state. Fair Oaks Shops, Building D has six
 * companies awarded a trade: the button counts them, stays dead until words are typed, sends once for every company,
 * and names the one that was refused and the one that already had the words. Every sentence a first-timer reads passes
 * plain words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcWordToTrades } from './GcWordToTrades'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { GC_TRADE_EMAIL_REFUSALS } from '../../lib/gc/tradeEmail'
import type { WordRecipient } from '../../lib/gc/wordToTrades'
import type { WordToTrades } from '../../lib/gc/wordToTradesIo'
import { plainWordsFailures } from '../../lib/plainWords'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((x) => x.id === 'fairoaksd')!

describe('GcWordToTrades: one email to every company on the job', () => {
  it('counts the companies on its button, wakes once words are typed, sends once for every company and names each outcome', async () => {
    const answer: WordToTrades = {
      sent: [
        { companyId: 'tricounty', company: 'Tri-County Site' },
        { companyId: 'guadalupe', company: 'Guadalupe Flatwork' },
        { companyId: 'ironhorse', company: 'Iron Horse Fabrication' },
        { companyId: 'pecanvalley', company: 'Pecan Valley Electric' },
      ],
      already: [{ companyId: 'summit', company: 'Summit Roofing' }],
      refused: [{ companyId: 'coolbreeze', company: 'Cool Breeze Mechanical', words: GC_TRADE_EMAIL_REFUSALS.noEmail }],
    }
    const onSend = vi.fn((_r: WordRecipient[], _subject: string, _text: string) => Promise.resolve(answer))
    const onClose = vi.fn()
    render(<GcWordToTrades state={s} project={fairOaks} onSend={onSend} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Word to every trade' })
    const chips = within(within(dialog).getByRole('group', { name: 'Companies on this job' })).getAllByText(/·/)
    expect(chips.map((c) => c.textContent)).toEqual([
      'Tri-County Site · Sitework',
      'Guadalupe Flatwork · Concrete',
      'Iron Horse Fabrication · Structural steel',
      'Pecan Valley Electric · Electrical',
      'Summit Roofing · Roofing',
      'Cool Breeze Mechanical · HVAC',
    ])
    expect((within(dialog).getByLabelText('Subject') as HTMLInputElement).value).toBe('A word from Click on Fair Oaks Shops, Building D')
    const tell = within(dialog).getByRole('button', { name: 'Tell 6 companies' }) as HTMLButtonElement
    expect(tell.disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('The word'), { target: { value: 'The site is closed Friday for the pour.\n\nPark on the north lot from Monday.' } })
    expect(tell.disabled).toBe(false)
    fireEvent.click(tell)
    await waitFor(() => expect(dialog.querySelector('[data-word-result]')).toBeTruthy())
    expect(onSend).toHaveBeenCalledTimes(1)
    const [recipients, subject, text] = onSend.mock.calls[0]!
    expect(recipients.map((r) => r.partner.id)).toEqual(['tricounty', 'guadalupe', 'ironhorse', 'pecanvalley', 'summit', 'coolbreeze'])
    expect(subject).toBe('A word from Click on Fair Oaks Shops, Building D')
    expect(text).toContain('Park on the north lot')
    const result = dialog.querySelector('[data-word-result]')!.textContent!
    expect(result).toContain('Sent 4 emails. 1 did not send.')
    expect(result).toContain('Sent to Tri-County Site, Guadalupe Flatwork, Iron Horse Fabrication and Pecan Valley Electric.')
    expect(result).toContain('Summit Roofing already had these words. Nothing was sent again.')
    expect(result).toContain(`Cool Breeze Mechanical: ${GC_TRADE_EMAIL_REFUSALS.noEmail}`)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('is dead with nobody awarded, and says so', () => {
    const none = { ...fairOaks, packages: fairOaks.packages.map((k) => ({ ...k, awardedInviteId: null })) }
    render(<GcWordToTrades state={s} project={none} onSend={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('No company is awarded a trade on this job yet. Award one first.')).toBeTruthy()
    const tell = screen.getByRole('button', { name: 'Tell companies' }) as HTMLButtonElement
    fireEvent.change(screen.getByLabelText('The word'), { target: { value: 'Hello.' } })
    expect(tell.disabled).toBe(true)
  })

  it('says each thing a first-timer reads in plain words', () => {
    const said = [
      'Word to every trade on Fair Oaks Shops, Building D',
      'One email to every company awarded a trade on this job.',
      'It goes to the people who get the job’s emails, in their language.',
      '6 emails go out, each with the company\'s portal link.',
      'The same words go once.',
      'Each company reads it in its portal too.',
      'Sent 4 emails.',
      '1 did not send.',
      'Summit Roofing already had these words.',
      'Nothing was sent again.',
      'No company is awarded a trade on this job yet.',
      'Award one first.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
