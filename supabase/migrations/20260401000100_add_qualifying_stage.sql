alter table public.teams
  add column if not exists qualified boolean not null default false;

create table if not exists public.qualifying_courts (
  id uuid not null default gen_random_uuid(),
  bracket_id uuid not null,
  court_number integer not null,
  created_at timestamp without time zone default now(),
  constraint qualifying_courts_pkey primary key (id),
  constraint qualifying_courts_bracket_id_fkey foreign key (bracket_id)
    references public.brackets(id)
);

create unique index if not exists qualifying_courts_unique
  on public.qualifying_courts (bracket_id, court_number);

create table if not exists public.qualifying_assignments (
  id uuid not null default gen_random_uuid(),
  court_id uuid not null,
  team_id uuid not null,
  position integer not null,
  created_at timestamp without time zone default now(),
  constraint qualifying_assignments_pkey primary key (id),
  constraint qualifying_assignments_court_id_fkey foreign key (court_id)
    references public.qualifying_courts(id),
  constraint qualifying_assignments_team_id_fkey foreign key (team_id)
    references public.teams(id)
);

create unique index if not exists qualifying_assignments_unique_team
  on public.qualifying_assignments (team_id);

create unique index if not exists qualifying_assignments_unique_position
  on public.qualifying_assignments (court_id, position);

create table if not exists public.qualifying_matches (
  id uuid not null default gen_random_uuid(),
  court_id uuid not null,
  match_index integer not null,
  team_a_id uuid not null,
  team_b_id uuid not null,
  score_a integer,
  score_b integer,
  winner_team_id uuid,
  status text not null default 'PENDING',
  created_at timestamp without time zone default now(),
  constraint qualifying_matches_pkey primary key (id),
  constraint qualifying_matches_court_id_fkey foreign key (court_id)
    references public.qualifying_courts(id),
  constraint qualifying_matches_team_a_id_fkey foreign key (team_a_id)
    references public.teams(id),
  constraint qualifying_matches_team_b_id_fkey foreign key (team_b_id)
    references public.teams(id),
  constraint qualifying_matches_winner_team_id_fkey foreign key (winner_team_id)
    references public.teams(id)
);

create unique index if not exists qualifying_matches_unique
  on public.qualifying_matches (court_id, match_index);

create table if not exists public.qualifying_team_stats (
  team_id uuid not null,
  court_id uuid not null,
  wins integer not null default 0,
  losses integer not null default 0,
  points_for integer not null default 0,
  points_against integer not null default 0,
  differential integer not null default 0,
  updated_at timestamp without time zone default now(),
  constraint qualifying_team_stats_pkey primary key (team_id),
  constraint qualifying_team_stats_court_id_fkey foreign key (court_id)
    references public.qualifying_courts(id),
  constraint qualifying_team_stats_team_id_fkey foreign key (team_id)
    references public.teams(id)
);
