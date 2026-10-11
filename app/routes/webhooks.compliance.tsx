import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received compliance webhook: ${topic} for shop: ${shop}`);

  // Catalog Commander is a bulk catalog and inventory editor.
  // We do not store buyer personal identifiable information (PII).
  // All compliance topics (customers/data_request, customers/redact, shop/redact)
  // are received, verified via HMAC, and confirmed with 200 OK.
  return new Response(null, { status: 200 });
};
