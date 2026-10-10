import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // Only allow manual dev login during local development testing
  const isDev = process.env.NODE_ENV !== "production";
  return { showDevForm: isDev && Boolean(login) };
};

export default function Index() {
  const { showDevForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Catalog Commander</h1>
        <p className={styles.text}>
          Bulk Catalog Editor, Pricing Manager, and Multi-Location Inventory Balancer for Shopify.
        </p>

        <div style={{ marginTop: "1.5rem", padding: "1rem", borderRadius: "8px", background: "rgba(0, 128, 96, 0.08)", border: "1px solid rgba(0, 128, 96, 0.2)" }}>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "#004c3f" }}>
            To install or open Catalog Commander, please add the app directly from the <strong>Shopify App Store</strong> or launch it from your <strong>Shopify Admin</strong>.
          </p>
        </div>

        {showDevForm && (
          <div style={{ marginTop: "2rem", borderTop: "1px solid #e1e3e5", paddingTop: "1rem" }}>
            <p style={{ fontSize: "0.85rem", color: "#6d7175" }}>Local Development Testing:</p>
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={styles.label}>
                <span>Shop domain</span>
                <input className={styles.input} type="text" name="shop" />
                <span>e.g: my-shop-domain.myshopify.com</span>
              </label>
              <button className={styles.button} type="submit">
                Dev Log in
              </button>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
