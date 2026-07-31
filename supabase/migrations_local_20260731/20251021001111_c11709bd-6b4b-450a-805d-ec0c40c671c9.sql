-- Grant admin role to taofikbusari@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('70c73986-ae43-49b5-a036-e178e7c10d47', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;