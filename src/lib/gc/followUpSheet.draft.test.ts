// GC mode, the real build, the Building lane's U2b: followUpDraft's tests, moved from the prototype (branch spike/gc-mode, gcFollowUpSheet.test.ts).
import { describe, expect, it } from 'vitest'
import { followUpDraft, followUpPeople, type FollowPerson } from './followUpSheet'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const person = (s: GcState, partnerId: string, also?: string): FollowPerson => {
  const p = followUpPeople(s, also).find((x) => x.partner.id === partnerId)
  if (!p) throw new Error(`no ${partnerId}`)
  return p
}

describe('the Follow up sheet', () => {
  it('drafts a quick nudge from me, a note, and one from the company', () => {
    const s = initialGcState()
    const greg = person(s, 'hillside')
    expect(followUpDraft(greg, greg.items, { from: 'me', via: 'text', length: 'nudge' }, 'Robert Douglas').body).toBe(
      "Hi Greg, it's Robert at Click. Just checking on your sitework quote for Boerne Retail Shell. You'd said Wed Sep 30. Could you send it today? Thanks!",
    )
    const note = followUpDraft(greg, greg.items, { from: 'me', via: 'email', length: 'note' }, 'Robert Douglas')
    expect(note.subject).toBe('Your sitework quote for Boerne Retail Shell')
    expect(note.body.split('\n\n')).toEqual([
      'Hi Greg,',
      "Hope your week is going well. I'm following up on your sitework quote for Boerne Retail Shell.",
      "You'd said Wed Sep 30. Could you send it today?",
      'Our bid to the customer is due Thu Oct 8.',
      expect.stringMatching(/^Everything is in your portal: clicktooling\.com\/t\//),
      'Thanks,\nRobert Douglas\nClick Construction',
    ])
    expect(followUpDraft(greg, greg.items, { from: 'company', via: 'email', length: 'nudge' }, 'Robert Douglas').body).toMatch(
      /^Hello Greg,\n\nClick Construction is following up on your sitework quote for Boerne Retail Shell\. You'd said Wed Sep 30\. Could you send it today\?/,
    )
  })

  it('several things in one message; Spanish for a company that chose it', () => {
    const s = initialGcState()
    const marcus = person(s, 'pecanvalley')
    expect(followUpDraft(marcus, marcus.items, { from: 'me', via: 'text', length: 'nudge' }, 'Robert Douglas').body).toBe(
      "Hi Marcus, it's Robert at Click. Just checking on your insurance certificate and the unconditional waiver for draw 1 on Fair Oaks Shops, Building D. Could you send them this week? Thanks!",
    )
    const es = { ...marcus, partner: { ...marcus.partner, lang: 'es' as const } }
    expect(followUpDraft(es, es.items.slice(0, 1), { from: 'me', via: 'text', length: 'nudge' }, 'Robert Douglas').body).toBe(
      'Hola Marcus, le escribe Robert de Click. Solo quería consultarle sobre su certificado de seguro. El que tenemos venció el 15 sep. ¿Nos puede enviar el nuevo? ¡Gracias!',
    )
  })

})
