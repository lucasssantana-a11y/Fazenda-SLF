create extension if not exists "uuid-ossp";

create table farms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table lots (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid references farms(id),
  name text not null,
  quantity integer not null default 0,
  entry_date date,
  purchase_arrobas numeric(10,2),
  purchase_price_per_head numeric(14,2),
  current_arrobas numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table animals (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid references farms(id),
  lot_id uuid references lots(id),
  tag text not null,
  entry_date date,
  current_arrobas numeric(10,2),
  current_weight_kg numeric(10,2),
  scale_provider text,
  scale_external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table animal_weighings (
  id uuid primary key default uuid_generate_v4(),
  animal_id uuid not null references animals(id),
  tag_snapshot text,
  weighing_date date not null,
  weight_kg numeric(10,2) not null,
  arrobas numeric(10,2),
  source text,
  photo_url text,
  media_urls jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table lot_weighings (
  id uuid primary key default uuid_generate_v4(),
  lot_id uuid not null references lots(id),
  weighing_date date not null,
  quantity_evaluated integer,
  average_weight_kg numeric(10,2) not null,
  average_arrobas numeric(10,2),
  total_weight_kg numeric(14,2),
  total_arrobas numeric(14,2),
  source text,
  photo_url text,
  media_urls jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table expense_categories (
  id text primary key,
  name text not null,
  category_group text not null,
  default_description text
);

create table expenses (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid references farms(id),
  lot_id uuid references lots(id),
  lot_ids jsonb not null default '[]'::jsonb,
  animal_id uuid references animals(id),
  expense_category_id text references expense_categories(id),
  description text not null,
  amount numeric(14,2) not null,
  expense_date date,
  allocation_mode text,
  receipt_url text,
  receipt_ocr_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table pastures (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid references farms(id),
  name text not null,
  area_ha numeric(10,2),
  status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table pasture_movements (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid references farms(id),
  lot_id uuid references lots(id),
  pasture_id uuid references pastures(id),
  movement_type text not null check (movement_type in ('Entrada', 'Saída')),
  movement_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table supplements (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text,
  bag_price numeric(14,2),
  bag_kg numeric(10,2),
  cost_kg numeric(14,4) generated always as (
    case when bag_kg > 0 then bag_price / bag_kg else null end
  ) stored,
  default_percent_pv numeric(10,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table arroba_daily_quotes (
  id uuid primary key default uuid_generate_v4(),
  quote_date date not null,
  source text not null,
  region text,
  price_brl numeric(14,2) not null,
  price_usd numeric(14,2),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (quote_date, source, region)
);

create table arroba_monthly_closes (
  id uuid primary key default uuid_generate_v4(),
  month date not null,
  source text not null,
  region text,
  close_date date not null,
  close_price_brl numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (month, source, region)
);

create table arroba_historical_annual (
  id uuid primary key default uuid_generate_v4(),
  year integer not null unique,
  average_price_brl numeric(14,2) not null,
  source text not null,
  source_quality text not null default 'reconcile_before_commercial_decision'
);

create table financial_series (
  id uuid primary key default uuid_generate_v4(),
  series_date date not null,
  code text not null,
  name text not null,
  value numeric(18,8) not null,
  unit text,
  source text not null default 'BCB SGS',
  created_at timestamptz not null default now(),
  unique (series_date, code)
);

create index idx_arroba_daily_quotes_date on arroba_daily_quotes (quote_date desc);
create index idx_arroba_monthly_closes_month on arroba_monthly_closes (month desc);
create index idx_financial_series_code_date on financial_series (code, series_date desc);

create table risk_factors (
  id uuid primary key default uuid_generate_v4(),
  farm_id uuid references farms(id),
  category text not null,
  name text not null,
  direction text not null check (direction in ('positivo', 'negativo', 'neutro', 'misto')),
  impact integer not null check (impact between 1 and 5),
  probability integer not null check (probability between 1 and 5),
  horizon_months integer not null default 12,
  source text,
  notes text,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table cycle_signals (
  id uuid primary key default uuid_generate_v4(),
  signal_date date not null,
  phase text not null,
  confidence numeric(5,4),
  source text,
  notes text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_risk_factors_category on risk_factors (category);
create index idx_cycle_signals_date on cycle_signals (signal_date desc);
