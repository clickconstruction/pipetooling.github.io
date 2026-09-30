// @vitest-environment jsdom
/**
 * Render smoke for the in-app email preview: a preview still being built says
 * so and then shows the email, a build that lands after Back is dropped, and a
 * build that fails closes the overlay and hands the reason to the caller.
 */
import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useEmailPreview } from '../../hooks/useEmailPreview'
import { EmailPreviewOverlay } from './EmailPreviewOverlay'

type Deferred = { promise: Promise<string>; resolve: (html: string) => void; reject: (e: Error) => void }
function deferred(): Deferred {
  let resolve!: (html: string) => void
  let reject!: (e: Error) => void
  const promise = new Promise<string>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function Host({ build }: { build: () => Promise<string> }) {
  const emailPreview = useEmailPreview()
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <button type="button" onClick={() => emailPreview.show('The week’s list email', build()).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Preview failed'))}>
        Preview
      </button>
      {error ? <p>{error}</p> : null}
      {emailPreview.preview ? <EmailPreviewOverlay preview={emailPreview.preview} onClose={emailPreview.close} /> : null}
    </div>
  )
}

const overlay = () => screen.queryByRole('dialog', { name: 'Preview: The week’s list email' })

describe('EmailPreviewOverlay', () => {
  it('is up at once, says it is building, then shows the email', async () => {
    const d = deferred()
    render(<Host build={() => d.promise} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(overlay()).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Building the preview…')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '← Back' }))
    await act(async () => d.resolve('<html><head></head><body>Knight owes $26,000</body></html>'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByTitle('Preview: The week’s list email').getAttribute('srcdoc')).toContain('Knight owes $26,000')
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(overlay()).toBeNull()
  })

  it('drops a build that lands after Back', async () => {
    const d = deferred()
    render(<Host build={() => d.promise} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    await act(async () => d.resolve('<p>late</p>'))
    expect(overlay()).toBeNull()
  })

  it('closes on a failed build and gives the caller the reason', async () => {
    const d = deferred()
    render(<Host build={() => d.promise} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    await act(async () => d.reject(new Error('Preview failed: no round')))
    expect(overlay()).toBeNull()
    expect(screen.getByText('Preview failed: no round')).toBeTruthy()
  })
})
