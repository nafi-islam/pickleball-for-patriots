drop extension if exists "pg_net";


  create table "public"."brackets" (
    "id" uuid not null default gen_random_uuid(),
    "tournament_id" uuid,
    "type" text not null,
    "status" text not null default 'DRAFT'::text
      );


alter table "public"."brackets" enable row level security;


  create table "public"."matches" (
    "id" uuid not null default gen_random_uuid(),
    "bracket_id" uuid,
    "round" integer not null,
    "index_in_round" integer not null,
    "team_a_id" uuid,
    "team_b_id" uuid,
    "winner_team_id" uuid,
    "status" text default 'PENDING'::text,
    "court" text,
    "order_in_round" integer,
    "created_at" timestamp without time zone default now()
      );


alter table "public"."matches" enable row level security;


  create table "public"."players" (
    "id" uuid not null default gen_random_uuid(),
    "team_id" uuid,
    "name" text not null,
    "email" text
      );


alter table "public"."players" enable row level security;


  create table "public"."teams" (
    "id" uuid not null default gen_random_uuid(),
    "bracket_id" uuid,
    "name" text not null,
    "is_active" boolean default true,
    "created_at" timestamp without time zone default now(),
    "contact_email" text not null
      );


alter table "public"."teams" enable row level security;


  create table "public"."tournaments" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "status" text not null default 'DRAFT'::text,
    "created_at" timestamp without time zone default now()
      );


alter table "public"."tournaments" enable row level security;

CREATE UNIQUE INDEX brackets_pkey ON public.brackets USING btree (id);

CREATE UNIQUE INDEX matches_pkey ON public.matches USING btree (id);

CREATE UNIQUE INDEX players_pkey ON public.players USING btree (id);

CREATE UNIQUE INDEX teams_pkey ON public.teams USING btree (id);

CREATE UNIQUE INDEX tournaments_pkey ON public.tournaments USING btree (id);

alter table "public"."brackets" add constraint "brackets_pkey" PRIMARY KEY using index "brackets_pkey";

alter table "public"."matches" add constraint "matches_pkey" PRIMARY KEY using index "matches_pkey";

alter table "public"."players" add constraint "players_pkey" PRIMARY KEY using index "players_pkey";

alter table "public"."teams" add constraint "teams_pkey" PRIMARY KEY using index "teams_pkey";

alter table "public"."tournaments" add constraint "tournaments_pkey" PRIMARY KEY using index "tournaments_pkey";

alter table "public"."brackets" add constraint "brackets_tournament_id_fkey" FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) not valid;

alter table "public"."brackets" validate constraint "brackets_tournament_id_fkey";

alter table "public"."matches" add constraint "matches_bracket_id_fkey" FOREIGN KEY (bracket_id) REFERENCES public.brackets(id) not valid;

alter table "public"."matches" validate constraint "matches_bracket_id_fkey";

alter table "public"."matches" add constraint "matches_team_a_id_fkey" FOREIGN KEY (team_a_id) REFERENCES public.teams(id) not valid;

alter table "public"."matches" validate constraint "matches_team_a_id_fkey";

alter table "public"."matches" add constraint "matches_team_b_id_fkey" FOREIGN KEY (team_b_id) REFERENCES public.teams(id) not valid;

alter table "public"."matches" validate constraint "matches_team_b_id_fkey";

alter table "public"."matches" add constraint "matches_winner_team_id_fkey" FOREIGN KEY (winner_team_id) REFERENCES public.teams(id) not valid;

alter table "public"."matches" validate constraint "matches_winner_team_id_fkey";

alter table "public"."players" add constraint "players_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.teams(id) not valid;

alter table "public"."players" validate constraint "players_team_id_fkey";

alter table "public"."teams" add constraint "teams_bracket_id_fkey" FOREIGN KEY (bracket_id) REFERENCES public.brackets(id) not valid;

alter table "public"."teams" validate constraint "teams_bracket_id_fkey";

grant delete on table "public"."brackets" to "anon";

grant insert on table "public"."brackets" to "anon";

grant references on table "public"."brackets" to "anon";

grant select on table "public"."brackets" to "anon";

grant trigger on table "public"."brackets" to "anon";

grant truncate on table "public"."brackets" to "anon";

grant update on table "public"."brackets" to "anon";

grant delete on table "public"."brackets" to "authenticated";

grant insert on table "public"."brackets" to "authenticated";

grant references on table "public"."brackets" to "authenticated";

grant select on table "public"."brackets" to "authenticated";

grant trigger on table "public"."brackets" to "authenticated";

grant truncate on table "public"."brackets" to "authenticated";

grant update on table "public"."brackets" to "authenticated";

grant delete on table "public"."brackets" to "service_role";

grant insert on table "public"."brackets" to "service_role";

grant references on table "public"."brackets" to "service_role";

grant select on table "public"."brackets" to "service_role";

grant trigger on table "public"."brackets" to "service_role";

grant truncate on table "public"."brackets" to "service_role";

grant update on table "public"."brackets" to "service_role";

grant delete on table "public"."matches" to "anon";

grant insert on table "public"."matches" to "anon";

grant references on table "public"."matches" to "anon";

grant select on table "public"."matches" to "anon";

grant trigger on table "public"."matches" to "anon";

grant truncate on table "public"."matches" to "anon";

grant update on table "public"."matches" to "anon";

grant delete on table "public"."matches" to "authenticated";

grant insert on table "public"."matches" to "authenticated";

grant references on table "public"."matches" to "authenticated";

grant select on table "public"."matches" to "authenticated";

grant trigger on table "public"."matches" to "authenticated";

grant truncate on table "public"."matches" to "authenticated";

grant update on table "public"."matches" to "authenticated";

grant delete on table "public"."matches" to "service_role";

grant insert on table "public"."matches" to "service_role";

grant references on table "public"."matches" to "service_role";

grant select on table "public"."matches" to "service_role";

grant trigger on table "public"."matches" to "service_role";

grant truncate on table "public"."matches" to "service_role";

grant update on table "public"."matches" to "service_role";

grant delete on table "public"."players" to "anon";

grant insert on table "public"."players" to "anon";

grant references on table "public"."players" to "anon";

grant select on table "public"."players" to "anon";

grant trigger on table "public"."players" to "anon";

grant truncate on table "public"."players" to "anon";

grant update on table "public"."players" to "anon";

grant delete on table "public"."players" to "authenticated";

grant insert on table "public"."players" to "authenticated";

grant references on table "public"."players" to "authenticated";

grant select on table "public"."players" to "authenticated";

grant trigger on table "public"."players" to "authenticated";

grant truncate on table "public"."players" to "authenticated";

grant update on table "public"."players" to "authenticated";

grant delete on table "public"."players" to "service_role";

grant insert on table "public"."players" to "service_role";

grant references on table "public"."players" to "service_role";

grant select on table "public"."players" to "service_role";

grant trigger on table "public"."players" to "service_role";

grant truncate on table "public"."players" to "service_role";

grant update on table "public"."players" to "service_role";

grant delete on table "public"."teams" to "anon";

grant insert on table "public"."teams" to "anon";

grant references on table "public"."teams" to "anon";

grant select on table "public"."teams" to "anon";

grant trigger on table "public"."teams" to "anon";

grant truncate on table "public"."teams" to "anon";

grant update on table "public"."teams" to "anon";

grant delete on table "public"."teams" to "authenticated";

grant insert on table "public"."teams" to "authenticated";

grant references on table "public"."teams" to "authenticated";

grant select on table "public"."teams" to "authenticated";

grant trigger on table "public"."teams" to "authenticated";

grant truncate on table "public"."teams" to "authenticated";

grant update on table "public"."teams" to "authenticated";

grant delete on table "public"."teams" to "service_role";

grant insert on table "public"."teams" to "service_role";

grant references on table "public"."teams" to "service_role";

grant select on table "public"."teams" to "service_role";

grant trigger on table "public"."teams" to "service_role";

grant truncate on table "public"."teams" to "service_role";

grant update on table "public"."teams" to "service_role";

grant delete on table "public"."tournaments" to "anon";

grant insert on table "public"."tournaments" to "anon";

grant references on table "public"."tournaments" to "anon";

grant select on table "public"."tournaments" to "anon";

grant trigger on table "public"."tournaments" to "anon";

grant truncate on table "public"."tournaments" to "anon";

grant update on table "public"."tournaments" to "anon";

grant delete on table "public"."tournaments" to "authenticated";

grant insert on table "public"."tournaments" to "authenticated";

grant references on table "public"."tournaments" to "authenticated";

grant select on table "public"."tournaments" to "authenticated";

grant trigger on table "public"."tournaments" to "authenticated";

grant truncate on table "public"."tournaments" to "authenticated";

grant update on table "public"."tournaments" to "authenticated";

grant delete on table "public"."tournaments" to "service_role";

grant insert on table "public"."tournaments" to "service_role";

grant references on table "public"."tournaments" to "service_role";

grant select on table "public"."tournaments" to "service_role";

grant trigger on table "public"."tournaments" to "service_role";

grant truncate on table "public"."tournaments" to "service_role";

grant update on table "public"."tournaments" to "service_role";


