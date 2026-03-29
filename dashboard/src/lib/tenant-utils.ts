import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve all tenant IDs a user has access to.
 * Combines: manually linked tenants + derived variants from email/org name.
 */
export async function getUserTenantIds(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
  orgName: string,
  explicitTenantId?: string
): Promise<string[]> {
  const tenantIds = new Set<string>();

  // 1. Explicit tenant_id from user metadata (set on signup)
  if (explicitTenantId) {
    tenantIds.add(explicitTenantId);
  }

  // 2. Manually linked tenants from user_tenants table
  try {
    const { data: linked } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", userId);
    linked?.forEach((t) => tenantIds.add(t.tenant_id));
  } catch {
    // Table may not exist yet — ignore
  }

  // 3. Derived variants from email
  if (userEmail) {
    const prefix = userEmail.split("@")[0];
    tenantIds.add(prefix);
    tenantIds.add(prefix.toLowerCase());
  }

  // 4. Org name variants
  if (orgName) {
    tenantIds.add(orgName);
    tenantIds.add(orgName.toLowerCase());
    const stripped = orgName.toLowerCase().replace(/\.(ai|io|com|org|dev|app)$/i, "");
    if (stripped !== orgName.toLowerCase()) tenantIds.add(stripped);
    tenantIds.add(orgName.toLowerCase().replace(/[^a-z0-9]/g, ""));
  }

  // 5. Filter to only tenants that actually exist in the database
  const candidates = Array.from(tenantIds).filter(Boolean);
  if (candidates.length === 0) return [];

  const { data: existing } = await supabase
    .from("tenants")
    .select("tenant_id")
    .in("tenant_id", candidates);

  return (existing || []).map((t) => t.tenant_id);
}
