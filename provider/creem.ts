import { createHmac } from "node:crypto";
import type {
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  WebhookHandler,
} from "../types";

function getCreemApiUrl(): string {
  return process.env.NODE_ENV === "production"
    ? "https://api.creem.io/v1"
    : "https://test-api.creem.io/v1";
}

function getCreemApiKey(): string {
  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env variable CREEM_API_KEY");
  }
  return apiKey;
}

async function creemFetch(
  path: string,
  init: RequestInit
): Promise<Response> {
  const apiKey = getCreemApiKey();
  const baseUrl = getCreemApiUrl();

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export const createCheckoutLink: CreateCheckoutLink = async (params) => {
  const { productId, redirectUrl, organizationId, userId, seats, email } =
    params;

  const response = await creemFetch("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      units: seats ?? 1,
      success_url: redirectUrl ?? undefined,
      metadata: {
        organization_id: organizationId || null,
        user_id: userId || null,
      },
      customer: {
        email,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Creem API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as { checkout_url: string };
  return result.checkout_url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async (
  params
) => {
  const { customerId } = params;

  const response = await creemFetch("/customers/billing", {
    method: "POST",
    body: JSON.stringify({
      customer_id: customerId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Creem API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as { customer_portal_link: string };
  return result.customer_portal_link;
};

export const webhookHandler: WebhookHandler = async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("creem-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Missing CREEM_WEBHOOK_SECRET", { status: 500 });
  }

  const bodyText = await req.text();
  const computedSignature = createHmac("sha256", secret)
    .update(bodyText)
    .digest("hex");

  if (computedSignature !== signature) {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const payload = JSON.parse(bodyText) as {
      eventType: string;
      object: Record<string, unknown>;
    };

    // Handle webhook events - implement your business logic here
    switch (payload.eventType) {
      case "checkout.completed":
      case "subscription.active":
      case "subscription.canceled":
      case "subscription.expired":
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
