REVOKE EXECUTE ON FUNCTION public.is_catalogue_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_catalogue_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_catalogue_admin(uuid) TO authenticated, service_role;