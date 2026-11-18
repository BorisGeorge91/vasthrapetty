-- Vasthrapetty: database schema, admin policies, storage and public enquiry submission
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
  created_at timestamptz not null default now()
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

-- Explicit allowlist: an Auth user is an administrator only after their UUID is added here.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);


insert into public.categories(name,slug,display_order) values
  ('Signature hamper','signature-hamper',1),
  ('Saree edit','saree-edit',2),
  ('Custom gifting','custom-gifting',3),
  ('Festive collection','festive-collection',4),
  ('Accessories','accessories',5)
on conflict (slug) do nothing;

create index if not exists products_status_created_idx on public.products(status, created_at desc);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists enquiries_status_created_idx on public.enquiries(status, created_at desc);
create index if not exists enquiries_customer_idx on public.enquiries(customer_id);
create index if not exists enquiry_items_enquiry_idx on public.enquiry_items(enquiry_id);
create index if not exists enquiry_addons_enquiry_idx on public.enquiry_addons(enquiry_id);
create index if not exists product_images_product_order_idx on public.product_images(product_id, display_order);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists enquiries_set_updated_at on public.enquiries;
create trigger enquiries_set_updated_at before update on public.enquiries for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Enable RLS across application data.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_items enable row level security;
alter table public.enquiry_addons enable row level security;
alter table public.activity_log enable row level security;
alter table public.admin_users enable row level security;

-- Public users can read only categories/products/images used in the published catalogue.
drop policy if exists "Published categories are public" on public.categories;
create policy "Published categories are public" on public.categories for select to anon, authenticated
using (exists (select 1 from public.products p where p.category_id = categories.id and p.status = 'published') or public.is_admin());

drop policy if exists "Published products are public" on public.products;
create policy "Published products are public" on public.products for select to anon, authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "Published product images are public" on public.product_images;
create policy "Published product images are public" on public.product_images for select to anon, authenticated
using (exists (select 1 from public.products p where p.id = product_images.product_id and p.status = 'published') or public.is_admin());

-- Admin catalogue permissions.
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins insert products" on public.products;
create policy "Admins insert products" on public.products for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update products" on public.products;
create policy "Admins update products" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete products" on public.products;
create policy "Admins delete products" on public.products for delete to authenticated using (public.is_admin());

drop policy if exists "Admins manage product images" on public.product_images;
create policy "Admins manage product images" on public.product_images for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Admin enquiry/customer access. Public submissions are made only through the RPC below.
drop policy if exists "Admins read customers" on public.customers;
create policy "Admins read customers" on public.customers for select to authenticated using (public.is_admin());
drop policy if exists "Admins read enquiries" on public.enquiries;
create policy "Admins read enquiries" on public.enquiries for select to authenticated using (public.is_admin());
drop policy if exists "Admins update enquiries" on public.enquiries;
create policy "Admins update enquiries" on public.enquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins read enquiry items" on public.enquiry_items;
create policy "Admins read enquiry items" on public.enquiry_items for select to authenticated using (public.is_admin());
drop policy if exists "Admins read enquiry addons" on public.enquiry_addons;
create policy "Admins read enquiry addons" on public.enquiry_addons for select to authenticated using (public.is_admin());
drop policy if exists "Admins read activity log" on public.activity_log;
create policy "Admins read activity log" on public.activity_log for select to authenticated using (public.is_admin());
drop policy if exists "Admins create activity log entries" on public.activity_log;
create policy "Admins create activity log entries" on public.activity_log for insert to authenticated with check (public.is_admin());

drop policy if exists "Users can read own admin membership" on public.admin_users;
create policy "Users can read own admin membership" on public.admin_users for select to authenticated using (user_id = auth.uid());

-- Atomic, validated enquiry submission. Runs with definer privileges so customers never receive table read/write access.
create or replace function public.submit_enquiry(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_enquiry_id uuid;
  v_product_id uuid;
  v_product_name text;
  v_product_price numeric(12,2);
  v_addon text;
  v_delivery_date date;
  v_lat double precision;
  v_lon double precision;
  v_notes text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 30000 then
    raise exception 'Invalid enquiry payload.';
  end if;

  if coalesce(length(p_payload->>'name'),0) > 160
    or coalesce(length(p_payload->>'phone'),0) > 40
    or coalesce(length(p_payload->>'email'),0) > 254
    or coalesce(length(p_payload->>'city'),0) > 1200
    or coalesce(length(p_payload->>'brief'),0) > 3000
    or coalesce(length(p_payload->>'recipientBrief'),0) > 2000
    or coalesce(length(p_payload->>'customNotes'),0) > 2000 then
    raise exception 'One or more enquiry fields exceed the allowed length.';
  end if;

  if nullif(p_payload->>'deliveryDate','') is not null then
    v_delivery_date := (p_payload->>'deliveryDate')::date;
  end if;
  if nullif(p_payload->>'deliveryLat','') is not null then
    v_lat := (p_payload->>'deliveryLat')::double precision;
  end if;
  if nullif(p_payload->>'deliveryLon','') is not null then
    v_lon := (p_payload->>'deliveryLon')::double precision;
  end if;
  if v_lat is not null and (v_lat < -90 or v_lat > 90) then raise exception 'Invalid delivery latitude.'; end if;
  if v_lon is not null and (v_lon < -180 or v_lon > 180) then raise exception 'Invalid delivery longitude.'; end if;

  insert into public.customers(full_name, whatsapp_number, email)
  values (nullif(trim(p_payload->>'name'),''), nullif(trim(p_payload->>'phone'),''), nullif(trim(p_payload->>'email'),''))
  returning id into v_customer_id;

  v_notes := concat_ws(E'\n\n',
    case when nullif(trim(p_payload->>'recipientBrief'),'') is not null then 'Recipient preferences: ' || trim(p_payload->>'recipientBrief') end,
    case when nullif(trim(p_payload->>'customNotes'),'') is not null then 'Hamper preferences: ' || trim(p_payload->>'customNotes') end,
    case when nullif(trim(p_payload->>'brief'),'') is not null then 'Additional notes: ' || trim(p_payload->>'brief') end
  );

  insert into public.enquiries(
    customer_id, occasion, budget, delivery_date, delivery_address, delivery_postcode,
    delivery_latitude, delivery_longitude, custom_hamper, notes, original_form_payload
  ) values (
    v_customer_id,
    nullif(trim(p_payload->>'occasion'),''),
    nullif(trim(p_payload->>'budget'),''),
    v_delivery_date,
    nullif(trim(p_payload->>'city'),''),
    nullif(trim(p_payload->>'pin'),''),
    v_lat, v_lon,
    (jsonb_typeof(p_payload->'addons') = 'array' and jsonb_array_length(p_payload->'addons') > 0)
      or nullif(trim(p_payload->>'customNotes'),'') is not null,
    nullif(v_notes,''),
    p_payload
  ) returning id into v_enquiry_id;

  if nullif(p_payload->>'selectedProduct','') is not null then
    v_product_id := (p_payload->>'selectedProduct')::uuid;
    select name, price into v_product_name, v_product_price
      from public.products where id = v_product_id and status = 'published';
    if v_product_name is null then raise exception 'Selected hamper is no longer available.'; end if;
    insert into public.enquiry_items(enquiry_id, product_id, product_name_snapshot, unit_price_snapshot)
    values (v_enquiry_id, v_product_id, v_product_name, v_product_price);
  end if;

  if jsonb_typeof(p_payload->'addons') = 'array' then
    if jsonb_array_length(p_payload->'addons') > 20 then raise exception 'Too many hamper additions selected.'; end if;
    for v_addon in select value from jsonb_array_elements_text(p_payload->'addons') loop
      if length(v_addon) > 160 then raise exception 'An addition name is too long.'; end if;
      insert into public.enquiry_addons(enquiry_id, addon_name) values (v_enquiry_id, v_addon);
    end loop;
  end if;

  insert into public.activity_log(enquiry_id, action, details)
  values (v_enquiry_id, 'customer_enquiry_submitted', jsonb_build_object('source','website'));

  return v_enquiry_id;
end;
$$;
revoke all on function public.submit_enquiry(jsonb) from public;
grant execute on function public.submit_enquiry(jsonb) to anon, authenticated;

-- Product images are public to view and writable only by allowlisted admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
