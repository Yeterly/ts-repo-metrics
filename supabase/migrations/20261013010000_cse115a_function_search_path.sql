-- Pin search_path on the course functions (Supabase security advisor lint 0011, function_search_path_mutable).
-- Their bodies use unqualified names, so the path stays public rather than empty; pg_temp goes last.

alter function public.cse_assignment_is_locked(uuid, uuid, integer) set search_path = public, pg_temp;
alter function public.cse_reject_locked_task_change() set search_path = public, pg_temp;
alter function public.submit_cse_assignment(uuid, uuid, integer, jsonb) set search_path = public, pg_temp;
alter function public.claim_cse_grading_job(text[]) set search_path = public, pg_temp;
alter function public.release_cse_assignment_submission(uuid, uuid) set search_path = public, pg_temp;
alter function public.requeue_cse_grading_job(uuid) set search_path = public, pg_temp;
