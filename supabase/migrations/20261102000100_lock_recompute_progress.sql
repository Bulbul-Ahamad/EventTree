-- 4.11: security review of SECURITY DEFINER functions (04_TRD §8 rule 2).
-- app_private.recompute_progress_upwards is only meant to be called by the roll-up triggers.
-- It was not exposed to the API (app_private is not an exposed schema), but it did not say so
-- itself: take away execute from everyone who is not the owner. The triggers are SECURITY
-- DEFINER and keep working.
revoke execute on function app_private.recompute_progress_upwards(uuid) from public, anon, authenticated;
