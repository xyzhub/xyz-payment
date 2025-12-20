import type {
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  WebhookHandler,
} from "../types";

export const createCheckoutLink: CreateCheckoutLink = async (_params) => {
  // Implement your custom checkout link creation logic here
  throw new Error("Custom createCheckoutLink not implemented");
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async (
  _params
) => {
  // Implement your custom customer portal link creation logic here
  throw new Error("Custom createCustomerPortalLink not implemented");
};

export const webhookHandler: WebhookHandler = async (_req) => {
  // Implement your custom webhook handling logic here
  throw new Error("Custom webhookHandler not implemented");
};
