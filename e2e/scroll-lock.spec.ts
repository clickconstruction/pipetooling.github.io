import { test, expect, type Page } from '@playwright/test'

/**
 * The page behind a window (v2.4399 – v2.4403). Two invariants, on a phone:
 *
 *  1. While a window is open the page behind it cannot scroll (the body is
 *     pinned by the `scroll-locked` class on <html>, `lib/bodyScrollLock.ts`).
 *  2. After it closes nothing is left behind: no class, no `overflow: hidden`
 *     or `position: fixed` on the body, and the page is at the offset it had.
 *
 * Each case pins one of the gaps that was measured on 2026-10-02: a window
 * with its own older lock left the page frozen after it closed (Pay history);
 * a window that stops above the Dispatch / Job mode bar covered under 90% of a
 * short screen and was never locked (the Lien desk); the public pages had no
 * lock at all. READ-ONLY: windows are opened and closed, nothing is saved.
 */

const PHONE = { width: 375, height: 812 }
/** Short enough that a window ending above the 60 px bottom bar covers under 90% of it. */
const SHORT_PHONE = { width: 375, height: 590 }

test.use({ viewport: PHONE })

type LockState = { locked: boolean; frozen: boolean; scrollY: number }

async function lockState(page: Page): Promise<LockState> {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.body)
    const inline = document.body.style
    return {
      // What the lock does: the class, and the pinned body it produces.
      locked: document.documentElement.classList.contains('scroll-locked') && cs.position === 'fixed',
      // Anything at all that would hold the page still — the lock, or a style left on the body.
      frozen:
        document.documentElement.classList.contains('scroll-locked') ||
        cs.position === 'fixed' ||
        cs.overflowY === 'hidden' ||
        inline.overflow === 'hidden' ||
        inline.position === 'fixed',
      scrollY: window.scrollY,
    }
  })
}

async function expectLocked(page: Page, label: string) {
  await expect
    .poll(async () => (await lockState(page)).locked, { message: `${label}: the page behind the window is not held still` })
    .toBe(true)
}

async function expectFree(page: Page, label: string) {
  await expect
    .poll(async () => (await lockState(page)).frozen, { message: `${label}: the page is still frozen with no window open` })
    .toBe(false)
}

test('a window freezes the page, and closing it gives the page back', async ({ page }) => {
  await page.goto('/jobs?tab=inspections')
  const open = page.getByRole('button', { name: 'Add Inspection', exact: true })
  await expect(open).toBeVisible({ timeout: 30000 })
  await open.click()
  await expect(page.getByRole('heading', { name: 'Add inspection' })).toBeVisible()
  await expectLocked(page, 'Add inspection')
  // Escape does not close this window; Cancel on an untouched form closes it without a question.
  await page.getByRole('dialog').filter({ hasText: 'Add inspection' }).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add inspection' })).toBeHidden()
  await expectFree(page, 'Add inspection closed')
})

test('Pay history leaves nothing on the page after it closes, and the page is where it was (v2.4399)', async ({ page }) => {
  // The window that kept `overflow: hidden` on the body: its own effect and the app-wide lock
  // saved and restored the same style around each other.
  await page.goto('/people?tab=employment')
  const person = page.locator('main button').filter({ hasText: /Helper|Assistants|Estimators|Primaries|Leaders|Superintendents|Devs/ }).first()
  await expect(person).toBeVisible({ timeout: 30000 })
  await person.click()
  const payHistory = page.getByRole('button', { name: 'Pay history', exact: true })
  await expect(payHistory).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 120))
  const before = (await lockState(page)).scrollY
  expect(before, 'the Employment page is too short to scroll: the offset check would prove nothing').toBeGreaterThan(0)
  // A dispatched click: a real one first scrolls the button clear of the header, and the offset
  // under test would no longer be the one set above.
  await payHistory.dispatchEvent('click')
  await expect(page.getByRole('dialog').filter({ hasText: 'Pay history' })).toBeVisible()
  await expectLocked(page, 'Pay history')
  const pinnedAt = await page.evaluate(() => document.documentElement.style.getPropertyValue('--scroll-lock-top').trim())
  expect(pinnedAt, 'the page was not pinned at the offset it had').toBe(`-${before}px`)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog').filter({ hasText: 'Pay history' })).toBeHidden()
  await expectFree(page, 'Pay history closed')
  expect((await lockState(page)).scrollY, 'the page jumped when the window closed').toBe(before)
})

test.describe('a short phone', () => {
  test.use({ viewport: SHORT_PHONE })

  test('the Lien desk holds the page still even when it stops above the bottom bar (v2.4400)', async ({ page }) => {
    await page.goto('/jobs?tab=stages&liendesk=1')
    const desk = page.getByRole('dialog', { name: 'Lien desk' })
    await expect(desk).toBeVisible({ timeout: 30000 })
    await expectLocked(page, 'Lien desk')
    // The lock re-checks itself every 3 s while held; a window it does not count is let go then.
    await page.waitForTimeout(4000)
    expect((await lockState(page)).locked, 'Lien desk: the lock let go after its own re-check').toBe(true)
    await desk.getByRole('button', { name: 'Close', exact: true }).first().click()
    await expect(desk).toBeHidden()
    await expectFree(page, 'Lien desk closed')
  })
})

test('the lock runs on a public page too (v2.4402)', async ({ page }) => {
  // No public window opens without a customer's link, so a stand-in window is put on the page:
  // what is pinned is that the watcher is mounted outside the signed-in layout.
  await page.goto('/submittal')
  await expect(page.getByText('This link is incomplete.')).toBeVisible()
  await expectFree(page, '/submittal')
  await page.evaluate(() => {
    const backdrop = document.createElement('div')
    backdrop.id = 'e2e-scroll-lock-probe'
    backdrop.style.cssText = 'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4)'
    const panel = document.createElement('div')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.style.cssText = 'margin: 40px; height: 200px; background: white'
    backdrop.appendChild(panel)
    document.body.appendChild(backdrop)
  })
  await expectLocked(page, '/submittal with a window open')
  await page.evaluate(() => document.getElementById('e2e-scroll-lock-probe')?.remove())
  await expectFree(page, '/submittal after the window closed')
})
