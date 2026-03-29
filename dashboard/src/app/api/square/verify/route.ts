import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.MNEMO_SUPABASE_SERVICE_KEY!
);

/**
 * Called on redirect after Square checkout.
 * Updates the tenant plan immediately so the user sees it
 * without waiting for the webhook.
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, plan } = await request.json();

    if (!tenantId || !plan || !["solo", "teams"].includes(plan)) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    const { error } = await supabase
      .from("tenants")
      .update({
        plan,
        subscription_status: "active",
      })
      .eq("tenant_id", tenantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", plan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
