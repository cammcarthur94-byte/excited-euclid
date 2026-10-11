import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { PLAN_FREE, PLAN_MONTHLY, PLAN_PRO } from "./billing-plans";

export { PLAN_FREE, PLAN_MONTHLY, PLAN_PRO };

const rawAppUrl =
  process.env.SHOPIFY_APP_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : "") ||
  "https://catalog-commander.onrender.com";

// Ensure appUrl has https:// protocol
const appUrl = rawAppUrl.startsWith("http://") || rawAppUrl.startsWith("https://")
  ? rawAppUrl
  : `https://${rawAppUrl}`;

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "b0daba369e048eda0508646744da6d6f",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: (process.env.SCOPES || "write_products,read_products,write_inventory,read_inventory,read_locations,write_publications,read_publications").split(","),
  appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new MemorySessionStorage(),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true,
  },
  billing: {
    [PLAN_MONTHLY]: {
      lineItems: [
        {
          amount: 9.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
