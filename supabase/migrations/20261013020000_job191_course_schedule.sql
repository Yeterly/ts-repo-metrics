-- Job191 (Istinye University, Fall 2026): the course row, its four two-week sprints, and removing the CSE 115A seed course.
-- Sprints start Monday 2026-10-05; each is due Sunday 23:59:59.999999 Istanbul time.

-- The CSE 115A seed course from 20260924000000 is removed when nothing uses it (deleting a course cascades to its data),
-- and only deactivated otherwise.
delete from public.cse_courses c
where c.slug = 'CSE115A-Fall26'
  and not exists (select 1 from public.cse_course_memberships m where m.course_id = c.id)
  and not exists (select 1 from public.cse_course_codes k where k.course_id = c.id)
  and not exists (select 1 from public.cse_course_roles r where r.course_id = c.id)
  and not exists (select 1 from public.cse_task_submissions t where t.course_id = c.id)
  and not exists (select 1 from public.cse_assignment_submissions s where s.course_id = c.id);
update public.cse_courses set active = false where slug = 'CSE115A-Fall26';

insert into public.cse_courses (slug, title, term, assignment_count, active)
values ('Job191-Fall26', 'Job191 - Dream Data Labs AI Augmented Software Engineering', 'Fall 2026', 4, true)
on conflict (slug) do update
  set title = excluded.title, term = excluded.term, assignment_count = excluded.assignment_count, active = excluded.active;

insert into public.cse_sprints (course_id, number, due_at)
select c.id, d.number, (d.day::timestamp + interval '23:59:59.999999') at time zone 'Europe/Istanbul'
from public.cse_courses c
cross join (values (1, date '2026-10-18'), (2, date '2026-11-01'), (3, date '2026-11-15'), (4, date '2026-11-29')) as d(number, day)
where c.slug = 'Job191-Fall26'
on conflict (course_id, number) do update set due_at = excluded.due_at;

delete from public.cse_sprints s
using public.cse_courses c
where c.id = s.course_id and c.slug = 'Job191-Fall26' and s.number > 4;
