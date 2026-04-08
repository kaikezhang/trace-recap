-- Set kaikezhang@gmail.com as admin
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'kaikezhang@gmail.com';
