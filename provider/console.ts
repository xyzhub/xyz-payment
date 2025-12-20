import { logger } from "@xyz/logger";
import type {
  CreateCheckoutLink,
  CreateCustomerPortalLink,
  WebhookHandler,
} from "../types";

export const createCheckoutLink: CreateCheckoutLink = async (params) => {
  logger.info("Creating checkout link", params);
  return "https://example.com/checkout/mock-session-id";
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async (
  params
) => {
  logger.info("Creating customer portal link", params);
  return "https://example.com/portal/mock-session-id";
};

export const webhookHandler: WebhookHandler = async (req) => {
  logger.info("Received webhook", {
    method: req.method,
    url: req.url,
  });
  return new Response(null, { status: 200 });
};
