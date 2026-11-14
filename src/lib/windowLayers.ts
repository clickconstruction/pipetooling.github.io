/**
 * The layers of the windows that open over a conversation (v2.7069, punch list #319).
 *
 * A thread's window sits at 1200. Add a task used to sit at 1012, above Job Detail (1004) and Edit Job (1010), which
 * put it under the thread's window: **Ask a tech…** and **Send as a task** opened it where nobody could see it. It
 * sits above the thread's window now, and the picker it drops down sits above it.
 */

/** The thread's window (`ThreadWindow`). */
export const THREAD_WINDOW_Z = 1200

/** Add a task (`ChecklistAddModal`): over the thread's window, Job Detail and Edit Job. */
export const ADD_TASK_WINDOW_Z = 1210

/** What Add a task opens through a portal, its notify list and its place sheet (`TaskPlaceSheet`): over Add a task itself. */
export const ADD_TASK_PICKER_Z = 1220

/**
 * A roadmap task's windows, its card and Add task (`.roadmap-task-overlay`, `ChecklistTechTreeAddTaskModal`). They sit
 * far up because the roadmap's canvas can fill the screen and its windows must sit over it.
 */
export const ROADMAP_TASK_WINDOW_Z = 10050

/**
 * What a roadmap task's window opens through a portal, its place sheet: over that window. The sheet opened behind
 * both roadmap windows until this layer was named (punch list #328).
 */
export const ROADMAP_TASK_PICKER_Z = 10060

/**
 * A painted map's window (`PaintedMapWindow`, punch list #345). It opens from the line under a job's address, so it
 * sits over Job Detail (1004), Edit Job (1010), a thread's window and Add a task.
 */
export const PAINTED_MAP_WINDOW_Z = 1230

/** What a painted map's window opens over itself: the start sheet and a place's sheet. A confirm sits above both (1300). */
export const PAINTED_MAP_SHEET_Z = 1240

