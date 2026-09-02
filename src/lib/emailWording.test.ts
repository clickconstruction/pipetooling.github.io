import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingle = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle } ) }),
    }),
  },
}))

import {
  clearEmailWordingCacheForTests,
  escapeEmailHtml,
  fetchEmailWordingOverride,
  renderEmailWording,
  resolveEmailWording,
} from './emailWording'

beforeEach(() => {
  clearEmailWordingCacheForTests()
  maybeSingle.mockReset()
})

describe('renderEmailWording', () => {
  it('substitutes provided keys (with optional spaces) and leaves unknown tokens visible', () => {
    expect(renderEmailWording('Release — {{project}} ({{ amount }})', { project: 'Kent', amount: '$1' })).toBe(
      'Release — Kent ($1)',
    )
    expect(renderEmailWording('Hi {{name}}, re {{typo_var}}', { name: 'Jo' })).toBe('Hi Jo, re {{typo_var}}')
  })

  it('escapes html and never interprets variable values as markup', () => {
    expect(escapeEmailHtml('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;')
    expect(renderEmailWording('{{x}}', { x: '<script>' })).toBe('<script>')
  })
})

describe('resolveEmailWording', () => {
  it('uses the override when a row exists, renders vars, and reports overridden', async () => {
    maybeSingle.mockResolvedValue({ data: { subject: 'Custom — {{project}}', body: 'Body {{amount}}\nline2' } })
    const out = await resolveEmailWording('lien_release_to_customer', { project: 'Kent', amount: '$1' }, {
      subject: 'fallback',
      body: 'fallback',
    })
    expect(out).toEqual({
      subject: 'Custom — Kent',
      text: 'Body $1\nline2',
      html: 'Body $1<br>line2',
      overridden: true,
    })
  })

  it('falls back to built-in wording when no row / blank row / query error', async () => {
    maybeSingle.mockResolvedValue({ data: null })
    const out = await resolveEmailWording('hazmat_notice', { n: '1' }, { subject: 'S {{n}}', body: 'B {{n}}' })
    expect(out.subject).toBe('S 1')
    expect(out.overridden).toBe(false)
    clearEmailWordingCacheForTests()
    maybeSingle.mockRejectedValue(new Error('down'))
    const out2 = await resolveEmailWording('hazmat_notice', {}, { subject: 's', body: 'b' })
    expect(out2.overridden).toBe(false)
  })

  it('caches per template type — one query for repeated sends', async () => {
    maybeSingle.mockResolvedValue({ data: null })
    await fetchEmailWordingOverride('t1')
    await fetchEmailWordingOverride('t1')
    expect(maybeSingle).toHaveBeenCalledTimes(1)
  })
})
