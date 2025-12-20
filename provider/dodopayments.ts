import { createHmac } from "node:crypto";
import type {
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  WebhookHandler,
} from "../types";

function getDodoPaymentsApiUrl(): string {
  return process.env.NODE_ENV === "production"
    ? "https://api.dodopayments.com/v1"
    : "https://api.dodopayments.com/test/v1";
}

function getDodoPaymentsApiKey(): string {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env variable DODO_PAYMENTS_API_KEY");
  }
  return apiKey;
}

export const createCheckoutLink: CreateCheckoutLink = async (params) => {
  const apiKey = getDodoPaymentsApiKey();
  const baseUrl = getDodoPaymentsApiUrl();
  const {
    productId,
    redirectUrl,
    customerId,
    organizationId,
    userId,
    trialPeriodDays,
    seats,
    email,
    name,
  } = params;

  const metadata: Record<string, string> = {};
  if (organizationId) metadata.organization_id = organizationId;
  if (userId) metadata.user_id = userId;

  const response = await fetch(`${baseUrl}/checkout-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_cart: [
        {
          product_id: productId,
          quantity: seats ?? 1,
        },
      ],
      return_url: redirectUrl ?? "",
      customer: customerId
        ? { customer_id: customerId }
        : { email: email ?? "", name: name ?? "" },
      metadata,
      subscription_data: trialPeriodDays
        ? { trial_period_days: trialPeriodDays }
        : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`DodoPayments API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as { checkout_url: string };
  return result.checkout_url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async (
  params
) => {
  const apiKey = getDodoPaymentsApiKey();
  const baseUrl = getDodoPaymentsApiUrl();
  const { customerId } = params;

  const response = await fetch(
    `${baseUrl}/customers/${customerId}/portal`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`DodoPayments API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as { link: string };
  return result.link;
};

export const webhookHandler: WebhookHandler = async (req) => {
  const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Missing DODO_PAYMENTS_WEBHOOK_SECRET", { status: 500 });
  }

  if (!req.body) {
    return new Response("Invalid request", { status: 400 });
  }

  try {
    const body = await req.text();
    const headers = req.headers;

    const webhookId = headers.get("webhook-id");
    const webhookSignature = headers.get("webhook-signature");
    const webhookTimestamp = headers.get("webhook-timestamp");

    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      return new Response("Missing webhook headers", { status: 400 });
    }

    const payload = `${webhookId}.${webhookTimestamp}.${body}`;
    const expectedSignature = createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    if (webhookSignature !== expectedSignature) {
      return new Response("Invalid webhook signature", { status: 401 });
    }

    const event = JSON.parse(body) as {
      type: string;
      data: Record<string, unknown>;
    };

    // Handle webhook events - implement your business logic here
    switch (event.type) {
      case "checkout.session.completed":
      case "subscription.created":
      case "subscription.updated":
      case "subscription.cancelled":
        // Implement your business logic here
        break;
      default:
        // Unhandled event type
        break;
    }

    return new Response(null, { status: 204 });
  } catch {
    return new Response("Invalid webhook payload", { status: 400 });
  }
};
