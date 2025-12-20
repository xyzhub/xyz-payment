import type {
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  WebhookHandler,
} from "../types";

const TAP_API_URL = "https://api.tap.company/v2";

function getTapSecretKey(): string {
  const secretKey = process.env.TAP_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing env variable TAP_SECRET_KEY");
  }
  return secretKey;
}

// ============================================
// Tap-Specific Types for Subscription Support
// ============================================

/**
 * Result from a checkout with save_card enabled.
 * Store these IDs to charge the customer later for subscriptions.
 */
export type TapSavedCardResult = {
  customerId: string;
  cardId: string;
  paymentAgreementId: string;
};

/**
 * Parameters for charging a saved card (recurring payment).
 */
export type ChargeCardParams = {
  /** Customer ID from saved card */
  customerId: string;
  /** Card ID from saved card */
  cardId: string;
  /** Payment Agreement ID from saved card */
  paymentAgreementId: string;
  /** Amount to charge */
  amount: number;
  /** Currency code (e.g., "USD", "SAR", "KWD") */
  currency: string;
  /** Description of the charge */
  description?: string;
  /** Metadata for your records */
  metadata?: Record<string, string>;
};

/**
 * Parameters for creating a charge.
 */
export type CreateChargeParams = {
  /** Amount to charge */
  amount: number;
  /** Currency code */
  currency: string;
  /** Customer email */
  email?: string;
  /** Customer name */
  name?: string;
  /** Save card for future use */
  saveCard?: boolean;
  /** Redirect URL after payment */
  redirectUrl?: string;
  /** Description */
  description?: string;
  /** Metadata */
  metadata?: Record<string, string>;
};

// ============================================
// Core Provider Methods
// ============================================

export const createCheckoutLink: CreateCheckoutLink = async (params) => {
  const secretKey = getTapSecretKey();
  const {
    type,
    productId,
    redirectUrl,
    email,
    name,
    organizationId,
    userId,
    seats,
  } = params;

  const metadata: Record<string, string> = {};
  if (organizationId) metadata.organization_id = organizationId;
  if (userId) metadata.user_id = userId;
  metadata.product_id = productId;
  metadata.quantity = String(seats ?? 1);
  metadata.type = type;

  // Use Charges API for both subscription and one-time
  // For subscriptions, enable save_card to store payment method
  const response = await fetch(`${TAP_API_URL}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: 0, // Set your amount here based on pricing
      currency: "USD",
      save_card: type === "subscription", // Enable for subscriptions
      customer: {
        email,
        first_name: name?.split(" ")[0] ?? "",
        last_name: name?.split(" ").slice(1).join(" ") ?? "",
      },
      source: {
        id: "src_all", // Accept all payment methods
      },
      redirect: {
        url: redirectUrl ?? "",
      },
      post: {
        url: redirectUrl ?? "",
      },
      metadata,
      reference: {
        transaction: productId,
        order: `${type}_${Date.now()}`,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Tap API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as {
    transaction?: { url: string };
  };
  return result.transaction?.url ?? null;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async (
  _params
) => {
  // Tap doesn't have a built-in customer portal
  throw new Error(
    "Tap Payments does not have a built-in customer portal. Build your own billing management page using the subscription helpers."
  );
};

// ============================================
// Subscription Helpers (Tap-Specific)
// ============================================

/**
 * Create a charge with optional card saving.
 * Use this for initial subscription payments or one-time charges.
 *
 * @example
 * ```ts
 * import { createCharge } from "@xyz/payment/providers/tap";
 *
 * const result = await createCharge({
 *   amount: 29.99,
 *   currency: "USD",
 *   email: "user@example.com",
 *   saveCard: true, // Save for subscription
 *   redirectUrl: "https://example.com/success",
 * });
 * ```
 */
export async function createCharge(params: CreateChargeParams): Promise<{
  chargeId: string;
  url: string | null;
}> {
  const secretKey = getTapSecretKey();
  const { amount, currency, email, name, saveCard, redirectUrl, description, metadata } =
    params;

  const response = await fetch(`${TAP_API_URL}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      save_card: saveCard ?? false,
      customer: {
        email,
        first_name: name?.split(" ")[0] ?? "",
        last_name: name?.split(" ").slice(1).join(" ") ?? "",
      },
      source: {
        id: "src_all",
      },
      redirect: {
        url: redirectUrl ?? "",
      },
      post: {
        url: redirectUrl ?? "",
      },
      description,
      metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Tap Charge API error: ${JSON.stringify(error)}`);
  }

  const result = (await response.json()) as {
    id: string;
    transaction?: { url: string };
  };

  return {
    chargeId: result.id,
    url: result.transaction?.url ?? null,
  };
}

/**
 * Charge a saved card for recurring subscription payments.
 * Use this in a cron job or scheduler to bill customers periodically.
 *
 * @example
 * ```ts
 * import { chargeCard } from "@xyz/payment/providers/tap";
 *
 * // In your scheduled billing job:
 * await chargeCard({
 *   customerId: "cus_xxx",
 *   cardId: "card_xxx",
 *   paymentAgreementId: "pa_xxx",
 *   amount: 9.99,
 *   currency: "USD",
 *   description: "Monthly subscription",
 * });
 * ```
 */
export async function chargeCard(params: ChargeCardParams): Promise<{
  chargeId: string;
  status: string;
}> {
  const secretKey = getTapSecretKey();
  const {
    customerId,
    cardId,
    paymentAgreementId,
    amount,
    currency,
    description,
    metadata,
  } = params;

  // First, create a token from the saved card
  const tokenResponse = await fetch(`${TAP_API_URL}/tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      saved_card: {
        card_id: cardId,
        customer_id: customerId,
      },
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.json();
    throw new Error(`Tap Token API error: ${JSON.stringify(error)}`);
  }

  const tokenResult = (await tokenResponse.json()) as { id: string };

  // Create a merchant-initiated charge (no 3DS required)
  const chargeResponse = await fetch(`${TAP_API_URL}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      customer_initiated: false, // Merchant-initiated recurring charge
      source: {
        id: tokenResult.id,
      },
      customer: {
        id: customerId,
      },
      payment_agreement: {
        id: paymentAgreementId,
      },
      description: description ?? "Recurring payment",
      metadata,
    }),
  });

  if (!chargeResponse.ok) {
    const error = await chargeResponse.json();
    throw new Error(`Tap Charge API error: ${JSON.stringify(error)}`);
  }

  const chargeResult = (await chargeResponse.json()) as {
    id: string;
    status: string;
  };

  return {
    chargeId: chargeResult.id,
    status: chargeResult.status,
  };
}

/**
 * Parse webhook to extract saved card details for subscriptions.
 * Call this on CHARGE.CAPTURED when save_card was enabled.
 */
export function extractSavedCardFromWebhook(
  webhookData: Record<string, unknown>
): TapSavedCardResult | null {
  const card = webhookData.card as Record<string, unknown> | undefined;
  const customer = webhookData.customer as Record<string, unknown> | undefined;
  const paymentAgreement = webhookData.payment_agreement as
    | Record<string, unknown>
    | undefined;

  if (!card?.id || !customer?.id || !paymentAgreement?.id) {
    return null;
  }

  return {
    customerId: customer.id as string,
    cardId: card.id as string,
    paymentAgreementId: paymentAgreement.id as string,
  };
}

// ============================================
// Webhook Handler
// ============================================

import { WebhookVerifier } from "@xyz/webhook-verifier";
import { tap as tapConfig } from "@xyz/webhook-verifier/configs";

/**
 * Create a Tap webhook verifier instance.
 * Uses the predefined Tap configuration from @xyz/webhook-verifier.
 */
function getTapVerifier(): WebhookVerifier {
  const webhookSecret = process.env.TAP_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Missing TAP_WEBHOOK_SECRET");
  }
  return new WebhookVerifier({
    ...tapConfig,
    secretKey: webhookSecret,
  });
}

export const webhookHandler: WebhookHandler = async (req) => {
  if (!req.body) {
    return new Response("Invalid request", { status: 400 });
  }

  try {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    // Verify webhook signature using @xyz/webhook-verifier
    const verifier = getTapVerifier();
    const payload = JSON.parse(body);
    const result = verifier.verify(payload, headers);

    if (!result.isValid) {
      return new Response(`Invalid signature: ${result.error}`, { status: 401 });
    }

    const event = result.data as {
      event: string;
      data: Record<string, unknown>;
    };

    // Handle webhook events
    // For subscriptions, listen for CHARGE.CAPTURED to get saved card details
    switch (event.event) {
      case "CHARGE.CAPTURED": {
        // Extract saved card details if save_card was enabled
        const savedCard = extractSavedCardFromWebhook(event.data);
        if (savedCard) {
          // Store these in your database for future recurring charges:
          // savedCard.customerId, savedCard.cardId, savedCard.paymentAgreementId
        }
        break;
      }
      case "CHARGE.FAILED":
        // Handle failed charges - implement retry logic or notify customer
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

