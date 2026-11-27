create table if not exists public.products (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  ingredients jsonb not null default '[]'::jsonb,
  product_src text not null,
  product_animation text not null check (product_animation in ('soft', 'turntable', 'halo')),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.products to anon, authenticated;

alter table public.products enable row level security;

drop policy if exists "Anyone can read products" on public.products;
create policy "Anyone can read products"
  on public.products for select to anon, authenticated
  using (true);

drop policy if exists "Anyone can add products" on public.products;
create policy "Anyone can add products"
  on public.products for insert to anon, authenticated
  with check (true);

drop policy if exists "Anyone can update products" on public.products;
create policy "Anyone can update products"
  on public.products for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "Anyone can delete products" on public.products;
create policy "Anyone can delete products"
  on public.products for delete to anon, authenticated
  using (true);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can view product images" on storage.objects;
create policy "Anyone can view product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Anyone can upload product images" on storage.objects;
create policy "Anyone can upload product images"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Anyone can update product images" on storage.objects;
create policy "Anyone can update product images"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Anyone can delete product images" on storage.objects;
create policy "Anyone can delete product images"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'product-images');
