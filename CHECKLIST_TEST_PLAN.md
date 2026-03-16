# Checklist Features Test Plan

Use this plan to verify all checklist features work after the multi-assignee implementation.

**Prerequisites:** Sign in to PipeTooling. Ensure you have at least 2 users for multi-assignee tests.

---

## 1. Today Tab

| # | Action | Expected Result |
|---|--------|-----------------|
| 1.1 | Open Checklist, Today tab | Today's tasks for you load; overdue (if any) appear first |
| 1.2 | Add a task (Add checklist item) with 1 assignee | Task appears in Today list |
| 1.3 | Add a task with 2+ assignees | Task appears for all assignees when they view Today |
| 1.4 | Mark a task complete (checkbox) | Task shows as done; completion persists on refresh |
| 1.5 | Add notes to a task | Notes save and persist |
| 1.6 | Forward a task (FWD) | New item created for target user; original removed from your list |

---

## 2. History Tab

| # | Action | Expected Result |
|---|--------|-----------------|
| 2.1 | Switch to History tab | Calendar grid shows past dates with colored squares |
| 2.2 | Complete a task yourself | Green square for that date |
| 2.3 | Have another assignee complete a task you're assigned to | Yellow square for that date (completed by someone else) |
| 2.4 | Leave a task incomplete | Red square |
| 2.5 | Check legend | "Green = completed by you, Yellow = completed by someone else, Red = incomplete, White = not due" |
| 2.6 | Enable Edit mode, click a cell | Status cycles: incomplete → completed → (deleted) → empty |
| 2.7 | If dev/master/assistant: switch user dropdown | History shows that user's tasks |

---

## 3. Manage Tab

| # | Action | Expected Result |
|---|--------|-----------------|
| 3.1 | Switch to Manage tab | Table of checklist items with Assignees, Repeat, Start, etc. |
| 3.2 | Add item with 2 assignees | "Assigned to" shows "Alice, Bob" (or names) |
| 3.3 | Filter by assignee | Only items with that assignee appear |
| 3.4 | Edit an item, change assignees | Save succeeds; Manage table updates |
| 3.5 | Edit an item, add/remove assignees | Existing instances unchanged; new instances use new assignee list |
| 3.6 | Delete an item | Confirmation; item and instances removed |

---

## 4. Outstanding Tab (dev/master/assistant)

| # | Action | Expected Result |
|---|--------|-----------------|
| 4.1 | Switch to Outstanding tab | List grouped by person with incomplete tasks |
| 4.2 | Expand a person's row | Tasks listed with title and date |
| 4.3 | Forward (FWD) from Outstanding | New item for target; original removed |
| 4.4 | Remind button | Sends reminder (check push/notification if configured) |
| 4.5 | Filter: Non repeating / Next day / Next week / Missed | List filters correctly |

---

## 5. Multi-Assignee Behavior

| # | Action | Expected Result |
|---|--------|-----------------|
| 5.1 | Add item with assignees A and B | Both see the task in Today |
| 5.2 | User A completes the task | Task marked done for both A and B |
| 5.3 | Edit item, remove B, add C | Existing instances still have A and B; new instances have A and C |
| 5.4 | "Days after completion" item: complete it | Next instance created for all current item assignees |

---

## 6. Add Checklist Item Modal

| # | Action | Expected Result |
|---|--------|-----------------|
| 6.1 | Open Add checklist item | Modal with Title, Assign to (multi-select), Start date, Notify, Remind, Repeat |
| 6.2 | Select 2+ users in Assign to | Both selected; validation requires at least one |
| 6.3 | Submit with no assignee | Error: "Select at least one assignee" |
| 6.4 | Submit with valid data | Item created; instances generated for schedule; modal closes |

---

## 7. Dashboard Checklist Widget

| # | Action | Expected Result |
|---|--------|-----------------|
| 7.1 | View Dashboard | Today's checklist tasks shown |
| 7.2 | Complete a task from Dashboard | Task marked done; list updates |
| 7.3 | Forward from Dashboard | Same as Checklist Today forward |

---

## Quick Smoke Test (5 min)

1. Sign in
2. Add a checklist item with yourself as assignee
3. Mark it complete
4. Open History tab, confirm green square
5. Add item with 2 assignees, have the other user complete it
6. Open History as first assignee, confirm yellow square

---

*If any step fails, note the step number and what happened for debugging.*
