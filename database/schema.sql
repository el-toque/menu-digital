-- Ejecutar en el SQL Editor del proyecto Supabase exclusivo del menú digital.
create table if not exists public.menu_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 sort_order integer not null default 0, is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.menu_products (
 id uuid primary key default gen_random_uuid(),
 category_id uuid references public.menu_categories(id) on delete set null,
 name text not null, description text not null default '',
 price numeric(12,2) not null default 0 check(price>=0), currency text not null default '',
 image_url text, status text not null default 'available' check(status in ('available','sold_out','hidden')),
 sort_order integer not null default 0, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.menu_categories enable row level security;
alter table public.menu_products enable row level security;
create policy "Public can read active categories" on public.menu_categories for select to anon,authenticated using(is_active=true);
create policy "Public can read visible products" on public.menu_products for select to anon,authenticated using(status<>'hidden');
create or replace view public.menu_public with (security_invoker=true) as
select p.id,p.name,p.description,p.price,p.currency,p.image_url,p.status,p.sort_order,c.name as category_name
from public.menu_products p left join public.menu_categories c on c.id=p.category_id
where p.status<>'hidden' and (c.id is null or c.is_active=true);
grant select on public.menu_categories to anon,authenticated;
grant select on public.menu_products to anon,authenticated;
grant select on public.menu_public to anon,authenticated;
-- Las políticas de escritura del panel se añadirán al definir y verificar el usuario administrador.