import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function Index() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Catalog Commander</h1>
        <p className={styles.text}>
          Bulk Catalog Editor, Pricing Manager, and Multi-Location Inventory Balancer for Shopify.
        </p>

        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            borderRadius: "8px",
            background: "rgba(0, 128, 96, 0.08)",
            border: "1px solid rgba(0, 128, 96, 0.2)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.95rem", color: "#004c3f" }}>
            To install or open Catalog Commander, please add the app directly from the{" "}
            <strong>Shopify App Store</strong> or launch it from your{" "}
            <strong>Shopify Admin</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
