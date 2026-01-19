# Workflow Email Notification Testing Guide

This guide helps you systematically test all workflow email notification scenarios.

## Prerequisites

1. **Email Templates Created**: Ensure all workflow email templates exist in the `email_templates` table:
   - `stage_assigned_started`
   - `stage_assigned_complete`
   - `stage_assigned_reopened`
   - `stage_me_started`
   - `stage_me_complete`
   - `stage_me_reopened`
   - `stage_next_complete_or_approved`
   - `stage_prior_rejected`

2. **Edge Function Deployed**: The `send-workflow-notification` Edge Function must be deployed and have `RESEND_API_KEY` secret configured.

3. **Test Users**: Create at least 2-3 test users with different roles and valid email addresses.

4. **Test Project**: Create a test project with a workflow containing multiple steps.

## Notification Types Overview

### 1. Assigned Person Notifications
- **Trigger**: When a stage assigned to someone changes status
- **Settings**: Controlled by flags on the step itself:
  - `notify_assigned_when_started`
  - `notify_assigned_when_complete`
  - `notify_assigned_when_reopened`
- **Templates**: `stage_assigned_*`

### 2. "ME" (Subscribed User) Notifications
- **Trigger**: When a user has subscribed to a stage and it changes status
- **Settings**: Controlled by `step_subscriptions` table:
  - `notify_when_started`
  - `notify_when_complete`
  - `notify_when_reopened`
- **Templates**: `stage_me_*`

### 3. Cross-Step Notifications
- **Next Assignee**: When a stage is completed/approved, notify the next stage's assignee
- **Prior Assignee**: When a stage is rejected, notify the previous stage's assignee
- **Settings**: Controlled by flags on the step:
  - `notify_next_assignee_when_complete_or_approved`
  - `notify_prior_assignee_when_rejected`
- **Templates**: `stage_next_complete_or_approved`, `stage_prior_rejected`

## Step-by-Step Testing Scenarios

### Setup: Create Test Data

1. **Create Test Users** (via Settings or Supabase Dashboard):
   - User A: `testuser1@example.com` (Master Technician)
   - User B: `testuser2@example.com` (Assistant)
   - User C: `testuser3@example.com` (Assistant)

2. **Create Test People** (via People page):
   - Person A: Name "Test User 1", Email `testuser1@example.com`
   - Person B: Name "Test User 2", Email `testuser2@example.com`
   - Person C: Name "Test User 3", Email `testuser3@example.com`
   - **Important**: Names must match exactly between `users` and `people` tables for email lookup

3. **Create Test Project**:
   - Create a customer
   - Create a project
   - Create a workflow with at least 3 steps:
     - Step 1: "Test Step 1" (assign to Person A)
     - Step 2: "Test Step 2" (assign to Person B)
     - Step 3: "Test Step 3" (assign to Person C)

---

## Test Scenario 1: Assigned Person - Stage Started

**Goal**: Test that the assigned person receives an email when a stage is started.

**Steps**:
1. Sign in as User A (or any user with permission to start stages)
2. Navigate to the workflow page
3. Find "Test Step 1" (assigned to Person A)
4. **Enable notification**: Click the notification toggle for "Notify when started" (should show "Notify assigned person when started")
5. **Start the stage**: Click "Start" button
6. **Check email**: User A should receive an email with template `stage_assigned_started`

**Expected Email**:
- **To**: `testuser1@example.com`
- **Template**: `stage_assigned_started`
- **Variables**: Should include `{{name}}`, `{{project_name}}`, `{{stage_name}}`, `{{workflow_link}}`

**Verification**:
- Check Resend dashboard for sent email
- Verify email contains correct project name and stage name
- Verify workflow link works and points to correct step

---

## Test Scenario 2: "ME" (Subscribed User) - Stage Started

**Goal**: Test that a subscribed user receives an email when a stage they're watching is started.

**Steps**:
1. Sign in as User B
2. Navigate to the workflow page
3. Find "Test Step 1" (assigned to Person A, not User B)
4. **Subscribe to stage**: Click the "Notify ME" toggle and enable "Notify when started"
5. Sign in as User A (or another user with permission)
6. **Start the stage**: Click "Start" on "Test Step 1"
7. **Check email**: User B should receive an email with template `stage_me_started`

**Expected Email**:
- **To**: `testuser2@example.com`
- **Template**: `stage_me_started`
- **Variables**: Should include `{{name}}`, `{{project_name}}`, `{{stage_name}}`, `{{workflow_link}}`

**Verification**:
- Check that User B receives the email even though they're not assigned to the stage
- Verify email content is correct

---

## Test Scenario 3: Assigned Person - Stage Completed

**Goal**: Test that the assigned person receives an email when a stage is completed.

**Steps**:
1. Ensure "Test Step 1" is in "in_progress" status
2. **Enable notification**: Ensure "Notify assigned person when complete" is enabled
3. **Complete the stage**: Click "Complete" button
4. **Check email**: User A should receive an email with template `stage_assigned_complete`

**Expected Email**:
- **To**: `testuser1@example.com`
- **Template**: `stage_assigned_complete`
- **Variables**: Should include `{{name}}`, `{{project_name}}`, `{{stage_name}}`, `{{workflow_link}}`

---

## Test Scenario 4: "ME" (Subscribed User) - Stage Completed

**Goal**: Test that a subscribed user receives an email when a stage they're watching is completed.

**Steps**:
1. Ensure User B is still subscribed to "Test Step 1" with "Notify when complete" enabled
2. **Complete the stage**: Click "Complete" on "Test Step 1"
3. **Check email**: User B should receive an email with template `stage_me_complete`

**Expected Email**:
- **To**: `testuser2@example.com`
- **Template**: `stage_me_complete`

---

## Test Scenario 5: Cross-Step - Notify Next Assignee When Complete

**Goal**: Test that the next stage's assignee receives an email when the current stage is completed.

**Prerequisites**:
- "Test Step 1" is completed
- "Test Step 2" is assigned to Person B
- "Test Step 1" has "Notify next assignee when complete or approved" enabled

**Steps**:
1. Navigate to "Test Step 1"
2. **Enable cross-step notification**: Ensure "Notify next card assignee when complete or approved" toggle is ON
3. **Complete or approve the stage**: Click "Complete" or "Approve"
4. **Check email**: User B (assigned to "Test Step 2") should receive an email with template `stage_next_complete_or_approved`

**Expected Email**:
- **To**: `testuser2@example.com`
- **Template**: `stage_next_complete_or_approved`
- **Variables**: Should include `{{previous_stage_name}}` (should be "Test Step 1"), `{{stage_name}}` (should be "Test Step 2")

**Verification**:
- Verify `{{previous_stage_name}}` shows the correct previous stage
- Verify the email indicates that the previous stage is now complete

---

## Test Scenario 6: Cross-Step - Notify Prior Assignee When Rejected

**Goal**: Test that the previous stage's assignee receives an email when the current stage is rejected.

**Prerequisites**:
- "Test Step 1" is completed (assigned to Person A)
- "Test Step 2" is in progress (assigned to Person B)
- "Test Step 2" has "Notify prior assignee when rejected" enabled

**Steps**:
1. Navigate to "Test Step 2"
2. **Enable cross-step notification**: Ensure "Notify prior card assignee when rejected" toggle is ON
3. **Reject the stage**: Click "Reject" and enter a rejection reason (e.g., "Needs more work")
4. **Check email**: User A (assigned to "Test Step 1") should receive an email with template `stage_prior_rejected`

**Expected Email**:
- **To**: `testuser1@example.com`
- **Template**: `stage_prior_rejected`
- **Variables**: Should include `{{previous_stage_name}}` (should be "Test Step 1"), `{{rejection_reason}}` (should be "Needs more work")

**Verification**:
- Verify `{{rejection_reason}}` shows the correct rejection reason
- Verify the email indicates which stage was rejected

---

## Test Scenario 7: Assigned Person - Stage Reopened

**Goal**: Test that the assigned person receives an email when a stage is reopened.

**Prerequisites**:
- "Test Step 1" is completed

**Steps**:
1. Navigate to "Test Step 1"
2. **Enable notification**: Ensure "Notify assigned person when re-opened" is enabled
3. **Reopen the stage**: Click "Reopen" button
4. **Check email**: User A should receive an email with template `stage_assigned_reopened`

**Expected Email**:
- **To**: `testuser1@example.com`
- **Template**: `stage_assigned_reopened`

---

## Test Scenario 8: "ME" (Subscribed User) - Stage Reopened

**Goal**: Test that a subscribed user receives an email when a stage they're watching is reopened.

**Steps**:
1. Ensure User B is still subscribed to "Test Step 1" with "Notify when re-opened" enabled
2. **Reopen the stage**: Click "Reopen" on "Test Step 1"
3. **Check email**: User B should receive an email with template `stage_me_reopened`

**Expected Email**:
- **To**: `testuser2@example.com`
- **Template**: `stage_me_reopened`

---

## Test Scenario 9: Multiple Notifications (Complete + Next Assignee)

**Goal**: Test that multiple notifications are sent when a stage is completed (assigned person + subscribed users + next assignee).

**Prerequisites**:
- "Test Step 1" assigned to Person A
- User B subscribed to "Test Step 1" with all notifications enabled
- "Test Step 2" assigned to Person B
- All notification toggles enabled

**Steps**:
1. Complete "Test Step 1"
2. **Check emails**: Should receive 3 emails:
   - User A: `stage_assigned_complete`
   - User B: `stage_me_complete` (as subscriber)
   - User B: `stage_next_complete_or_approved` (as next assignee)

**Verification**:
- Verify all three emails are sent
- Verify User B receives both emails (they may be duplicates if same person, which is fine)

---

## Test Scenario 10: Notification Preferences - Disabled

**Goal**: Test that notifications are NOT sent when preferences are disabled.

**Steps**:
1. Disable all notification toggles on a stage
2. Perform actions (start, complete, reopen)
3. **Check**: No emails should be sent

**Verification**:
- Check Resend dashboard - no emails should appear for this stage
- Check browser console - no errors should appear (notifications fail silently)

---

## Troubleshooting

### No Emails Received

1. **Check Email Templates Exist**:
   ```sql
   SELECT template_type FROM public.email_templates 
   WHERE template_type LIKE 'stage_%';
   ```
   Should return all 8 workflow notification templates.

2. **Check Edge Function Logs**:
   - Go to Supabase Dashboard → Edge Functions → `send-workflow-notification` → Logs
   - Look for errors or warnings

3. **Check Resend Dashboard**:
   - Go to Resend dashboard and check "Emails" section
   - Look for failed deliveries or bounces

4. **Check Notification Preferences**:
   - Verify the notification toggle is actually enabled
   - Check `step_subscriptions` table for "ME" notifications
   - Check step flags for assigned/cross-step notifications

5. **Check Email Lookup**:
   - Verify person name matches exactly between `users` and `people` tables
   - Check that email addresses are valid
   - Run this query to verify:
     ```sql
     SELECT name, email FROM public.users WHERE name = 'Test User 1';
     SELECT name, email FROM public.people WHERE name = 'Test User 1';
     ```

6. **Check Browser Console**:
   - Open browser DevTools → Console
   - Look for errors when performing actions
   - Notifications are sent asynchronously, so errors may not block the UI

### Wrong Email Content

1. **Check Template Variables**:
   - Verify template uses correct variable names (e.g., `{{name}}`, not `{name}`)
   - Check that all required variables are provided

2. **Check Template Content**:
   - Go to Settings → Email Templates
   - Verify template subject and body are correct

3. **Check Variable Replacement**:
   - Look at Resend dashboard to see the actual email content
   - Verify variables are replaced (not showing as `{{name}}`)

### Cross-Step Notifications Not Working

1. **Check Step Sequence**:
   - Verify steps have correct `sequence_order`
   - Next/previous step lookup depends on sequence order

2. **Check Next/Previous Step Assignment**:
   - Next step must have an `assigned_to_name`
   - Previous step must have an `assigned_to_name`
   - Email lookup must succeed for the assignee

3. **Check Notification Flags**:
   - `notify_next_assignee_when_complete_or_approved` must be true
   - `notify_prior_assignee_when_rejected` must be true

---

## Quick Test Checklist

Use this checklist to quickly verify all notification types:

- [ ] `stage_assigned_started` - Assigned person when started
- [ ] `stage_me_started` - Subscribed user when started
- [ ] `stage_assigned_complete` - Assigned person when completed
- [ ] `stage_me_complete` - Subscribed user when completed
- [ ] `stage_assigned_reopened` - Assigned person when reopened
- [ ] `stage_me_reopened` - Subscribed user when reopened
- [ ] `stage_next_complete_or_approved` - Next assignee when completed/approved
- [ ] `stage_prior_rejected` - Prior assignee when rejected

---

## Testing with Real Email Addresses

For production testing, use real email addresses you can access:

1. **Use Your Own Email**: Set up test users with your email addresses
2. **Use Email Testing Services**: Services like Mailtrap or Mailinator for testing
3. **Check Spam Folder**: Some emails may go to spam, especially during testing

---

## Automated Testing (Future)

Consider creating automated tests that:
1. Create test data programmatically
2. Trigger workflow actions via API
3. Check Resend API for sent emails
4. Verify email content matches expected templates

---

**Last Updated**: 2026-01-18
