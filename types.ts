/**
 * Parameters for creating a checkout link.
 */
export type CreateCheckoutLinkParams = {
  /** Payment type: subscription or one-time */
  type: "subscription" | "one-time";
  /** Product or price ID */
  productId: string;
  /** Customer email */
  email?: string;
  /** Customer name */
  name?: string;
  /** Redirect URL after checkout */
  redirectUrl?: string;
  /** Existing customer ID */
  customerId?: string;
  /** Organization ID for metadata */
  organizationId?: string;
  /** User ID for metadata */
  userId?: string;
  /** Trial period in days (subscriptions only) */
  trialPeriodDays?: number;
  /** Number of seats/quantity */
  seats?: number;
};

/**
 * Parameters for creating a customer portal link.
 */
export type CreateCustomerPortalLinkParams = {
  /** Subscription ID (optional) */
  subscriptionId?: string;
  /** Customer ID */
  customerId: string;
  /** Redirect URL after portal */
  redirectUrl?: string;
};

/**
 * Parameters for setting subscription seats.
 */
export type SetSubscriptionSeatsParams = {
  /** Subscription ID */
  id: string;
  /** Number of seats */
  seats: number;
};

/**
 * Handler for creating a checkout link.
 */
export type CreateCheckoutLink = (
  params: CreateCheckoutLinkParams
) => Promise<string | null>;

/**
 * Handler for creating a customer portal link.
 */
export type CreateCustomerPortalLink = (
  params: CreateCustomerPortalLinkParams
) => Promise<string | null>;

/**
 * Handler for setting subscription seats.
 */
export type SetSubscriptionSeats = (
  params: SetSubscriptionSeatsParams
) => Promise<void>;

/**
 * Handler for canceling a subscription.
 */
export type CancelSubscription = (id: string) => Promise<void>;

/**
 * Handler for processing webhooks.
 */
export type WebhookHandler = (req: Request) => Promise<Response>;

/**
 * Payment provider interface.
 */
export interface PaymentProvider {
  createCheckoutLink: CreateCheckoutLink;
  createCustomerPortalLink: CreateCustomerPortalLink;
  webhookHandler: WebhookHandler;
}
