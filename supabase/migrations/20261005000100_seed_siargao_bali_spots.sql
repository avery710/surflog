-- Seed spots for Siargao (Philippines) and Bali (Indonesia), so friends
-- surfing there get conditions without asking. Run after
-- 20261005000000_create_spots_table.sql.
--
-- Source: OpenStreetMap, (c) OpenStreetMap contributors, available under the
-- Open Database Licence (https://www.openstreetmap.org/copyright). Each row
-- is one OSM object, named in the trailing comment (node/way/relation id):
--   * Siargao: the break's own named node (Cloud 9, Jacking Horse, Quicksilver,
--     Tuason Point, Stimpy's, Rock Island, Cemetery, Daku, Pacifico), all on
--     the water side of OSM's coastline, 44 m to 948 m off it (Cemetery is
--     the far one, a reef break roughly 1 km out).
--   * Bali: the named beach object in front of the break (way/relation
--     centre, or the beach node), 1-80 m from the OSM coastline. These
--     are beach-level, NOT the surf break itself: close enough for a
--     marine-model grid cell (~10 km), not for navigation.
-- Nothing here is copied from WannaSurf, Surfline or any third-party list.
-- Breaks with no OSM location of their own were left out (Kuta Reef, Airport
-- Reef, Keramas, Serangan, Nusa Lembongan's Lacerations/Playgrounds, Siargao's
-- Tuesday Rock/G1, Jimbaran); the admin adds those in the app.
-- Timezone is what Open-Meteo reported for each point (timezone=auto);
-- swell, sea level and sea temperature were all non-null at every one.

insert into public.spots (slug, name, country, area, lat, lng, timezone)
values
  ('cloud-9', 'Cloud 9', 'Philippines', 'Siargao', 9.814, 126.167, 'Asia/Manila'), -- OSM node/5251355122
  ('jacking-horse', 'Jacking Horse', 'Philippines', 'Siargao', 9.81469, 126.16336, 'Asia/Manila'), -- OSM node/5894279086
  ('quicksilver', 'Quicksilver', 'Philippines', 'Siargao', 9.81515, 126.16541, 'Asia/Manila'), -- OSM node/5894267085
  ('tuason-point', 'Tuason Point', 'Philippines', 'Siargao', 9.8057, 126.169, 'Asia/Manila'), -- OSM node/5251355821
  ('cemetery', 'Cemetery', 'Philippines', 'Siargao', 9.78672, 126.17245, 'Asia/Manila'), -- OSM node/9987154499
  ('stimpys', 'Stimpy''s', 'Philippines', 'Siargao', 9.84402, 126.1575, 'Asia/Manila'), -- OSM node/9987154504
  ('rock-island', 'Rock Island', 'Philippines', 'Siargao', 9.83924, 126.16013, 'Asia/Manila'), -- OSM node/9987154503
  ('daku', 'Daku', 'Philippines', 'Siargao', 9.74604, 126.16012, 'Asia/Manila'), -- OSM node/9987154500
  ('pacifico', 'Pacifico', 'Philippines', 'Siargao', 9.94312, 126.10476, 'Asia/Manila'), -- OSM node/9987154508
  ('uluwatu-suluban', 'Uluwatu (Suluban)', 'Indonesia', 'Bali', -8.81516, 115.08855, 'Asia/Makassar'), -- OSM way/468508102
  ('padang-padang', 'Padang Padang', 'Indonesia', 'Bali', -8.81122, 115.10377, 'Asia/Makassar'), -- OSM way/156791354
  ('impossibles', 'Impossibles', 'Indonesia', 'Bali', -8.80759, 115.10894, 'Asia/Makassar'), -- OSM relation/9849151
  ('bingin', 'Bingin', 'Indonesia', 'Bali', -8.80564, 115.11321, 'Asia/Makassar'), -- OSM relation/9845879
  ('dreamland', 'Dreamland', 'Indonesia', 'Bali', -8.79955, 115.11718, 'Asia/Makassar'), -- OSM relation/9848424
  ('balangan', 'Balangan', 'Indonesia', 'Bali', -8.7923, 115.12324, 'Asia/Makassar'), -- OSM way/128027878
  ('nyang-nyang', 'Nyang Nyang', 'Indonesia', 'Bali', -8.8398, 115.09589, 'Asia/Makassar'), -- OSM way/404236273
  ('green-bowl', 'Green Bowl', 'Indonesia', 'Bali', -8.84863, 115.17105, 'Asia/Makassar'), -- OSM node/4279662490
  ('pandawa', 'Pandawa', 'Indonesia', 'Bali', -8.84586, 115.18417, 'Asia/Makassar'), -- OSM way/284984714
  ('melasti', 'Melasti', 'Indonesia', 'Bali', -8.84823, 115.15763, 'Asia/Makassar'), -- OSM relation/9754137
  ('geger', 'Geger', 'Indonesia', 'Bali', -8.81994, 115.22433, 'Asia/Makassar'), -- OSM node/5154330421
  ('sanur-hyatt-reef', 'Sanur (Hyatt Reef)', 'Indonesia', 'Bali', -8.70402, 115.26454, 'Asia/Makassar'), -- OSM node/1572432793
  ('kuta-beach', 'Kuta Beach', 'Indonesia', 'Bali', -8.71797, 115.168, 'Asia/Makassar'), -- OSM way/260605192
  ('legian', 'Legian', 'Indonesia', 'Bali', -8.70345, 115.1641, 'Asia/Makassar'), -- OSM way/30904902
  ('seminyak', 'Seminyak', 'Indonesia', 'Bali', -8.68441, 115.1526, 'Asia/Makassar'), -- OSM relation/17822273
  ('batu-bolong', 'Batu Bolong', 'Indonesia', 'Bali', -8.6607, 115.13028, 'Asia/Makassar'), -- OSM node/4179507789
  ('echo-beach', 'Echo Beach', 'Indonesia', 'Bali', -8.65478, 115.12488, 'Asia/Makassar'), -- OSM relation/17840124
  ('berawa', 'Berawa', 'Indonesia', 'Bali', -8.67447, 115.14597, 'Asia/Makassar'), -- OSM node/7267052086
  ('pererenan', 'Pererenan', 'Indonesia', 'Bali', -8.65157, 115.12109, 'Asia/Makassar'), -- OSM way/260664583
  ('seseh', 'Seseh', 'Indonesia', 'Bali', -8.64791, 115.11582, 'Asia/Makassar'), -- OSM node/5680895021
  ('kedungu', 'Kedungu', 'Indonesia', 'Bali', -8.60895, 115.08339, 'Asia/Makassar'), -- OSM node/5204202721
  ('balian', 'Balian', 'Indonesia', 'Bali', -8.5027, 114.96435, 'Asia/Makassar'), -- OSM node/2952600162
  ('medewi', 'Medewi', 'Indonesia', 'Bali', -8.41981, 114.80522, 'Asia/Makassar'), -- OSM node/429570887
  ('cucukan', 'Cucukan', 'Indonesia', 'Bali', -8.58892, 115.34982, 'Asia/Makassar'), -- OSM node/4274721290
  ('jasri', 'Jasri', 'Indonesia', 'Bali', -8.47737, 115.62385, 'Asia/Makassar'), -- OSM way/440000058
  ('shipwrecks-lembongan', 'Shipwrecks (Lembongan)', 'Indonesia', 'Bali', -8.67016, 115.44231, 'Asia/Makassar') -- OSM way/299142648
on conflict (slug) do nothing;
