-- Vasthrapetty initial schema
create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'INR',
  category_id uuid references public.categories(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  whatsapp_number text,
  email text,
  created_at timestamptz not null default now(),
  constraint customers_contact_present check (nullif(trim(coalesce(whatsapp_number,'')), '') is not null or nullif(trim(coalesce(email,'')), '') is not null)
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  occasion text,
  budget text,
  delivery_date date,
  delivery_address text,
  delivery_postcode text,
  delivery_latitude double precision,
  delivery_longitude double precision,
  custom_hamper boolean not null default false,
  notes text,
  status text not null default 'new' check (status in ('new','contacted','in_progress','completed','cancelled')),
  original_form_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiry_items (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  unit_price_snapshot numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.enquiry_addons (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  addon_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references public.enquiries(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists products_status_created_idx on public.products(status, created_at desc);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists enquiries_status_created_idx on public.enquiries(status, created_at desc);
create index if not exists enquiries_customer_idx on public.enquiries(customer_id);
create index if not exists enquiry_items_enquiry_idx on public.enquiry_items(enquiry_id);
create index if not exists enquiry_addons_enquiry_idx on public.enquiry_addons(enquiry_id);

-- Keep updated_at current on products and enquiries.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists enquiries_set_updated_at on public.enquiries;
create trigger enquiries_set_updated_at before update on public.enquiries for each row execute function public.set_updated_at();

-- RLS is enabled by default for all application tables.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_items enable row level security;
alter table public.enquiry_addons enable row level security;
alter table public.activity_log enable row level security;

-- Public storefront can read published catalogue data only.
drop policy if exists "Published categories are public" on public.categories;
create policy "Published categories are public" on public.categories for select to anon, authenticated using (
  exists (select 1 from public.products p where p.category_id = categories.id and p.status = 'published')
);
drop policy if exists "Published products are public" on public.products;
create policy "Published products are public" on public.products for select to anon, authenticated using (status = 'published');
drop policy if exists "Published product images are public" on public.product_images;
create policy "Published product images are public" on public.product_images for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_images.product_id and p.status = 'published')
);

-- No public insert/select/update/delete policies are created for enquiries or customers.
-- The customer submission endpoint will use a server-side secret after input validation;
-- admin operations will require authenticated users and an explicit admin allowlist.
-- Do not expose a secret key in client-side code.
