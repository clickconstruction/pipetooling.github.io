-- The failure is on line 3, and the bed must say so.
INSERT INTO public.bed_apply_ran (file) VALUES ('31');
SELECT * FROM public.bed_apply_no_such_table;
INSERT INTO public.bed_apply_ran (file) VALUES ('31 after the failure');
