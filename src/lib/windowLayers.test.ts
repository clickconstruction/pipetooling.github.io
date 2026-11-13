import { describe, expect, it } from 'vitest'
import { ADD_TASK_PICKER_Z, ADD_TASK_WINDOW_Z, ROADMAP_TASK_PICKER_Z, ROADMAP_TASK_WINDOW_Z, THREAD_WINDOW_Z } from './windowLayers'

describe('the windows over a conversation', () => {
  it('puts Add a task over the thread window, and its picker over Add a task', () => {
    expect(ADD_TASK_WINDOW_Z).toBeGreaterThan(THREAD_WINDOW_Z)
    expect(ADD_TASK_PICKER_Z).toBeGreaterThan(ADD_TASK_WINDOW_Z)
  })

  it('puts what a roadmap task window opens over that window, and both over Add a task', () => {
    expect(ROADMAP_TASK_PICKER_Z).toBeGreaterThan(ROADMAP_TASK_WINDOW_Z)
    expect(ROADMAP_TASK_WINDOW_Z).toBeGreaterThan(ADD_TASK_PICKER_Z)
  })
})
