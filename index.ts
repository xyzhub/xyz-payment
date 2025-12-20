import type {
  PaymentProvider,
  CreateCheckoutLinkParams,
  CreateCustomerPortalLinkParams,
  SetSubscriptionSeatsParams,
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  SetSubscriptionSeats,
  CancelSubscription,
  WebhookHandler,
} from "./types";

// Provider implementations
import * as stripeProvider from "./provider/stripe";
import * as lemonsqueezyProvider from "./provider/lemonsqueezy";
import * as polarProvider from "./provider/polar";
import * as creemProvider from "./provider/creem";
import * as dodopaymentsProvider from "./provider/dodopayments";
import * as tapProvider from "./provider/tap";
import * as consoleProvider from "./provider/console";
import * as customProvider from "./provider/custom";

/**
 * Available payment providers.
 */
export type PaymentProviderName =
  | "stripe"
  | "lemonsqueezy"
  | "polar"
  | "creem"
  | "dodopayments"
  | "tap"
  | "console"
  | "custom";

const providers: Record<PaymentProviderName, PaymentProvider> = {
  stripe: stripeProvider,
  lemonsqueezy: lemonsqueezyProvider,
  polar: polarProvider,
  creem: creemProvider,
  dodopayments: dodopaymentsProvider,
  tap: tapProvider,
  console: consoleProvider,
  custom: customProvider,
};

/**
 * Factory function to get a payment provider.
 *
 * @example
 * ```ts
 * import { usePayment } from "@xyz/payment";
 *
 * const checkoutUrl = await usePayment("stripe").createCheckoutLink({
 *   type: "subscription",
 *   productId: "price_xxx",
 *   email: "user@example.com",
 *   redirectUrl: "https://example.com/success",
 * });
 * ```
 */
export function usePayment(provider: PaymentProviderName): PaymentProvider {
  const paymentProvider = providers[provider];
  if (!paymentProvider) {
    throw new Error(`Unknown payment provider: ${provider}`);
  }
  return paymentProvider;
}

// Re-export types
export type {
  PaymentProvider,
  CreateCheckoutLinkParams,
  CreateCustomerPortalLinkParams,
  SetSubscriptionSeatsParams,
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  SetSubscriptionSeats,
  CancelSubscription,
  WebhookHandler,
};

// Re-export individual providers for direct access
export * as stripe from "./provider/stripe";
export * as lemonsqueezy from "./provider/lemonsqueezy";
export * as polar from "./provider/polar";
export * as creem from "./provider/creem";
export * as dodopayments from "./provider/dodopayments";
export * as tap from "./provider/tap";
export * as console from "./provider/console";
export * as custom from "./provider/custom";
