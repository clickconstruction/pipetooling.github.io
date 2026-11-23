import { describe, expect, it } from 'vitest'
import type { UserRole } from '../../hooks/useAuth'
import { isPhoneOfficeRole, needsYouInitialMode } from '../dashboard/phoneOffice'
import { pageModeEligibleForRole, type PageMode } from '../pageMode'
import type { NeedsYouItem } from '../dashboardNeedsYou'
import { groupNeedsYouItems, needsYouWalkItems } from '../needsYouActor'
import { DISPATCH_MODE_INBOX_PATH, JOB_MODE_INBOX_PATH, needsYouDashboardDoor, needsYouDoorLine, needsYouInboxPath, needsYouJobModeDoor, needsYouLienStripUnderDoor } from './needsYouPlace'

const ROLES: UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']
const MODES: PageMode[] = ['task', 'job', 'dispatch', 'full']

describe('the Inbox tab a mode has', () => {
  it('Dispatch Mode and Job Mode each have one; no mode and Task Mode have none', () => {
    expect(needsYouInboxPath('dispatch')).toBe('/dispatch-mode/inbox')
    expect(needsYouInboxPath('job')).toBe('/job-mode/inbox')
    expect(needsYouInboxPath('full')).toBeNull()
    expect(needsYouInboxPath('task')).toBeNull()
  })
})

const OFFICE_DOOR = { to: DISPATCH_MODE_INBOX_PATH, cardsStay: false }

describe('the Dashboard with the switch off', () => {
  it('draws the door only for an office person on a phone with Dispatch Mode on, as before the switch', () => {
    for (const mode of MODES) {
      for (const phoneOffice of [false, true]) {
        const door = needsYouDashboardDoor({ newPhoneLayout: false, phoneOffice, mode })
        expect(door).toEqual(phoneOffice && mode === 'dispatch' ? OFFICE_DOOR : null)
      }
    }
  })

  it('draws nothing on Job Mode’s own Dashboard', () => {
    expect(needsYouJobModeDoor({ newPhoneLayout: false })).toBeNull()
  })
})

describe('the Dashboard with the switch on', () => {
  it('draws the door wherever the mode has an Inbox tab, whoever the person is', () => {
    for (const phoneOffice of [false, true]) {
      expect(needsYouDashboardDoor({ newPhoneLayout: true, phoneOffice, mode: 'dispatch' })?.to).toBe(DISPATCH_MODE_INBOX_PATH)
      expect(needsYouDashboardDoor({ newPhoneLayout: true, phoneOffice, mode: 'job' })?.to).toBe(JOB_MODE_INBOX_PATH)
    }
  })

  it('keeps the card where the door would have nowhere to lead', () => {
    for (const phoneOffice of [false, true]) {
      expect(needsYouDashboardDoor({ newPhoneLayout: true, phoneOffice, mode: 'full' })).toBeNull()
      expect(needsYouDashboardDoor({ newPhoneLayout: true, phoneOffice, mode: 'task' })).toBeNull()
    }
  })

  it('changes nothing on the office person’s phone that had the door already', () => {
    expect(needsYouDashboardDoor({ newPhoneLayout: true, phoneOffice: true, mode: 'dispatch' })).toEqual(OFFICE_DOOR)
    expect(needsYouDashboardDoor({ newPhoneLayout: false, phoneOffice: true, mode: 'dispatch' })).toEqual(OFFICE_DOOR)
  })

  it('a door that is new under the switch stands in for the card alone: the cards under the list stay', () => {
    expect(needsYouDashboardDoor({ newPhoneLayout: true, phoneOffice: false, mode: 'dispatch' })).toEqual({ to: DISPATCH_MODE_INBOX_PATH, cardsStay: true })
    for (const phoneOffice of [false, true]) expect(needsYouDashboardDoor({ newPhoneLayout: true, phoneOffice, mode: 'job' })).toEqual({ to: JOB_MODE_INBOX_PATH, cardsStay: true })
  })

  it('draws the door on Job Mode’s own Dashboard, to Job Mode’s Inbox', () => {
    expect(needsYouJobModeDoor({ newPhoneLayout: true })).toBe(JOB_MODE_INBOX_PATH)
  })
})

/**
 * What each role gets in every mode it can hold. Which mode a phone starts in is each mode's own rule
 * (`jobModeToggle.ts`, `pageMode.ts`) and no part of this one, so the table holds whichever way those answer.
 * `job` is Job Mode's own Dashboard. `job, full dashboard` is the page behind its Show full dashboard press.
 */
describe('every role, in every mode it can hold', () => {
  const places = (role: UserRole, newPhoneLayout: boolean) => {
    const phoneOffice = isPhoneOfficeRole(role)
    const view = needsYouInitialMode({ stored: null, isPhone: true, role, newPhoneLayout })
    // `taking the cards`: the office's round and what waits on the leader go to the Inbox tab with the list.
    const say = (door: { to: string; cardsStay: boolean } | null) => (door ? `door to ${door.to}${door.cardsStay ? '' : ', taking the cards'}` : 'card')
    const out: Record<string, string> = {
      full: say(needsYouDashboardDoor({ newPhoneLayout, phoneOffice, mode: 'full' })),
      task: say(needsYouDashboardDoor({ newPhoneLayout, phoneOffice, mode: 'task' })),
    }
    if (pageModeEligibleForRole(role, 'dispatch')) out.dispatch = say(needsYouDashboardDoor({ newPhoneLayout, phoneOffice, mode: 'dispatch' }))
    if (pageModeEligibleForRole(role, 'job')) {
      const own = needsYouJobModeDoor({ newPhoneLayout })
      out.job = own ? `door to ${own}` : 'nothing'
      out['job, full dashboard'] = say(needsYouDashboardDoor({ newPhoneLayout, phoneOffice, mode: 'job' }))
    }
    return { ...out, 'the card opens on': view }
  }
  const staff = (dispatch: string, view: string, on: boolean) => ({
    full: 'card',
    task: 'card',
    dispatch,
    job: on ? 'door to /job-mode/inbox' : 'nothing',
    'job, full dashboard': on ? 'door to /job-mode/inbox' : 'card',
    'the card opens on': view,
  })
  const field = (view: string, on: boolean) => ({
    full: 'card',
    task: 'card',
    job: on ? 'door to /job-mode/inbox' : 'nothing',
    'job, full dashboard': on ? 'door to /job-mode/inbox' : 'card',
    'the card opens on': view,
  })

  it('every role can hold Job Mode, and only the staff Dispatch Mode', () => {
    expect(ROLES.filter((r) => pageModeEligibleForRole(r, 'job'))).toEqual(ROLES)
    expect(ROLES.filter((r) => pageModeEligibleForRole(r, 'dispatch'))).toEqual(['dev', 'master_technician', 'assistant', 'controller'])
  })

  it('switch off: as the app was before the switch', () => {
    expect(Object.fromEntries(ROLES.map((r) => [r, places(r, false)]))).toEqual({
      dev: staff('card', 'cards', false),
      master_technician: staff('card', 'cards', false),
      assistant: staff('door to /dispatch-mode/inbox, taking the cards', 'walk', false),
      controller: staff('door to /dispatch-mode/inbox, taking the cards', 'walk', false),
      estimator: field('walk', false),
      primary: field('walk', false),
      superintendent: field('cards', false),
      subcontractor: field('cards', false),
      helpers: field('cards', false),
    })
  })

  it('switch on: the door wherever there is an Inbox tab, and Walk the list wherever the card is', () => {
    expect(Object.fromEntries(ROLES.map((r) => [r, places(r, true)]))).toEqual({
      dev: staff('door to /dispatch-mode/inbox', 'walk', true),
      master_technician: staff('door to /dispatch-mode/inbox', 'walk', true),
      assistant: staff('door to /dispatch-mode/inbox, taking the cards', 'walk', true),
      controller: staff('door to /dispatch-mode/inbox, taking the cards', 'walk', true),
      estimator: field('walk', true),
      primary: field('walk', true),
      superintendent: field('walk', true),
      subcontractor: field('walk', true),
      helpers: field('walk', true),
    })
  })
})

describe('what the door says', () => {
  // Worst first, as the builder ranks them: an office line, the owner's signature, the viewer's own purchases, an estimator's.
  const LIST: Array<Pick<NeedsYouItem, 'key' | 'title'>> = [
    { key: 'lien-serve-copy', title: '11 filed liens have not been served' },
    { key: 'lien-notice-sign', title: 'Sign 7 lien notices before the run' },
    { key: 'tally-self', title: '3 purchases need a job' },
    { key: 'bid-followups', title: '4 bid follow-ups are due' },
  ]

  it('no list, no door, with the switch off or on', () => {
    for (const role of ROLES) for (const newPhoneLayout of [false, true]) expect(needsYouDoorLine([], { newPhoneLayout, role })).toBeNull()
  })

  it('switch off: every line counted and the first line of the list, whoever reads it', () => {
    for (const role of ROLES) expect(needsYouDoorLine(LIST, { newPhoneLayout: false, role })).toEqual({ count: 4, first: '11 filed liens have not been served' })
  })

  it('switch on: the count the card’s pill shows and the line Walk the list opens on, for every role', () => {
    for (const role of ROLES) {
      const groups = groupNeedsYouItems(LIST, role)
      const line = needsYouDoorLine(LIST, { newPhoneLayout: true, role })!
      expect(line.count, role).toBe(groups.yours.length)
      expect(line.first, role).toBe(needsYouWalkItems(groups)[0]!.title)
    }
    expect(needsYouDoorLine(LIST, { newPhoneLayout: true, role: 'master_technician' })).toEqual({ count: 2, first: 'Sign 7 lien notices before the run' })
    expect(needsYouDoorLine(LIST, { newPhoneLayout: true, role: 'assistant' })).toEqual({ count: 2, first: '11 filed liens have not been served' })
    expect(needsYouDoorLine(LIST, { newPhoneLayout: true, role: 'estimator' })).toEqual({ count: 2, first: '3 purchases need a job' })
    expect(needsYouDoorLine(LIST, { newPhoneLayout: true, role: 'helpers' })).toEqual({ count: 1, first: '3 purchases need a job' })
  })

  it('switch on, with none of the viewer’s own: the door stays, and says how many wait on others', () => {
    const others = LIST.filter((i) => i.key !== 'tally-self')
    expect(needsYouDoorLine(others, { newPhoneLayout: true, role: 'helpers' })).toEqual({ count: 0, first: '3 for others' })
    expect(needsYouDoorLine(others, { newPhoneLayout: true, role: 'superintendent' })).toEqual({ count: 0, first: '3 for others' })
  })

  it('switch on, Job Mode’s own Dashboard: no door for a list with none of the viewer’s own, and the same door otherwise', () => {
    const others = LIST.filter((i) => i.key !== 'tally-self')
    expect(needsYouDoorLine(others, { newPhoneLayout: true, role: 'helpers', ownOnly: true })).toBeNull()
    for (const role of ROLES) expect(needsYouDoorLine(LIST, { newPhoneLayout: true, role, ownOnly: true }), role).toEqual(needsYouDoorLine(LIST, { newPhoneLayout: true, role }))
  })
})

describe('the Lien desk’s strip under the door', () => {
  it('stays on the Dashboard under a door that keeps the cards', () => {
    expect(needsYouLienStripUnderDoor({ door: true, cardsStay: true, bannersHidden: false })).toBe(true)
  })

  it('goes with the list under the office person’s older door, as it has since v2.3883', () => {
    expect(needsYouLienStripUnderDoor({ door: true, cardsStay: false, bannersHidden: false })).toBe(false)
  })

  it('is not drawn with no door: an empty list shows no strip, and the card draws its own', () => {
    expect(needsYouLienStripUnderDoor({ door: false, cardsStay: true, bannersHidden: false })).toBe(false)
  })

  it('is not drawn on Job Mode’s own Dashboard, which draws no banners', () => {
    expect(needsYouLienStripUnderDoor({ door: true, cardsStay: true, bannersHidden: true })).toBe(false)
  })

  it('every door the Dashboard plans: the strip follows the plan’s cardsStay', () => {
    for (const newPhoneLayout of [false, true]) {
      for (const phoneOffice of [false, true]) {
        for (const mode of ['dispatch', 'job', 'task', 'full'] as PageMode[]) {
          const plan = needsYouDashboardDoor({ newPhoneLayout, phoneOffice, mode })
          const strip = needsYouLienStripUnderDoor({ door: plan != null, cardsStay: plan?.cardsStay ?? false, bannersHidden: false })
          // The office person's Dispatch Mode door keeps nothing. Every other door is the new phone layout's and keeps it.
          expect(strip, `${newPhoneLayout} ${phoneOffice} ${mode}`).toBe(plan != null && !(phoneOffice && mode === 'dispatch'))
        }
      }
    }
  })
})
