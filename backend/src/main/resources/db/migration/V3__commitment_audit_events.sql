alter table weekly_commitments
  add column risk varchar(16) not null default 'ON_TRACK';

update weekly_commitments
set risk = case
  when confidence < 50 then 'BLOCKED'
  when confidence < 70 then 'AT_RISK'
  else 'ON_TRACK'
end;

alter table weekly_commitments
  drop column confidence;

create table commitment_audit_events (
  id uuid primary key,
  commitment_id uuid not null references weekly_commitments(id),
  actor_subject varchar(255) not null,
  actor_name varchar(255) not null,
  from_status varchar(32),
  to_status varchar(32) not null,
  changed_fields jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index idx_audit_commitment
  on commitment_audit_events(commitment_id, occurred_at);
