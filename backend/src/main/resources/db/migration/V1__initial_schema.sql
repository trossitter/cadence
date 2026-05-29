create table rally_cries (
  id uuid primary key,
  title varchar(255) not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table defining_objectives (
  id uuid primary key,
  rally_cry_id uuid not null references rally_cries(id),
  title varchar(255) not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table supporting_outcomes (
  id uuid primary key,
  defining_objective_id uuid not null references defining_objectives(id),
  title varchar(255) not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table weekly_commitments (
  id uuid primary key,
  supporting_outcome_id uuid not null references supporting_outcomes(id),
  owner_subject varchar(255) not null,
  owner_name varchar(255) not null,
  title varchar(255) not null,
  planned_value text not null,
  actual_value text,
  status varchar(32) not null,
  chess_layer varchar(32) not null,
  week_start date not null,
  due_date date not null,
  confidence integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index idx_weekly_commitments_week_start on weekly_commitments(week_start);
create index idx_weekly_commitments_supporting_outcome on weekly_commitments(supporting_outcome_id);

insert into rally_cries (id, title, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Raise portfolio operating velocity', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Build leadership bench strength', now(), now());

insert into defining_objectives (id, rally_cry_id, title, created_at, updated_at)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Standardize weekly execution signals',
    now(),
    now()
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Improve hiring execution quality',
    now(),
    now()
  );

insert into supporting_outcomes (id, defining_objective_id, title, created_at, updated_at)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Every priority commitment maps to an RCDO outcome',
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'Critical hiring plans are visible weekly',
    now(),
    now()
  );
