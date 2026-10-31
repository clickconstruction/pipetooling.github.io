// @vitest-environment jsdom
/**
 * Render smoke for Quickfill's kept deck on screen (punch list #183 PR 4): the Roller's screen and
 * the phone's round list with `kept` set draw the stamp *Counts from 7:52 AM · counting again…*,
 * mute the count under `data-kept-read` (the rule read off `index.css`), and hold Done and Worked
 * it as dead presses with *reading again…* while Not sure and Skip stay live. The words are the
 * kernels' (`keptRead.test.ts`, `markOutcome.test.ts`, `keptDeck.test.ts`); here they reach the
 * screen. Made-up rows.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QuickfillRoundScreen } from './QuickfillRoundScreen'
import { QuickfillRoundList } from './QuickfillRoundList'
import type { RoundRow } from '../../lib/quickfill/round'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

// The question's ? card reads the viewer through the client; a stub answers every read empty.
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const READ_AT = Date.UTC(2026, 9, 31, 12, 52) // 7:52 AM in Chicago
const format = { timeZone: APP_CALENDAR_TZ }

/** The `[data-kept-read]` rules of index.css, put on the page so jsdom computes them. */
function installKeptReadCss() {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
  const rules = css.match(/^\[data-kept-read\][^{]*\{[^}]*\}/gm) ?? []
  const style = document.createElement('style')
  style.setAttribute('data-test', '')
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}

afterEach(() => {
  cleanup()
  document.querySelectorAll('style[data-test]').forEach((s) => s.remove())
})

function rollerScreen(kept: { failed: boolean; onRetry: () => void } | null) {
  return (
    <MemoryRouter>
      <QuickfillRoundScreen
        wide
        label="Messages"
        position={{ index: 2, total: 9 }}
        question="Who is waiting on us?"
        countLine={kept ? '3 open at 7:52 AM' : '3 open'}
        lastLook="last look 22h ago · Marisol"
        nextLine="Reply to Ridgeway Builders · waiting 3 days"
        liveCount={3}
        countLoading={false}
        kept={kept ? { readAt: READ_AT, failed: kept.failed, onRetry: kept.onRetry, format } : null}
        held={kept != null}
        needsNote={false}
        personal={false}
        marking={false}
        onBack={() => undefined}
        onSkip={() => undefined}
        onPrev={null}
        onPress={() => undefined}
        onHistory={() => undefined}
        strip={<div>the strip</div>}
      >
        <p>Messages body</p>
      </QuickfillRoundScreen>
    </MemoryRouter>
  )
}

describe('the Roller’s screen on a kept deck (#183 PR 4)', () => {
  it('draws the stamp, mutes the count, and holds Done and Worked it as dead presses while Not sure and Skip stay live', () => {
    installKeptReadCss()
    render(rollerScreen({ failed: false, onRetry: () => undefined }))
    const stamp = screen.getByRole('status')
    expect(stamp.textContent).toBe('Counts from 7:52 AM · counting again…')
    const count = screen.getByText('3 open at 7:52 AM')
    expect(count.className).toBe('keptCount')
    expect(count.closest('[data-kept-read]')).not.toBeNull()
    expect(getComputedStyle(count).opacity).toBe('0.55')
    expect(screen.getByText('Reply to Ridgeway Builders · waiting 3 days', { exact: false })).toBeTruthy()
    const done = screen.getByRole('button', { name: 'Done · 0 open · Messages' }) as HTMLButtonElement
    const worked = screen.getByRole('button', { name: 'Worked it · 3 left · Messages' }) as HTMLButtonElement
    const notSure = screen.getByRole('button', { name: 'Not sure what to do · Messages' }) as HTMLButtonElement
    expect(done.disabled).toBe(true)
    expect(worked.disabled).toBe(true)
    expect(done.title).toBe('reading again…')
    expect(worked.title).toBe('reading again…')
    expect(worked.getAttribute('data-held')).toBe('true')
    expect(worked.className).toBe('keptPress')
    expect(getComputedStyle(worked).pointerEvents).toBe('none')
    expect(worked.textContent).toContain('reading again…')
    expect(notSure.disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Skip' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('Messages body')).toBeTruthy()
  })

  it('says could not read again with Retry once the deck’s read failed, and Retry is the page’s read again', () => {
    const onRetry = vi.fn()
    render(rollerScreen({ failed: true, onRetry }))
    expect(screen.getByRole('status').textContent).toBe('Counts from 7:52 AM · could not read again · Retry')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('draws no stamp and lights Worked it on a live deck', () => {
    render(rollerScreen(null))
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelector('[data-kept-read]')).toBeNull()
    expect((screen.getByRole('button', { name: 'Worked it · 3 left · Messages' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

const rows: RoundRow[] = [
  { sectionId: 'warnings', label: 'Warnings', personal: false, needsNote: false, state: 'due', rhythmDays: 7, overDays: 2, dueAtMs: null, count: 2, countSource: 'last_look', lastMarkedAt: '2026-10-22T14:00:00Z', lastMarkedByName: 'Dana' },
  { sectionId: 'messages', label: 'Messages', personal: false, needsNote: false, state: 'due_today', rhythmDays: 1, overDays: null, dueAtMs: null, count: 3, countSource: 'open', lastMarkedAt: '2026-10-30T14:00:00Z', lastMarkedByName: 'Marisol' },
  { sectionId: 'my-inbox', label: 'My Inbox', personal: true, needsNote: false, state: 'never', rhythmDays: null, overDays: null, dueAtMs: null, count: null, countSource: 'none', lastMarkedAt: null, lastMarkedByName: null },
]

describe('the phone’s round list on a kept deck (#183 PR 4)', () => {
  it('draws the stamp over the head and mutes each row’s count', () => {
    installKeptReadCss()
    render(
      <MemoryRouter>
        <QuickfillRoundList rows={rows} kept={{ readAt: READ_AT, failed: false, onRetry: () => undefined, format }} search="" onSearch={() => undefined} onOpen={() => undefined} now={new Date('2026-10-31T14:00:00Z')} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status').textContent).toBe('Counts from 7:52 AM · counting again…')
    const three = screen.getByText('3')
    const counted = three.parentElement!
    expect(counted.className).toBe('keptCount')
    expect(getComputedStyle(counted).opacity).toBe('0.55')
    expect(screen.getByText('at last look')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Round · 2/ })).toBeTruthy()
  })
})
