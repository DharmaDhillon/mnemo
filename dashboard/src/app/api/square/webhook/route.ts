import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SquareClient, SquareEnvironment } from "square";
import { createHmac } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.MNEMO_SUPABASE_SERVICE_KEY!
);

const square = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: process.env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
});

const SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";
const WEBHOOK_URL = "https://usemnemo.com/api/square/webhook";

function verifySignature(body: string, signature: string | null): boolean {
  if (!SIGNATURE_KEY || !signature) return !SIGNATURE_KEY; // skip if no key configured
  const hmac = createHmac("sha256", SIGNATURE_KEY);
  hmac.update(WEBHOOK_URL + body);
  const expected = hmac.digest("base64");
  return expected === signature;
}

function planFromAmount(amount: number | bigint | undefined): string {
  const cents = Number(amount || 0);
  if (cents === 2900) return "solo";
  if (cents === 9900) return "teams";
  return "free";
}

export async function POST(request: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");

  if (SIGNATURE_KEY && !verifySignature(rawBody, signature)) {
    console.error("[square webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const body = JSON.parse(rawBody);
    const eventType = body.type;
    console.log(`[square webhook] ${eventType}`);

    // Handle payment.created and payment.updated
    if (eventType === "payment.created" || eventType === "payment.updated") {
      const payment = body.data?.object?.payment;
      if (!payment) return NextResponse.json({ received: true });

      // Only process completed payments
      if (payment.status !== "COMPLETED") {
        console.log(`[square webhook] payment status ${payment.status} — skipping`);
        return NextResponse.json({ received: true });
      }

      const orderId = payment.order_id;
      const customerId = payment.customer_id;
      const amountPaid = payment.amount_money?.amount;
      const plan = planFromAmount(amountPaid);

      // Get tenant_id from order metadata
      let tenantId = "";
      if (orderId) {
        try {
          const orderResult = await square.orders.get({ orderId });
          const meta = orderResult.order?.metadata || {};
          tenantId = meta.tenant_id || "";
        } catch (e) {
          console.log(`[square webhook] order fetch failed: ${e}`);
        }
      }

      if (tenantId) {
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
          console.error(`[square webhook] upsert failed:`, error);
        } else {
          console.log(`[square webhook] ${tenantId} → plan=${plan}`);
        }
      }
    }

    // Handle subscriptions
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

        console.log(`[square webhook] subscription ${subscriptionId} → plan=${plan}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[square webhook] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
