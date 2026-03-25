begin;

with tournament as (
  insert into public.tournaments (name, status)
  values ('Pickleball for Patriots', 'REGISTRATION')
  returning id
),
brackets as (
  insert into public.brackets (tournament_id, type, status)
  select id, 'recreational', 'DRAFT' from tournament
  union all
  select id, 'competitive', 'DRAFT' from tournament
  returning id, type
)
insert into public.teams (bracket_id, name, contact_email, is_active)
select b.id, t.name, t.contact_email, true
from brackets b
join (values
  ('recreational', 'Aggie Aces', 'aggie.aces@example.com'),
  ('recreational', 'Campus Crushers', 'campus.crushers@example.com'),
  ('recreational', 'Midcourt Legends', 'midcourt.legends@example.com'),
  ('recreational', 'Southside Smash', 'southside.smash@example.com'),
  ('recreational', 'Baseline Buddies', 'baseline.buddies@example.com'),
  ('recreational', 'Pickle Pioneers', 'pickle.pioneers@example.com'),
  ('competitive', 'Lone Star Lobs', 'lone.star.lobs@example.com'),
  ('competitive', 'Dink Dynasty', 'dink.dynasty@example.com'),
  ('competitive', 'Net Ninjas', 'net.ninjas@example.com'),
  ('competitive', 'Court Command', 'court.command@example.com'),
  ('competitive', 'Aggie Advantage', 'aggie.advantage@example.com'),
  ('competitive', 'Texas Topspin', 'texas.topspin@example.com')
) as t(type, name, contact_email)
on b.type = t.type;

insert into public.players (team_id, name, email)
select t.id, p.name, p.email
from public.teams t
join (values
  ('Aggie Aces', 'Alex Carter', 'alex.carter@example.com'),
  ('Aggie Aces', 'Jordan Wells', 'jordan.wells@example.com'),
  ('Campus Crushers', 'Sam Reed', 'sam.reed@example.com'),
  ('Campus Crushers', 'Riley Park', 'riley.park@example.com'),
  ('Midcourt Legends', 'Taylor Brooks', 'taylor.brooks@example.com'),
  ('Midcourt Legends', 'Casey Nguyen', 'casey.nguyen@example.com'),
  ('Southside Smash', 'Morgan Lee', 'morgan.lee@example.com'),
  ('Southside Smash', 'Jamie Ortiz', 'jamie.ortiz@example.com'),
  ('Baseline Buddies', 'Quinn Howard', 'quinn.howard@example.com'),
  ('Baseline Buddies', 'Drew Patel', 'drew.patel@example.com'),
  ('Pickle Pioneers', 'Avery Kim', 'avery.kim@example.com'),
  ('Pickle Pioneers', 'Parker Ross', 'parker.ross@example.com'),
  ('Lone Star Lobs', 'Logan Price', 'logan.price@example.com'),
  ('Lone Star Lobs', 'Emerson Cole', 'emerson.cole@example.com'),
  ('Dink Dynasty', 'Harper Lane', 'harper.lane@example.com'),
  ('Dink Dynasty', 'Blake Young', 'blake.young@example.com'),
  ('Net Ninjas', 'Rowan Hill', 'rowan.hill@example.com'),
  ('Net Ninjas', 'Skylar Cruz', 'skylar.cruz@example.com'),
  ('Court Command', 'Ari Brooks', 'ari.brooks@example.com'),
  ('Court Command', 'Sydney James', 'sydney.james@example.com'),
  ('Aggie Advantage', 'Reese Parker', 'reese.parker@example.com'),
  ('Aggie Advantage', 'Cameron King', 'cameron.king@example.com'),
  ('Texas Topspin', 'Peyton Ward', 'peyton.ward@example.com'),
  ('Texas Topspin', 'Kendall Fox', 'kendall.fox@example.com')
) as p(team_name, name, email)
on t.name = p.team_name;

commit;
