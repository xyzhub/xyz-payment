# @xyz/payment

A unified library to process payments - Choose your own payment provider.

## Features

- 🔌 Unified interface for multiple payment providers
- 📝 TypeScript support with full type definitions
- 🔄 Easy to switch between providers without changing your code
- 🚀 Works with Node.js, Bun, Deno, and Cloudflare Workers

## Supported Providers

| Provider | Environment Variables |
|----------|----------------------|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| LemonSqueezy | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` |
| Polar | `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET` |
| Creem | `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET` |
| DodoPayments | `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET` |
| Tap | `TAP_SECRET_KEY`, `TAP_WEBHOOK_SECRET` |
| Console | (none - logs to console) |
| Custom | (implement your own) |

## Installation

```bash
# npm
npm install @xyz/payment

# pnpm
pnpm add @xyz/payment

# yarn
yarn add @xyz/payment

# bun
bun add @xyz/payment
```

## Usage

### Creating a Checkout Link

```typescript
import { usePayment } from "@xyz/payment";

const checkoutUrl = await usePayment("stripe").createCheckoutLink({
  type: "subscription",
  productId: "price_xxx",
  email: "user@example.com",
  redirectUrl: "https://example.com/success",
  organizationId: "org_xxx", // optional metadata
});

// Redirect user to checkoutUrl
```

### Creating a Customer Portal Link

```typescript
const portalUrl = await usePayment("stripe").createCustomerPortalLink({
  customerId: "cus_xxx",
  redirectUrl: "https://example.com/account",
});
```

### Handling Webhooks

```typescript
import { usePayment } from "@xyz/payment";

export async function POST(req: Request) {
  return usePayment("stripe").webhookHandler(req);
}
```

### Switching Providers

```typescript
const stripe = usePayment("stripe");
const lemonsqueezy = usePayment("lemonsqueezy");
const polar = usePayment("polar");
const creem = usePayment("creem");
const dodopayments = usePayment("dodopayments");
const tap = usePayment("tap");
const consoleLogger = usePayment("console"); // For development
```

## API Reference

### `usePayment(provider: PaymentProviderName)`

Creates a payment service instance for the specified provider.

**Parameters:**
- `provider`: One of `"stripe"` | `"lemonsqueezy"` | `"polar"` | `"creem"` | `"dodopayments"` | `"tap"` | `"console"` | `"custom"`

**Returns:**
- A payment service instance with `createCheckoutLink`, `createCustomerPortalLink`, and `webhookHandler` methods

### `createCheckoutLink(params: CreateCheckoutLinkParams)`

Creates a checkout link for the customer.

**Parameters:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"subscription" \| "one-time"` | ✅ | Payment type |
| `productId` | `string` | ✅ | Product or price ID |
| `email` | `string` | ❌ | Customer email |
| `name` | `string` | ❌ | Customer name |
| `redirectUrl` | `string` | ❌ | Redirect URL after checkout |
| `customerId` | `string` | ❌ | Existing customer ID |
| `organizationId` | `string` | ❌ | Organization ID for metadata |
| `userId` | `string` | ❌ | User ID for metadata |
| `trialPeriodDays` | `number` | ❌ | Trial period (subscriptions) |
| `seats` | `number` | ❌ | Number of seats/quantity |

**Returns:**
- `Promise<string | null>` - Checkout URL

### `createCustomerPortalLink(params: CreateCustomerPortalLinkParams)`

Creates a customer portal link for billing management.

**Parameters:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `customerId` | `string` | ✅ | Customer ID |
| `subscriptionId` | `string` | ❌ | Subscription ID |
| `redirectUrl` | `string` | ❌ | Redirect URL after portal |

**Returns:**
- `Promise<string | null>` - Portal URL

### `webhookHandler(req: Request)`

Handles incoming webhooks from the payment provider.

**Parameters:**
- `req`: Standard `Request` object

**Returns:**
- `Promise<Response>` - Response to send back

## Webhook Business Logic

The webhook handlers in this package verify signatures and parse events, but **you need to implement your own business logic**. Common patterns include:

```typescript
// Example: Extending the webhook handler
import { stripe } from "@xyz/payment";

export async function POST(req: Request) {
  // You can implement custom logic before/after
  const response = await stripe.webhookHandler(req);
  
  // Or create your own handler using the provider's methods
  return response;
}
```

## Tap Payments Subscriptions

Tap Payments doesn't have native subscription support, but the package provides helpers using their **save card** feature to implement subscription billing.

### How it works:

1. **Initial Checkout** - Use `createCheckoutLink({ type: "subscription" })` which enables `save_card`
2. **Webhook** - On `CHARGE.CAPTURED`, extract and store the saved card details
3. **Recurring Billing** - Use `chargeCard()` in a cron job to bill customers

### Step 1: Create Subscription Checkout

```typescript
const url = await usePayment("tap").createCheckoutLink({
  type: "subscription", // This enables save_card
  productId: "pro_plan",
  email: "user@example.com",
  redirectUrl: "https://example.com/success",
});
```

### Step 2: Handle Webhook & Store Card Details

```typescript
import { tap } from "@xyz/payment";

export async function POST(req: Request) {
  const body = await req.clone().text();
  const event = JSON.parse(body);

  if (event.event === "CHARGE.CAPTURED") {
    const savedCard = tap.extractSavedCardFromWebhook(event.data);
    
    if (savedCard) {
      // Store in your database:
      await db.subscription.create({
        customerId: savedCard.customerId,
        cardId: savedCard.cardId,
        paymentAgreementId: savedCard.paymentAgreementId,
      });
    }
  }

  return tap.webhookHandler(req);
}
```

### Step 3: Charge Card on Billing Cycle

```typescript
import { chargeCard } from "@xyz/payment/providers/tap";

// In your cron job (e.g., daily at midnight):
const subscriptions = await db.subscription.findDue();

for (const sub of subscriptions) {
  const result = await chargeCard({
    customerId: sub.customerId,
    cardId: sub.cardId,
    paymentAgreementId: sub.paymentAgreementId,
    amount: 29.99,
    currency: "USD",
    description: "Monthly Pro Plan",
  });
  
  console.log(`Charged ${result.chargeId}: ${result.status}`);
}
```

### Direct Charge Helper

For more control, use the `createCharge` helper:

```typescript
import { createCharge } from "@xyz/payment/providers/tap";

const result = await createCharge({
  amount: 29.99,
  currency: "USD",
  email: "user@example.com",
  saveCard: true, // Save for future subscriptions
  redirectUrl: "https://example.com/success",
  description: "Pro Plan",
});

// Redirect user to result.url
```

## TypeScript Support

This package is written in TypeScript and provides type definitions out of the box.

```typescript
import {
  usePayment,
  type CreateCheckoutLinkParams,
  type PaymentProviderName,
} from "@xyz/payment";

const provider: PaymentProviderName = "stripe";
const params: CreateCheckoutLinkParams = {
  type: "subscription",
  productId: "price_xxx",
  email: "user@example.com",
};

const url = await usePayment(provider).createCheckoutLink(params);
```

## License

MIT
