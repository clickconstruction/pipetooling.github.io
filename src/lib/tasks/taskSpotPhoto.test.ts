/** The giver's photo of the spot (punch list #328, PR 6): the one shape its name in the bucket takes. */
import { describe, expect, it } from 'vitest'
import { isTaskSpotPhotoPath, taskSpotPhotoOwner, taskSpotPhotoPath, taskSpotPhotoTable } from './taskSpotPhoto'

const ITEM = '20000000-0000-0000-0000-000000000001'

describe('taskSpotPhoto', () => {
  it('names a task\'s photo item/<task>/<photo>.jpg and a roadmap task\'s roadmap/<task>/<photo>.jpg', () => {
    expect(taskSpotPhotoPath({ kind: 'item', id: ITEM }, 'p1')).toBe(`item/${ITEM}/p1.jpg`)
    expect(taskSpotPhotoPath({ kind: 'roadmap', id: ITEM }, 'p1')).toBe(`roadmap/${ITEM}/p1.jpg`)
  })

  it('reads the task back from the name', () => {
    expect(taskSpotPhotoOwner(`item/${ITEM}/p1.jpg`)).toEqual({ kind: 'item', id: ITEM })
    expect(taskSpotPhotoOwner(`roadmap/${ITEM}/a-b_c.webp`)).toEqual({ kind: 'roadmap', id: ITEM })
  })

  it('a name of any other shape belongs to nothing, so a mangled column reads as no photo', () => {
    for (const bad of ['', null, undefined, 'p1.jpg', `other/${ITEM}/p1.jpg`, 'item/not-a-uuid/p1.jpg', `item/${ITEM}/a/b.jpg`, `item/${ITEM}/p1.gif`, `item/${ITEM}/../x.jpg`]) {
      expect(taskSpotPhotoOwner(bad), String(bad)).toBeNull()
      expect(isTaskSpotPhotoPath(bad), String(bad)).toBe(false)
    }
    expect(isTaskSpotPhotoPath(`item/${ITEM}/p1.jpg`)).toBe(true)
  })

  it('knows which table holds the path', () => {
    expect(taskSpotPhotoTable({ kind: 'item', id: ITEM })).toBe('checklist_items')
    expect(taskSpotPhotoTable({ kind: 'roadmap', id: ITEM })).toBe('checklist_tech_tree_group_tasks')
  })
})
