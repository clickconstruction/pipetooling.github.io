// @vitest-environment jsdom
/**
 * The public terms page when it cannot load (punch list #184, v2.5965): a lost signal reads No connection with Try
 * again, which loads the terms; a refused answer reads the class in the page's language, never the server's words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import EstimatePublicTerms from './EstimatePublicTerms'

const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('EstimatePublicTerms failures (v2.5965)', () => {
  it('a lost signal reads No connection with Try again, which loads the terms', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(answer(200, { body: 'Net 15. Work is warrantied one year.', issuer: null }))
    vi.stubGlobal('fetch', fetchMock)
    render(<EstimatePublicTerms />)
    expect(await screen.findByText('No connection. Check your signal and try again.')).toBeTruthy()
    expect(screen.queryByText(/Check your connection/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Net 15. Work is warrantied one year.')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a refused answer reads the class in the page’s Spanish, never the function’s words', async () => {
    window.history.replaceState({}, '', '/estimate/terms?lang=es')
    vi.stubGlobal('fetch', vi.fn(async () => answer(500, { error: 'Server misconfigured' })))
    render(<EstimatePublicTerms />)
    expect(await screen.findByText('No pudimos abrir esta página. Intente de nuevo más tarde.')).toBeTruthy()
    expect(screen.queryByText('Server misconfigured')).toBeNull()
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeTruthy()
  })
})

describe('EstimatePublicTerms with nothing published (v2.5986)', () => {
  it('says so and names the next step, in the page’s language', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(200, { body: '', issuer: null })))
    render(<EstimatePublicTerms />)
    expect(await screen.findByText('No terms have been published yet. Please call the office for a copy.')).toBeTruthy()
    cleanup()
    window.history.replaceState({}, '', '/estimate/terms?lang=es')
    render(<EstimatePublicTerms />)
    expect(await screen.findByText('Aún no se han publicado los términos. Llame a la oficina para pedir una copia.')).toBeTruthy()
  })
})
