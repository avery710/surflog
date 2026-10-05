-- The spot catalogue: the ONE list of surf spots the app uses (server and
-- client both read it; lib/spot-store.ts). It holds the 41 Taiwan breaks,
-- seeded below from the data that used to live only in lib/spots.ts (slugs
-- unchanged, so existing sessions keep resolving), plus, from the next
-- migration, Siargao and Bali. Everyone signed in can read every spot; only
-- the admin(s) listed in the SPOT_ADMIN_EMAILS env var may create, edit or
-- delete them (enforced in the API routes, app/api/spots/**).
--
-- Same access model as every other table (see CLAUDE.md "Multi-user"): RLS
-- on with NO policies; the app talks to it with the server-side secret key
-- and does its own checks.
--
-- Until this is applied the app falls back to the static copy in
-- lib/spot-fixtures.ts (see the "TRANSITIONAL" markers in lib/spot-store.ts
-- and lib/spot-requests.ts).

create table if not exists public.spots (
  slug text primary key check (slug <> '' and position(':' in slug) = 0), -- never "custom:..." / "req:..."
  name text not null,
  name_zh text,                -- Chinese name; Taiwan spots: Swelleye's zh-TW page title
  region text check (region in ('North','Northeast','East','South','West')), -- Taiwan only
  country text not null,
  area text not null,          -- e.g. 'Siargao', 'Bali'; Taiwan spots: the region name
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  timezone text not null,      -- IANA name; sessions.session_when is local time in this zone
  facing text,                 -- 16-point compass, optional (enables the wind tile's shore word)
  best_swell_dir text[],       -- Swelleye "Spot Infographic" (Taiwan spots)
  best_wind_dir text[],
  best_tide text,
  tide_township text,          -- CWA LocationName, e.g. '宜蘭縣頭城鎮' (Taiwan only)
  created_by text,             -- owner id of the admin who added it; null for seeds. Audit only, never sent to clients.
  created_at timestamptz not null default now()
);

create index if not exists spots_area_idx on public.spots (country, area);

alter table public.spots enable row level security;

-- The 41 Taiwan spots, from lib/spots.ts as of 2026-10-05 (now
-- lib/spot-fixtures.ts). Coordinates are Swelleye's own (the lt=/ln= params
-- in each spot page's iframe URLs).
insert into public.spots (slug, name, name_zh, region, country, area, lat, lng, timezone, facing, best_swell_dir, best_wind_dir, best_tide, tide_township)
values
  ('shalun', 'Shalun', '沙崙', 'North', 'Taiwan', 'North', 25.191083, 121.413983, 'Asia/Taipei', 'NW', array['N','NW'], array['E','SE'], 'Low to Mid', '新北市淡水區'),
  ('baishawan', 'Baishawan', '白沙灣', 'North', 'Taiwan', 'North', 25.284306, 121.520582, 'Asia/Taipei', 'N', array['N','NNE','NE','ENE','E'], array['S','SW'], 'Low to Mid', '新北市石門區'),
  ('restaurants', 'Restaurants', '餐廳', 'North', 'Taiwan', 'North', 25.287833, 121.5305, 'Asia/Taipei', 'NW', array['N','NE'], array['S','SW'], 'Mid to High', '新北市石門區'),
  ('jinshan', 'Jinshan', '金山 (中角灣)', 'North', 'Taiwan', 'North', 25.240041, 121.633753, 'Asia/Taipei', 'NE', array['N','NNE','NE','E','ESE'], array['S','SW'], 'Mid', '新北市金山區'),
  ('greenbay', 'Green Bay', '翡翠灣', 'North', 'Taiwan', 'North', 25.188029, 121.686354, 'Asia/Taipei', 'NE', array['E','NE'], array['W','SW'], 'Mid', '新北市萬里區'),
  ('wanli', 'Wanli', '萬里', 'North', 'Taiwan', 'North', 25.181028, 121.691028, 'Asia/Taipei', 'NE', array['NE','E'], array['W','SW'], 'Mid to High', '新北市萬里區'),
  ('fulong', 'Fulong', '福隆', 'North', 'Taiwan', 'North', 25.019898, 121.949, 'Asia/Taipei', 'NE', array['N','NE','E'], array['S','SW'], 'All tides', '新北市貢寮區'),
  ('daxi', 'Daxi', '大溪', 'Northeast', 'Taiwan', 'Northeast', 24.932601, 121.885768, 'Asia/Taipei', 'SE', array['SE','SSE','S','E'], array['NW','W'], 'Mid to High', '宜蘭縣頭城鎮'),
  ('gengfang', 'Gengfang', '梗枋', 'Northeast', 'Taiwan', 'Northeast', 24.903032, 121.865883, 'Asia/Taipei', 'SE', array['E','NE'], array['NW','W'], 'Mid to High', '宜蘭縣頭城鎮'),
  ('double-lions', 'Double Lions', '雙獅', 'Northeast', 'Taiwan', 'Northeast', 24.888556, 121.84961, 'Asia/Taipei', 'E', array['ENE','E','SE','SSE'], array['W','SW'], 'Mid to High', '宜蘭縣頭城鎮'),
  ('waiao', 'Wai''ao', '外澳', 'Northeast', 'Taiwan', 'Northeast', 24.882278, 121.846166, 'Asia/Taipei', 'E', array['ENE','E','SE','SSE'], array['NW','W'], 'Mid to High', '宜蘭縣頭城鎮'),
  ('wushi-north', 'Wushi Harbor (North)', '烏石港（北堤）', 'Northeast', 'Taiwan', 'Northeast', 24.872433, 121.842316, 'Asia/Taipei', 'E', array['E','SE','SSE'], array['NW','W'], 'Mid', '宜蘭縣頭城鎮'),
  ('wushi-south', 'Wushi Harbor (South)', '烏石港（南堤）', 'Northeast', 'Taiwan', 'Northeast', 24.864329, 121.837741, 'Asia/Taipei', 'E', array['ESE','SE','SSE'], array['NW','W'], 'Mid', '宜蘭縣頭城鎮'),
  ('choushui', 'Chou Shui', '臭水', 'Northeast', 'Taiwan', 'Northeast', 24.856368, 121.832876, 'Asia/Taipei', 'E', array['ENE','E','ESE'], array['WSW','W'], 'Low to Mid', '宜蘭縣頭城鎮'),
  ('zhuan', 'Zhu''an', '竹安', 'Northeast', 'Taiwan', 'Northeast', 24.817046, 121.821815, 'Asia/Taipei', 'E', array['NE','ENE','E','ESE','SE','SSE'], array['WNW','W','WSW'], 'Mid to High', '宜蘭縣頭城鎮'),
  ('qingshui', 'Qing Shui', '清水', 'Northeast', 'Taiwan', 'Northeast', 24.6843, 121.836799, 'Asia/Taipei', 'E', array['E','NE','SE'], array['W'], 'Mid to High', '宜蘭縣五結鄉'),
  ('wuwei', 'Su''ao - Wuwei Harbor', '蘇澳 - 無尾港', 'Northeast', 'Taiwan', 'Northeast', 24.610554, 121.863855, 'Asia/Taipei', 'NE', array['E','NE'], array['SW','WSW'], 'Mid to High', '宜蘭縣蘇澳鎮'),
  ('environmental-park', 'Environmental Park', '環保公園', 'East', 'Taiwan', 'East', 24.010331, 121.646504, 'Asia/Taipei', 'ENE', array['E','SE'], array['WNW','NW'], 'Mid', '花蓮縣花蓮市'),
  ('beibin', 'Hualien Beibin', '花蓮北濱', 'East', 'Taiwan', 'East', 23.976647, 121.621122, 'Asia/Taipei', 'SE', array['ESE','SE','S','SSW'], array['WNW','NNW'], 'Low to Mid', '花蓮縣花蓮市'),
  ('double-bridge', 'Double Bridge', '雙橋', 'East', 'Taiwan', 'East', 23.852595, 121.59529, 'Asia/Taipei', 'E', array['E','NE','S','SE'], array['W','WNW'], 'Mid', '花蓮縣壽豐鄉'),
  ('gongs', 'Gongs', '鹽寮漁港', 'East', 'Taiwan', 'East', 23.828258, 121.584592, 'Asia/Taipei', 'E / SE', array['ENE','E','SE'], array['W','WSW'], 'Low to Mid', '花蓮縣壽豐鄉'),
  ('jiqi', 'Jiqi', '磯崎', 'East', 'Taiwan', 'East', 23.708205, 121.549359, 'Asia/Taipei', 'E', array['E','NE','SE'], array['W'], 'Mid to High', '花蓮縣豐濱鄉'),
  ('eight-immortals-cave', 'Baxian Dong', '八仙洞', 'East', 'Taiwan', 'East', 23.397454, 121.480661, 'Asia/Taipei', 'E', array['E','NE'], array['W','SW'], 'Mid to High', '臺東縣長濱鄉'),
  ('yiwan', 'Yiwan', '宜灣', 'East', 'Taiwan', 'East', 23.20866, 121.399553, 'Asia/Taipei', 'SE', array['NE','ENE','E'], array['W','WSW'], 'Mid', '臺東縣成功鎮'),
  ('chenggong', 'Chenggong', '成功', 'East', 'Taiwan', 'East', 23.114722, 121.398583, 'Asia/Taipei', 'SE', array['ENE','E','ESE'], array['W','WSW'], 'Mid to High', '臺東縣成功鎮'),
  ('duli', 'Duli', '都歷', 'East', 'Taiwan', 'East', 23.022447, 121.334657, 'Asia/Taipei', 'E', array['E','NE','ESE'], array['W','WSW'], 'Mid', '臺東縣成功鎮'),
  ('donghe', 'Donghe', '東河', 'East', 'Taiwan', 'East', 22.973653, 121.311941, 'Asia/Taipei', 'E', array['E','NE','SE','SSE'], array['W','SW'], 'Mid', '臺東縣東河鄉'),
  ('jinzun', 'Jinzun', '金樽', 'East', 'Taiwan', 'East', 22.955439, 121.295982, 'Asia/Taipei', 'SE', array['E','NE','S','SE'], array['NW','W'], 'Mid', '臺東縣東河鄉'),
  ('dulan', 'Dulan', '都蘭', 'East', 'Taiwan', 'East', 22.880944, 121.241778, 'Asia/Taipei', 'SE', array['ENE','E','SE','SSE'], array['W','WNW'], 'Mid to High', '臺東縣東河鄉'),
  ('taitung', 'Taitung', '台東', 'East', 'Taiwan', 'East', 22.737194, 121.145832, 'Asia/Taipei', null, null, null, null, '臺東縣臺東市'),
  ('jiupeng', 'Jiupeng', '九棚', 'South', 'Taiwan', 'South', 22.109309, 120.891043, 'Asia/Taipei', 'NE', array['E','ESE','SE'], array['NW','W'], 'Mid', '屏東縣滿州鄉'),
  ('jialeshui', 'Jialeshui', '佳樂水', 'South', 'Taiwan', 'South', 21.987722, 120.845982, 'Asia/Taipei', 'SE', array['ENE','E','SE','SSE'], array['W'], 'Mid', '屏東縣滿州鄉'),
  ('nanwan', 'Nanwan', '南灣', 'South', 'Taiwan', 'South', 21.959292, 120.762598, 'Asia/Taipei', 'S', array['S','SE','SSW'], array['N','NE'], 'Low to Mid', '屏東縣恆春鎮'),
  ('sheliao', 'Sheliao', '射寮', 'South', 'Taiwan', 'South', 22.056413, 120.703433, 'Asia/Taipei', 'W', array['W','SW'], array['E'], 'Mid to Low', '屏東縣車城鄉'),
  ('qijin', 'Qijin', '旗津', 'West', 'Taiwan', 'West', 22.604148, 120.270907, 'Asia/Taipei', 'SW', array['S','SW'], array['N','NE'], 'Low to Mid', '高雄市旗津區'),
  ('yuguangdao', 'Yuguangdao', '漁光島 (馬場)', 'West', 'Taiwan', 'West', 22.980676, 120.154545, 'Asia/Taipei', 'SW', array['S','SW'], array['E','NE'], 'All tides', '臺南市安平區'),
  ('sicao-bridge', 'Sicao Bridge', '四草橋', 'West', 'Taiwan', 'West', 22.993381, 120.141996, 'Asia/Taipei', 'SW', array['S','SW'], array['N','NE'], 'All tides', '臺南市安南區'),
  ('shanshui', 'Shanshui', '山水', 'West', 'Taiwan', 'West', 23.513, 119.59075, 'Asia/Taipei', 'S', array['S','SE','SW'], array['N','NW'], 'All tides', '澎湖縣馬公市'),
  ('songbai', 'Songbai Harbor', '松柏港', 'West', 'Taiwan', 'West', 24.432481, 120.616827, 'Asia/Taipei', 'NW', array['N','NW'], array['E','SE'], 'Mid to High', '臺中市大甲區'),
  ('waipu', 'Waipu Fishing Harbor', '外埔北堤', 'West', 'Taiwan', 'West', 24.653837, 120.773386, 'Asia/Taipei', 'NW', array['N','NW'], array['SE','SSE'], 'Mid', '苗栗縣後龍鎮'),
  ('zhunan', 'Zhunan', '竹南', 'West', 'Taiwan', 'West', 24.697639, 120.854471, 'Asia/Taipei', 'NW', array['N','NW','W'], array['E','SE'], 'Mid', '苗栗縣竹南鎮')
on conflict (slug) do nothing;
