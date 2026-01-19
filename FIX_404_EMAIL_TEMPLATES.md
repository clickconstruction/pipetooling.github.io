# Fix: 404 Error - Missing Email Templates

## The Problem

The Edge Function is returning a 404 error because the email template doesn't exist in your database.

Looking at your error:
- `templateType: 'stage_me_reopened'`
- The function returns 404 when it can't find the template

## The Solution

You need to create the email templates in your database. You can do this via the Settings page in your app.

### Step 1: Go to Settings → Email Templates

1. Sign in to your app as a `dev` user
2. Navigate to **Settings** (in the top navigation)
3. Click on **Email Templates** tab

### Step 2: Create Missing Templates

You need to create templates for all workflow notification types. Based on your error, you're missing at least `stage_me_reopened`.

**Required Workflow Templates**:

1. **`stage_assigned_started`** - Sent to assigned person when stage is started
2. **`stage_assigned_complete`** - Sent to assigned person when stage is completed
3. **`stage_assigned_reopened`** - Sent to assigned person when stage is reopened
4. **`stage_me_started`** - Sent to subscribed user when stage is started
5. **`stage_me_complete`** - Sent to subscribed user when stage is completed
6. **`stage_me_reopened`** - Sent to subscribed user when stage is reopened ⚠️ **You're missing this one!**
7. **`stage_next_complete_or_approved`** - Sent to next assignee when current stage is completed/approved
8. **`stage_prior_rejected`** - Sent to prior assignee when current stage is rejected

### Step 3: Create Each Template

For each template:

1. Click **"Create Template"** or **"Add Template"** button
2. Select the **Template Type** from the dropdown
3. Enter a **Subject** (e.g., "Stage {{stage_name}} has been reopened")
4. Enter a **Body** (e.g., "Hi {{name}},\n\nThe stage {{stage_name}} in project {{project_name}} has been reopened.\n\nView workflow: {{workflow_link}}")
5. Click **Save**

### Step 4: Template Variables

You can use these variables in your templates:

- `{{name}}` - Recipient's name
- `{{email}}` - Recipient's email
- `{{project_name}}` - Project name
- `{{stage_name}}` - Workflow stage name
- `{{assigned_to_name}}` - Person assigned to stage
- `{{workflow_link}}` - Link to view workflow
- `{{previous_stage_name}}` - Previous stage name (for cross-step notifications)
- `{{rejection_reason}}` - Rejection reason (for `stage_prior_rejected`)

### Quick Template Examples

#### `stage_me_reopened` (The one you're missing!)

**Subject**: `Stage {{stage_name}} has been reopened`

**Body**:
```
Hi {{name}},

The stage "{{stage_name}}" in project "{{project_name}}" has been reopened.

View the workflow: {{workflow_link}}
```

#### `stage_assigned_started`

**Subject**: `You've been assigned: {{stage_name}}`

**Body**:
```
Hi {{name}},

You've been assigned to work on "{{stage_name}}" in project "{{project_name}}".

View the workflow: {{workflow_link}}
```

#### `stage_assigned_complete`

**Subject**: `Stage {{stage_name}} completed`

**Body**:
```
Hi {{name}},

The stage "{{stage_name}}" in project "{{project_name}}" has been completed.

View the workflow: {{workflow_link}}
```

#### `stage_me_started`

**Subject**: `Stage {{stage_name}} has started`

**Body**:
```
Hi {{name}},

The stage "{{stage_name}}" in project "{{project_name}}" that you're subscribed to has started.

View the workflow: {{workflow_link}}
```

#### `stage_me_complete`

**Subject**: `Stage {{stage_name}} completed`

**Body**:
```
Hi {{name}},

The stage "{{stage_name}}" in project "{{project_name}}" that you're subscribed to has been completed.

View the workflow: {{workflow_link}}
```

#### `stage_next_complete_or_approved`

**Subject**: `Previous stage completed - {{stage_name}} is ready`

**Body**:
```
Hi {{name}},

The previous stage "{{previous_stage_name}}" has been completed. Your stage "{{stage_name}}" in project "{{project_name}}" is now ready to begin.

View the workflow: {{workflow_link}}
```

#### `stage_prior_rejected`

**Subject**: `Stage {{previous_stage_name}} was rejected`

**Body**:
```
Hi {{name}},

The stage "{{previous_stage_name}}" in project "{{project_name}}" that you worked on has been rejected.

Reason: {{rejection_reason}}

View the workflow: {{workflow_link}}
```

## Verify Templates Exist

After creating templates, you can verify they exist:

1. In Settings → Email Templates, you should see all 8 workflow templates listed
2. Or check via SQL:
   ```sql
   SELECT template_type FROM public.email_templates 
   WHERE template_type LIKE 'stage_%'
   ORDER BY template_type;
   ```

## Test Again

After creating the missing templates:

1. Go back to your workflow page
2. Try reopening a stage again
3. The 404 error should be gone
4. Check your email - you should receive the notification!

## Still Getting 404?

If you still get 404 after creating templates:

1. **Check template type spelling**: Must match exactly (case-sensitive)
   - `stage_me_reopened` ✅
   - `Stage_Me_Reopened` ❌
   - `stage-me-reopened` ❌

2. **Check Supabase Logs**:
   - Go to Edge Functions → `send-workflow-notification` → Logs
   - Look for the exact error message
   - It will tell you which template is missing

3. **Verify template was saved**:
   - Go back to Settings → Email Templates
   - Make sure the template appears in the list
   - Check that the template type matches exactly

4. **Hard refresh browser**:
   - Sometimes the app needs a refresh to see new templates
   - Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
