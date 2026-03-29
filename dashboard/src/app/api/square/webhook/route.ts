import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SquareClient, SquareEnvironment } from "square";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.MNEMO_SUPABASE_SERVICE_KEY!
);

const square = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: process.env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
});

function planFromAmount(amount: number | bigint | undefined): string {
  const cents = Number(amount || 0);
  if (cents === 2900) return "solo";
  if (cents === 9900) return "teams";
  return "free";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.type;
    console.log(`[square webhook] ${eventType}`);

    if (eventType === "payment.completed") {
      const payment = body.data?.object?.payment;
      if (!payment) return NextResponse.json({ received: true });

      const orderId = payment.order_id;
      const customerId = payment.customer_id;
      const amountPaid = payment.amount_money?.amount;
      const plan = planFromAmount(amountPaid);

      // Try to get tenant_id from order metadata
      let tenantId = "";
      // email available in meta.email if needed
      if (orderId) {
        try {
          const orderResult = await square.orders.get({ orderId });
          const meta = orderResult.order?.metadata || {};
          tenantId = meta.tenant_id || "";
          // meta.email also available
        } catch (e) {
          console.log(`[square webhook] order fetch failed: ${e}`);
        }
      }

      if (tenantId) {
        // Upsert — creates tenant if new, updates if exists
        const { error } = await supabase
          .from("tenants")
          .upsert(
            {
              tenant_id: tenantId,
              name: tenantId,
              plan,
              square_customer_id: customerId || null,
              subscription_status: "active",
            },
            { onConflict: "tenant_id" }
          );

        if (error) {
          console.error(`[square webhook] tenant update by tenant_id failed:`, error);
        } else {
          console.log(`[square webhook] tenant ${tenantId} → plan=${plan}, customer=${customerId}`);
        }
      } else if (customerId) {
        // Fallback: try by square_customer_id
        const { error } = await supabase
          .from("tenants")
          .update({ plan, subscription_status: "active" })
          .eq("square_customer_id", customerId);

        if (error) {
          console.error(`[square webhook] tenant update by customer_id failed:`, error);
        } else {
          console.log(`[square webhook] customer ${customerId} → plan=${plan}`);
        }
      }
    }

    if (eventType === "subscription.created" || eventType === "subscription.updated") {
      const subscription = body.data?.object?.subscription;
      if (!subscription) return NextResponse.json({ received: true });

      const subscriptionId = subscription.id;
      const customerId = subscription.customer_id;
      const planId = subscription.plan_variation_id || subscription.plan_id;
      const status = subscription.status;

      let plan = "free";
      if (planId === process.env.SQUARE_SOLO_PLAN_ID) plan = "solo";
      if (planId === process.env.SQUARE_TEAMS_PLAN_ID) plan = "teams";

      if (customerId) {
        await supabase
          .from("tenants")
          .update({
            plan,
            subscription_id: subscriptionId,
            square_customer_id: customerId,
            subscription_status: status === "ACTIVE" ? "active" : "inactive",
          })
          .eq("square_customer_id", customerId);

        console.log(`[square webhook] subscription ${subscriptionId} → plan=${plan}, status=${status}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[square webhook] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
