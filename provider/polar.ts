import type {
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  WebhookHandler,
} from "../types";

const POLAR_API_URL = "https://api.polar.sh/v1";

function getPolarAccessToken(): string {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("Missing env variable POLAR_ACCESS_TOKEN");
  }
  return accessToken;
}

export const createCheckoutLink: CreateCheckoutLink = async (params) => {
  const accessToken = getPolarAccessToken();
  const { productId, redirectUrl, customerId, organizationId, userId } = params;

  const metadata: Record<string, string> = {};
  if (organizationId) metadata.organization_id = organizationId;
  if (userId) metadata.user_id = userId;

  const response = await fetch(`${POLAR_API_URL}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      products: [productId],
      success_url: redirectUrl ?? "",
      metadata,
      customer_id: customerId || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Polar API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as { url: string };
  return result.url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async (
  params
) => {
  const accessToken = getPolarAccessToken();
  const { customerId } = params;

  const response = await fetch(`${POLAR_API_URL}/customer-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_id: customerId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Polar API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as { customer_portal_url: string };
  return result.customer_portal_url;
};

export const webhookHandler: WebhookHandler = async (req) => {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Missing POLAR_WEBHOOK_SECRET", { status: 500 });
  }

  if (!req.body) {
    return new Response("No body", { status: 400 });
  }

  try {
    const body = await req.text();
    // Note: For production, verify signature using Polar SDK
    const event = JSON.parse(body) as {
      type: string;
      data: Record<string, unknown>;
    };

    // Handle webhook events - implement your business logic here
    switch (event.type) {
      case "order.created":
      case "subscription.created":
      case "subscription.updated":
      case "subscription.canceled":
        // Implement your business logic here
        break;
      default:
        // Unhandled event type
        break;
    }

    return new Response(null, { status: 202 });
  } catch {
    return new Response("Invalid webhook payload", { status: 400 });
  }
};
