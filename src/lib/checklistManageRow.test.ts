import { describe, expect, it } from 'vitest'
import { ROW_MENU_LINE_PX, rowMenuPlacement, showsNotifiesOnDone } from './checklistManageRow'

describe('rowMenuPlacement', () => {
  // An iPhone 17 Pro in Safari: 402 wide, about 740 of page.
  const phone = { viewportWidth: 402, viewportHeight: 740 }

  it('opens under its press when there is room', () => {
    expect(rowMenuPlacement({ ...phone, anchorTop: 200, anchorBottom: 236, anchorRight: 370, menuHeight: 2 * ROW_MENU_LINE_PX })).toEqual({ right: 32, top: 240, opensUp: false })
  })

  it('opens above its press on the last task, where Delete used to be cut off', () => {
    // The only task a search found: its press sits 60 px above the bottom, and the menu is 120 px.
    expect(rowMenuPlacement({ ...phone, anchorTop: 644, anchorBottom: 680, anchorRight: 370, menuHeight: 3 * ROW_MENU_LINE_PX })).toEqual({ right: 32, bottom: 100, opensUp: true })
  })

  it('stays under its press when neither side fits and there is more room below', () => {
    expect(rowMenuPlacement({ viewportWidth: 402, viewportHeight: 200, anchorTop: 40, anchorBottom: 76, anchorRight: 370, menuHeight: 160 })).toEqual({ right: 32, top: 80, opensUp: false })
  })

  it('never hangs off the right edge', () => {
    expect(rowMenuPlacement({ ...phone, anchorTop: 200, anchorBottom: 236, anchorRight: 400, menuHeight: 80 }).right).toBe(8)
  })

  it('takes the gap it is given', () => {
    expect(rowMenuPlacement({ ...phone, anchorTop: 200, anchorBottom: 236, anchorRight: 370, menuHeight: 80, gap: 0 }).top).toBe(236)
  })
})

describe('showsNotifiesOnDone', () => {
  const mine = { notifyCreator: true, notifyOtherUserId: null, creatorId: 'me', assigneeIds: ['me'] }

  it('is quiet on a task only for its giver, whose bell the window hides', () => {
    expect(showsNotifiesOnDone(mine)).toBe(false)
  })

  it('shows when someone else has the task and the giver hears', () => {
    expect(showsNotifiesOnDone({ ...mine, assigneeIds: ['theo'] })).toBe(true)
    expect(showsNotifiesOnDone({ ...mine, assigneeIds: ['me', 'theo'] })).toBe(true)
  })

  it('shows when someone else is told, whoever has the task', () => {
    expect(showsNotifiesOnDone({ ...mine, notifyCreator: false, notifyOtherUserId: 'grace' })).toBe(true)
  })

  it('is quiet when nobody is told', () => {
    expect(showsNotifiesOnDone({ ...mine, notifyCreator: false, assigneeIds: ['theo'] })).toBe(false)
  })

  it('shows on a task nobody has yet, as it did', () => {
    expect(showsNotifiesOnDone({ ...mine, assigneeIds: [] })).toBe(true)
  })
})
