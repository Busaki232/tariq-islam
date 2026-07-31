-- Make the direct-message view respect the permissions and RLS
-- policies of the signed-in caller.
alter view public.dm_conversations
set (security_invoker = true);
revoke all on public.dm_conversations from anon;
revoke all on public.dm_conversations from authenticated;
grant select on public.dm_conversations to authenticated;
-- Collections are public catalog metadata, but client writes are
-- not permitted.
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
drop policy if exists "Public can view collections"
on public.collections;
create policy "Public can view collections"
on public.collections
for select
to anon, authenticated
using (true);
drop policy if exists "Public can view collection products"
on public.collection_products;
create policy "Public can view collection products"
on public.collection_products
for select
to anon, authenticated
using (true);
revoke insert, update, delete, truncate, references, trigger
on public.collections
from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
on public.collection_products
from anon, authenticated;
grant select on public.collections
to anon, authenticated;
grant select on public.collection_products
to anon, authenticated;
