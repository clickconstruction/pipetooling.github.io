# Email Templates Database Setup

This document describes the database table needed for the email templates feature in Settings.

## Database Table: `email_templates`

### Schema

```sql
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL UNIQUE CHECK (template_type IN (
    'invitation', 'sign_in', 'login_as',
    'stage_assigned_started', 'stage_assigned_complete', 'stage_assigned_reopened',
    'stage_me_started', 'stage_me_complete', 'stage_me_reopened',
    'stage_next_complete_or_approved', 'stage_prior_rejected'
  )),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON public.email_templates(template_type);

-- RLS Policy: Only owners can read/write email templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can read all templates
CREATE POLICY "Owners can read email templates"
ON public.email_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);

-- Policy: Owners can insert templates
CREATE POLICY "Owners can insert email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);

-- Policy: Owners can update templates
CREATE POLICY "Owners can update email templates"
ON public.email_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  )
);
```

### Template Types

#### User Management
1. **`invitation`** - Sent when inviting a new user via the "Invite via email" button
2. **`sign_in`** - Sent when using "Send email to sign in" button
3. **`login_as`** - Sent when dev uses "Login as user" feature

#### Workflow Stage Notifications - Assigned Person
4. **`stage_assigned_started`** - Sent to assigned person when stage is started
5. **`stage_assigned_complete`** - Sent to assigned person when stage is completed
6. **`stage_assigned_reopened`** - Sent to assigned person when stage is re-opened

#### Workflow Stage Notifications - Current User (ME)
7. **`stage_me_started`** - Sent to current user when a subscribed stage is started
8. **`stage_me_complete`** - Sent to current user when a subscribed stage is completed
9. **`stage_me_reopened`** - Sent to current user when a subscribed stage is re-opened

#### Cross-Step Notifications
10. **`stage_next_complete_or_approved`** - Sent to next stage assignee when current stage is completed or approved
11. **`stage_prior_rejected`** - Sent to prior stage assignee when their stage is rejected

### Template Variables

Templates support different variables depending on the template type:

#### User Management Templates (`invitation`, `sign_in`, `login_as`)
- `{{name}}` - User's name (if available)
- `{{email}}` - User's email address
- `{{role}}` - User's role (dev, master_technician, assistant, subcontractor)
- `{{link}}` - The action link (sign-up link, sign-in link, or magic link)

#### Workflow Stage Templates (`stage_*`)
- `{{name}}` - Recipient's name (current user for ME templates, assigned person for assigned templates)
- `{{email}}` - Recipient's email address
- `{{project_name}}` - Name of the project
- `{{stage_name}}` - Name of the workflow stage
- `{{assigned_to_name}}` - Name of person assigned to the stage
- `{{workflow_link}}` - Link to view the workflow page
- `{{previous_stage_name}}` - Name of the previous stage (for cross-step notifications)
- `{{rejection_reason}}` - Reason for rejection (for `stage_prior_rejected` template)

### Example Templates

#### Invitation Email
```
Subject: Invitation to join Pipetooling

Body:
Hi {{name}},

You've been invited to join Pipetooling as a {{role}}. Click the link below to set up your account:

{{link}}

If you didn't expect this invitation, you can safely ignore this email.
```

#### Sign-In Email
```
Subject: Sign in to Pipetooling

Body:
Hi {{name}},

Click the link below to sign in to your Pipetooling account:

{{link}}

If you didn't request this sign-in link, you can safely ignore this email.
```

#### Login As Email
```
Subject: Sign in to Pipetooling

Body:
Hi {{name}},

A dev has requested to sign in as you. Click the link below:

{{link}}

If you didn't expect this, please contact your administrator.
```

## Next Steps

After creating the table, you'll need to update the Edge Functions (`invite-user`, `login-as-user`) and the `sendSignInEmail` function to use these templates instead of hardcoded email content.

The templates should be retrieved from the database and variables should be replaced before sending emails.
