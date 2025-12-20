import type {
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  WebhookHandler,
} from "../types";

const STRIPE_API_URL = "https://api.stripe.com/v1";

function getStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing env variable STRIPE_SECRET_KEY");
  }
  return secretKey;
}

export const createCheckoutLink: CreateCheckoutLink = async (params) => {
  const secretKey = getStripeSecretKey();
  const {
    type,
    productId,
    email,
    redirectUrl,
    customerId,
    organizationId,
    userId,
    trialPeriodDays,
    seats,
  } = params;

  const body = new URLSearchParams({
    mode: type === "subscription" ? "subscription" : "payment",
    success_url: redirectUrl ?? "",
    "line_items[0][price]": productId,
    "line_items[0][quantity]": String(seats ?? 1),
  });

  if (customerId) {
    body.append("customer", customerId);
  } else if (email) {
    body.append("customer_email", email);
  }

  if (organizationId) {
    body.append("metadata[organization_id]", organizationId);
  }
  if (userId) {
    body.append("metadata[user_id]", userId);
  }

  if (type === "subscription" && trialPeriodDays) {
    body.append(
      "subscription_data[trial_period_days]",
      String(trialPeriodDays)
    );
  }

  const response = await fetch(`${STRIPE_API_URL}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Stripe API error: ${JSON.stringify(error)}`);
  }

  const session = (await response.json()) as { url: string };
  return session.url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async (
  params
) => {
  const secretKey = getStripeSecretKey();
  const { customerId, redirectUrl } = params;

  const body = new URLSearchParams({
    customer: customerId,
  });

  if (redirectUrl) {
    body.append("return_url", redirectUrl);
  }

  const response = await fetch(`${STRIPE_API_URL}/billing_portal/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Stripe API error: ${JSON.stringify(error)}`);
  }

  const session = (await response.json()) as { url: string };
  return session.url;
};

export const webhookHandler: WebhookHandler = async (req) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  if (!req.body) {
    return new Response("Invalid request", { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // Note: For production, you should verify the signature using Stripe's SDK
  // This is a simplified implementation

  try {
    const body = await req.text();
    const event = JSON.parse(body) as {
      type: string;
      data: { object: Record<string, unknown> };
    };

    // Handle webhook events - implement your business logic here
    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // Implement your business logic here
        break;
      default:
        // Unhandled event type
        break;
    }

    return new Response(null, { status: 200 });
  } catch {
    return new Response("Invalid webhook payload", { status: 400 });
  }
};
