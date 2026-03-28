import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.MNEMO_SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.type;

    console.log(`Square webhook received: ${eventType}`);

    if (eventType === "payment.completed") {
      const payment = body.data?.object?.payment;
      if (!payment) return NextResponse.json({ received: true });

      const orderId = payment.order_id;
      const customerId = payment.customer_id;

      console.log(
        `Payment completed: order=${orderId}, customer=${customerId}`
      );
    }

    if (
      eventType === "subscription.created" ||
      eventType === "subscription.updated"
    ) {
      const subscription = body.data?.object?.subscription;
      if (!subscription) return NextResponse.json({ received: true });

      const subscriptionId = subscription.id;
      const customerId = subscription.customer_id;
      const planId = subscription.plan_variation_id || subscription.plan_id;
      const status = subscription.status; // ACTIVE, CANCELED, etc.

      // Determine plan name from plan ID
      let plan = "free";
      if (planId === process.env.SQUARE_SOLO_PLAN_ID) plan = "solo";
      if (planId === process.env.SQUARE_TEAMS_PLAN_ID) plan = "teams";

      const subscriptionStatus =
        status === "ACTIVE" ? "active" : "inactive";

      // Find tenant by square_customer_id and update
      if (customerId) {
        const { error } = await supabase
          .from("tenants")
          .update({
            plan,
            subscription_id: subscriptionId,
            square_customer_id: customerId,
            subscription_status: subscriptionStatus,
          })
          .eq("square_customer_id", customerId);

        if (error) {
          console.error("Supabase update error:", error);
        } else {
          console.log(
            `Tenant updated: customer=${customerId}, plan=${plan}, status=${subscriptionStatus}`
          );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
