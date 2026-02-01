-- Optimize RLS on public.workflow_templates: wrap auth.uid() and auth.jwt() in (select ...)
-- so they are evaluated once per query (initPlan) instead of per row.
-- See: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv

DO $$
DECLARE
    pol_record RECORD;
    qual_expr TEXT;
    with_check_expr TEXT;
    new_qual TEXT;
    new_with_check TEXT;
    cmd_type TEXT;
BEGIN
    FOR pol_record IN
        SELECT
            n.nspname AS schema_name,
            c.relname AS table_name,
            p.polname AS policy_name,
            CASE p.polcmd
                WHEN 'r' THEN 'SELECT'
                WHEN 'a' THEN 'INSERT'
                WHEN 'w' THEN 'UPDATE'
                WHEN 'd' THEN 'DELETE'
                WHEN '*' THEN 'ALL'
            END AS cmd,
            pg_get_expr(p.polqual, p.polrelid) AS qual,
            pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'workflow_templates'
    LOOP
        qual_expr := pol_record.qual;
        with_check_expr := pol_record.with_check;
        cmd_type := pol_record.cmd;

        -- Wrap auth.uid() and auth.jwt() in (select ...) for initPlan evaluation.
        -- Replace bare calls only; then collapse any double-wrap from already-optimized expressions.
        new_qual := qual_expr;
        IF new_qual IS NOT NULL THEN
            new_qual := REPLACE(new_qual, 'auth.uid()', '(select auth.uid())');
            new_qual := REPLACE(new_qual, 'auth.jwt()', '(select auth.jwt())');
            new_qual := REPLACE(new_qual, '(select (select auth.uid()))', '(select auth.uid())');
            new_qual := REPLACE(new_qual, '(select (select auth.jwt()))', '(select auth.jwt())');
        END IF;

        new_with_check := with_check_expr;
        IF new_with_check IS NOT NULL THEN
            new_with_check := REPLACE(new_with_check, 'auth.uid()', '(select auth.uid())');
            new_with_check := REPLACE(new_with_check, 'auth.jwt()', '(select auth.jwt())');
            new_with_check := REPLACE(new_with_check, '(select (select auth.uid()))', '(select auth.uid())');
            new_with_check := REPLACE(new_with_check, '(select (select auth.jwt()))', '(select auth.jwt())');
        END IF;

        -- Skip if nothing changed
        IF (new_qual IS NOT DISTINCT FROM qual_expr) AND (new_with_check IS NOT DISTINCT FROM with_check_expr) THEN
            CONTINUE;
        END IF;

        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            pol_record.policy_name,
            pol_record.schema_name,
            pol_record.table_name);

        IF cmd_type = 'ALL' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR ALL USING (%s) WITH CHECK (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_qual, 'true'),
                COALESCE(new_with_check, 'true')
            );
        ELSIF cmd_type = 'SELECT' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR SELECT USING (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_qual, 'true')
            );
        ELSIF cmd_type = 'INSERT' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_with_check, 'true')
            );
        ELSIF cmd_type = 'UPDATE' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_qual, 'true'),
                COALESCE(new_with_check, 'true')
            );
        ELSIF cmd_type = 'DELETE' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR DELETE USING (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_qual, 'true')
            );
        END IF;

        RAISE NOTICE 'Optimized RLS policy % on %.%', pol_record.policy_name, pol_record.schema_name, pol_record.table_name;
    END LOOP;
END $$;
