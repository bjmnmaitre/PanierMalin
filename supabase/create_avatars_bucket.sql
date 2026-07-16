-- Bucket public pour les avatars utilisateurs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 Mo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS : l'utilisateur peut lire tous les avatars (bucket public)
create policy "avatars_public_read"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

-- RLS : l'utilisateur peut uploader dans son propre dossier
create policy "avatars_owner_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS : l'utilisateur peut remplacer son avatar
create policy "avatars_owner_update"
  on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
