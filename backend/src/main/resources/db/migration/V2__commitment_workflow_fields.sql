alter table weekly_commitments
  add column proof text,
  add column manager_subject varchar(255),
  add column manager_name varchar(255),
  add column review_note text,
  add column locked_at timestamptz,
  add column reviewed_at timestamptz,
  add column reconciled_at timestamptz,
  add column carried_forward_from_id uuid references weekly_commitments(id);

create index idx_weekly_commitments_status on weekly_commitments(status);
create index idx_weekly_commitments_owner on weekly_commitments(owner_subject);
create index idx_weekly_commitments_carried_forward_from
  on weekly_commitments(carried_forward_from_id);
