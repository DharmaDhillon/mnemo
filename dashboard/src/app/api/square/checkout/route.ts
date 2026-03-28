import { NextRequest, NextResponse } from "next/server";
import { SquareClient, SquareEnvironment } from "square";
import { randomUUID } from "crypto";

const client = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: SquareEnvironment.Sandbox,
});

const PLAN_MAP: Record<string, { planId: string; name: string; amount: number }> = {
  solo: {
    planId: process.env.SQUARE_SOLO_PLAN_ID!,
    name: "Mnemo Cloud Solo",
    amount: 2900,
  },
  teams: {
    planId: process.env.SQUARE_TEAMS_PLAN_ID!,
    name: "Mnemo Cloud Teams",
    amount: 9900,
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, tenantId, email } = body;

    const planConfig = PLAN_MAP[plan];
    if (!planConfig) {
      return NextResponse.json(
        { error: `Invalid plan: ${plan}. Use 'solo' or 'teams'.` },
        { status: 400 }
      );
    }

    const result = await client.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        lineItems: [
          {
            name: planConfig.name,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(planConfig.amount),
              currency: "USD",
            },
          },
        ],
        metadata: {
          tenant_id: tenantId || "",
          email: email || "",
          plan: plan,
        },
      },
      checkoutOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://usemnemo.com"}/dashboard?payment=success&plan=${plan}`,
        allowTipping: false,
        askForShippingAddress: false,
      },
    });

    if (result.paymentLink?.url) {
      return NextResponse.json({
        url: result.paymentLink.url,
        orderId: result.paymentLink.orderId,
      });
    }

    return NextResponse.json(
      { error: "Failed to create checkout link" },
      { status: 500 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Square checkout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
