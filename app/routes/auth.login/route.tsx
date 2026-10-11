import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

/**
 * In compliance with Shopify App Store requirements (2.3.1),
 * app initiation occurs exclusively on Shopify-owned surfaces
 * (Shopify App Store or Shopify Admin).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (shop) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  throw redirect("/");
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (shop) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  throw redirect("/");
};

export default function AuthLogin() {
  return null;
}
