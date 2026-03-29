import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.MNEMO_SUPABASE_SERVICE_KEY!
);

/**
 * Called on redirect after Square checkout.
 * Creates or updates the tenant with the paid plan.
 * Uses upsert so it works even if the tenant doesn't exist yet.
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, plan } = await request.json();

    if (!tenantId || !plan || !["solo", "teams"].includes(plan)) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    // Upsert — creates tenant if new, updates if exists
    const { error } = await supabase
      .from("tenants")
      .upsert(
        {
          tenant_id: tenantId,
          name: tenantId,
          plan,
          subscription_status: "active",
        },
        { onConflict: "tenant_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", plan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
