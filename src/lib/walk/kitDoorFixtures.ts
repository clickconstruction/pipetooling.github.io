/**
 * The rows the three door run tests share (punch list #142 PR 5): the kit as `walk_setup` writes it, and the five
 * accounts a door meets — the office, the walk tester, a View-as sample, a digital twin and a training account that is
 * not the tester. Ids are UUIDs because `messages-email` checks them. Test-only.
 */
export const KIT = {
  customerId: '11111111-1111-4111-8111-111111111111',
  contactId: '22222222-2222-4222-8222-222222222222',
  emailChannelId: '33333333-3333-4333-8333-333333333333',
  phoneChannelId: '44444444-4444-4444-8444-444444444444',
  estimateId: '55555555-5555-4555-8555-555555555555',
  email: 'bids@clickplumbing.example',
  phone: '(737) 300-9478',
  testerId: 'u-tester',
  sharedPhone: false,
  madeAt: '2026-10-22T14:00:00.000Z',
}

export const KIT_ROW = { key: 'walk_kit_v1', value_text: JSON.stringify(KIT) }

/** Someone else's contact and channel, and another estimate: what the tester must never reach. */
export const OTHER = {
  contactId: '66666666-6666-4666-8666-666666666666',
  channelId: '77777777-7777-4777-8777-777777777777',
  estimateId: '88888888-8888-4888-8888-888888888888',
}

export const SESSIONS: Record<string, string> = {
  'office-jwt': 'u-pat',
  'tester-jwt': 'u-tester',
  'sample-jwt': 'u-sample',
  'twin-jwt': 'u-twin',
  'training-jwt': 'u-trainee',
}

const account = { is_sample: false, is_digital_twin: false, is_walk_tester: false, read_only: false, archived_at: null }

export const USERS = [
  { ...account, id: 'u-pat', name: 'Office Pat', role: 'assistant', email: 'pat@example.com' },
  { ...account, id: 'u-tester', name: 'ZZ Walk tester', role: 'assistant', email: 'walk-tester@walk.pipetooling.local', read_only: true, is_walk_tester: true },
  { ...account, id: 'u-sample', name: 'Sample assistant', role: 'assistant', email: 'sample-assistant@samples.pipetooling.local', is_sample: true },
  { ...account, id: 'u-twin', name: 'Twin Estimator 1', role: 'estimator', email: 'twin-1@twins.pipetooling.local', is_digital_twin: true },
  { ...account, id: 'u-trainee', name: 'Trainee Tam', role: 'assistant', email: 'tam@example.com', read_only: true },
]
