create table seasons (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, starts_on date not null, ends_on date not null, check(ends_on>=starts_on));
create table productions (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, season_id uuid not null references seasons, owner text not null, territory text not null check(territory in ('NZ','AU')), timezone text not null check(timezone in ('Pacific/Auckland','Pacific/Chatham','Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Perth','Australia/Adelaide','Australia/Darwin','Australia/Hobart','Australia/Broken_Hill','Australia/Lord_Howe','Australia/Eucla','Australia/Lindeman')), rights_context text not null default 'unknown' check(rights_context in ('unknown','dramatic','other')), review_due date not null, status text not null default 'planned' check(status in ('planned','confirmed','closed')));
create table works (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, creator text not null, duration_seconds integer not null check(duration_seconds>0));
create table programme_items (id uuid primary key default gen_random_uuid(), code text not null unique, production_id uuid not null references productions, work_id uuid not null references works, position integer not null check(position>0), credit text not null, revision integer not null default 1, unique(production_id,position));
create table spaces (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, capacity integer not null check(capacity>0), turnaround_minutes integer not null default 30 check(turnaround_minutes>=0));
create table sessions (id uuid primary key default gen_random_uuid(), code text not null unique, production_id uuid not null references productions, space_id uuid not null references spaces, kind text not null check(kind in ('rehearsal','performance','get-in','get-out')), starts_at timestamptz not null, ends_at timestamptz not null, planned_people integer not null check(planned_people>=0), status text not null default 'tentative' check(status in ('tentative','confirmed','cancelled')), revision integer not null default 1, check(ends_at>starts_at));
create table clearances (id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique, programme_item_id uuid not null references programme_items, item_revision integer not null, production_territory text not null, production_context text not null, decision text not null check(decision in ('approved','exempt','pending','revoked')), valid_from date not null, valid_to date not null, authority text not null, evidence text not null, actor text not null, check(valid_to>=valid_from));
create table safety_reviews (id uuid primary key default gen_random_uuid(), session_id uuid not null references sessions, session_revision integer not null, evidence text not null, consulted_with text not null, actor text not null);
create table actions (id uuid primary key default gen_random_uuid(), code text not null unique, production_id uuid not null references productions, description text not null, owner text not null, due date not null, status text not null default 'open' check(status in ('open','done')), evidence text not null default '', check(status='open' or length(trim(evidence))>0));
create table notes (id uuid primary key default gen_random_uuid(), production_id uuid not null references productions, body text not null, actor text not null);
create table import_batches (id uuid primary key default gen_random_uuid(), fingerprint text not null unique, filename text not null, source_base64 text not null, mapping jsonb not null, rows jsonb not null, row_count integer not null, actor text not null);
create table audit_log (id uuid primary key default gen_random_uuid(), entity text not null, record_id uuid not null, operation text not null, actor text not null, before_row jsonb, after_row jsonb);
create function change_stamp() returns trigger language plpgsql as $$ begin
 new.updated_at=clock_timestamp();
 if TG_TABLE_NAME in ('sessions','programme_items') then new.revision=old.revision+1; end if;
 return new;
end $$;
create function audit_change() returns trigger language plpgsql as $$ declare who text; begin
 who=nullif(current_setting('app.actor',true),'');
 if who is null then raise exception 'Named actor required'; end if;
 insert into audit_log(entity,record_id,operation,actor,before_row,after_row) values(TG_TABLE_NAME,new.id,TG_OP,who,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new)); return new;
end $$;
create function append_only() returns trigger language plpgsql as $$ begin raise exception 'Append a correction; history cannot be removed'; end $$;
do $$ declare t text; begin
 foreach t in array array['seasons','productions','works','programme_items','spaces','sessions','clearances','safety_reviews','actions','notes','import_batches','audit_log'] loop
 execute format('alter table %I add created_at timestamptz not null default clock_timestamp(), add updated_at timestamptz not null default clock_timestamp()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 execute format('create trigger stamp before update on %I for each row execute function change_stamp()',t);
 execute format('create trigger no_delete before delete on %I for each row execute function append_only()',t);
 if t<>'audit_log' then execute format('create trigger audit after insert or update on %I for each row execute function audit_change()',t); end if;
 end loop;
 foreach t in array array['clearances','safety_reviews','notes','import_batches','audit_log'] loop
 execute format('create trigger no_update before update on %I for each row execute function append_only()',t);
 end loop;
 foreach t in array array['seasons','productions','works','programme_items','spaces','sessions','actions'] loop
 execute format('alter table %I add constraint nonempty_code check(length(trim(code))>0)',t);
 execute format('create unique index on %I (lower(code))',t);
 end loop;
end $$;
create index on sessions(production_id,starts_at);
create index on sessions(space_id,starts_at);
create index on programme_items(production_id);
create index on clearances(programme_item_id,sequence desc);
create index on safety_reviews(session_id,session_revision);
create index on actions(production_id,due);
create index on notes(production_id);
create index on audit_log(record_id,created_at);
create view call_sheet with (security_invoker=true) as
 select s.id,s.code,p.code production,p.name production_name,p.owner,p.status production_status,p.territory,p.timezone,s.kind,sp.code space,sp.name space_name,s.starts_at,s.ends_at,s.planned_people,sp.capacity,sp.turnaround_minutes,s.status,s.revision,s.production_id,s.space_id,
 exists(select 1 from safety_reviews r where r.session_id=s.id and r.session_revision=s.revision) safety_reviewed
 from sessions s join productions p on p.id=s.production_id join spaces sp on sp.id=s.space_id;
create view repertoire with (security_invoker=true) as
 select i.id,i.code,p.code production,p.name production_name,p.territory,p.timezone,p.rights_context,i.position,w.code work,w.name title,w.creator,w.duration_seconds,i.credit,i.revision,i.production_id,
 c.decision,c.valid_from,c.valid_to,c.authority,c.evidence,c.item_revision,c.production_territory clearance_territory,c.production_context clearance_context
 from programme_items i join works w on w.id=i.work_id join productions p on p.id=i.production_id
 left join lateral (select * from clearances x where x.programme_item_id=i.id order by x.sequence desc limit 1) c on true;
create view rights_gaps with (security_invoker=true) as
 select r.code,r.production,r.title,s.code performance,s.starts_at,
 case when r.rights_context='unknown' then 'Rights context unreviewed'
 when r.decision is null or r.decision not in ('approved','exempt') then 'No approved clearance or documented exemption'
 when r.item_revision<>r.revision or r.clearance_territory<>r.territory or r.clearance_context<>r.rights_context then 'Clearance belongs to an earlier programme scope'
 else 'Performance outside clearance dates' end issue
 from repertoire r join sessions s on s.production_id=r.production_id
 where s.kind='performance' and s.status<>'cancelled' and (
 r.rights_context='unknown' or r.decision is null or r.decision not in ('approved','exempt') or r.item_revision<>r.revision or r.clearance_territory<>r.territory or r.clearance_context<>r.rights_context
 or (s.starts_at at time zone r.timezone)::date<r.valid_from
 or (s.ends_at at time zone r.timezone)::date>r.valid_to);
create view schedule_clashes with (security_invoker=true) as
 select a.code first_call,b.code second_call,a.space,a.starts_at first_start,a.ends_at first_end,b.starts_at second_start,b.ends_at second_end,a.turnaround_minutes,
 case when a.starts_at<b.ends_at and b.starts_at<a.ends_at then 'Overlap' else 'Turnaround too short' end issue
 from call_sheet a join call_sheet b on a.space_id=b.space_id and (a.starts_at<b.starts_at or (a.starts_at=b.starts_at and a.id<b.id))
 where a.status<>'cancelled' and b.status<>'cancelled'
 and a.starts_at < b.ends_at + make_interval(mins=>b.turnaround_minutes)
 and b.starts_at < a.ends_at + make_interval(mins=>a.turnaround_minutes);
create view action_register with (security_invoker=true) as
 select a.*,p.code production,a.status='open' and a.due<current_date overdue from actions a join productions p on p.id=a.production_id;
create view compliance_findings with (security_invoker=true) as
 select code,production,'R01' rule,issue from rights_gaps
 union all select code,production,'R02','Current call needs safety review evidence and consultation record' from call_sheet where status<>'cancelled' and not safety_reviewed
 union all select code,production,'R03','Planned people exceed recorded space capacity' from call_sheet where status<>'cancelled' and planned_people>capacity
 union all select a.code,p.code,'R04','Call outside recorded season dates' from sessions a join productions p on p.id=a.production_id join seasons se on se.id=p.season_id where a.status<>'cancelled' and ((a.starts_at at time zone p.timezone)::date<se.starts_on or (a.ends_at at time zone p.timezone)::date>se.ends_on)
 union all select code,code,'R05','Production review is overdue' from productions where status<>'closed' and review_due<current_date
 union all select code,production,'R06','Action is overdue' from action_register where overdue
 union all select p.code,p.code,'R07','No programme items recorded' from productions p where p.status<>'closed' and not exists(select 1 from programme_items i where i.production_id=p.id)
 union all select code,production,'R08','Programme credit is missing' from repertoire where trim(credit)=''
 union all select first_call,second_call,'R09',issue from schedule_clashes;
revoke all on call_sheet,repertoire,rights_gaps,schedule_clashes,action_register,compliance_findings from public;
