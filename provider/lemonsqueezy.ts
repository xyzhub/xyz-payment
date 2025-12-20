import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  WebhookHandler,
} from "../types";

const LEMONSQUEEZY_API_URL = "https://api.lemonsqueezy.com/v1";

function getLemonSqueezyApiKey(): string {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env variable LEMONSQUEEZY_API_KEY");
  }
  return apiKey;
}

function getLemonSqueezyStoreId(): string {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!storeId) {
    throw new Error("Missing env variable LEMONSQUEEZY_STORE_ID");
  }
  return storeId;
}

export const createCheckoutLink: CreateCheckoutLink = async (params) => {
  const apiKey = getLemonSqueezyApiKey();
  const storeId = getLemonSqueezyStoreId();
  const { productId, redirectUrl, email, name, organizationId, userId, seats } =
    params;

  const customData: Record<string, string> = {};
  if (organizationId) customData.organization_id = organizationId;
  if (userId) customData.user_id = userId;

  const response = await fetch(`${LEMONSQUEEZY_API_URL}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            redirect_url: redirectUrl,
            enabled_variants: [parseInt(productId, 10)],
          },
          checkout_data: {
            email,
            name,
            variant_quantities: [
              {
                variant_id: parseInt(productId, 10),
                quantity: seats ?? 1,
              },
            ],
            custom: customData,
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: productId,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`LemonSqueezy API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as {
    data: { attributes: { url: string } };
  };
  return result.data.attributes.url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async (
  params
) => {
  const apiKey = getLemonSqueezyApiKey();
  const { customerId } = params;

  const response = await fetch(
    `${LEMONSQUEEZY_API_URL}/customers/${customerId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.api+json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`LemonSqueezy API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as {
    data: { attributes: { urls: { customer_portal: string } } };
  };
  return result.data.attributes.urls.customer_portal ?? null;
};

export const webhookHandler: WebhookHandler = async (req) => {
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Missing LEMONSQUEEZY_WEBHOOK_SECRET", { status: 500 });
  }

  try {
    const text = await req.text();
    const hmac = createHmac("sha256", webhookSecret);
    const digest = Buffer.from(hmac.update(text).digest("hex"), "utf8");
    const signature = Buffer.from(
      req.headers.get("x-signature") as string,
      "utf8"
    );

    if (!timingSafeEqual(digest, signature)) {
      return new Response("Invalid signature", { status: 400 });
    }

    const payload = JSON.parse(text) as {
      meta: { event_name: string };
      data: Record<string, unknown>;
    };

    // Handle webhook events - implement your business logic here
    switch (payload.meta.event_name) {
      case "subscription_created":
      case "subscription_updated":
      case "subscription_cancelled":
      case "subscription_expired":
      case "order_created":
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
