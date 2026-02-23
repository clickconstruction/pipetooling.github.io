-- Add indexes for RLS hot paths on project_workflow_steps, project_workflows, projects
-- Reduces query cost when loading Projects and Workflow pages

CREATE INDEX IF NOT EXISTS idx_project_workflow_steps_workflow_id ON public.project_workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_project_workflows_project_id ON public.project_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON public.projects(customer_id);
