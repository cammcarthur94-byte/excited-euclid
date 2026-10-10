import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

function escapeCSV(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return "";
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");

  interface VariantExport {
    sku: string;
    price: string;
    compareAtPrice: string | null;
    inventoryQuantity: number | null;
  }

  interface ProductExport {
    id: string;
    title: string;
    handle: string;
    vendor: string;
    productType: string;
    tags: string[];
    variants: VariantExport[];
  }

  const exportedProducts: ProductExport[] = [];

  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((id) => decodeURIComponent(id.trim()))
      .filter(Boolean);

    if (ids.length > 0) {
      const chunkSize = 250;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const response = await admin.graphql(
          `#graphql
            query getProductsForExport($ids: [ID!]!) {
              nodes(ids: $ids) {
                ... on Product {
                  id
                  title
                  handle
                  vendor
                  productType
                  tags
                  variants(first: 50) {
                    edges {
                      node {
                        sku
                        price
                        compareAtPrice
                        inventoryQuantity
                      }
                    }
                  }
                }
              }
            }
          `,
          { variables: { ids: chunk } },
        );
        const json = await response.json();
        const nodes = json.data?.nodes || [];
        for (const node of nodes) {
          if (node && node.id) {
            exportedProducts.push({
              id: node.id,
              title: node.title || "",
              handle: node.handle || "",
              vendor: node.vendor || "",
              productType: node.productType || "",
              tags: node.tags || [],
              variants: (node.variants?.edges || []).map((e: any) => ({
                sku: e.node.sku || "",
                price: e.node.price || "0.00",
                compareAtPrice: e.node.compareAtPrice || null,
                inventoryQuantity: e.node.inventoryQuantity ?? 0,
              })),
            });
          }
        }
      }
    }
  } else {
    // Export full store catalog (paginate up to 250 products)
    let hasNext = true;
    let cursor: string | null = null;
    let pagesFetched = 0;

    while (hasNext && pagesFetched < 5) {
      pagesFetched++;
      const response = await admin.graphql(
        `#graphql
          query getAllProductsForExport($cursor: String) {
            products(first: 100, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  title
                  handle
                  vendor
                  productType
                  tags
                  variants(first: 50) {
                    edges {
                      node {
                        sku
                        price
                        compareAtPrice
                        inventoryQuantity
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        { variables: { cursor } },
      );
      const json = await response.json();
      const pageData = json.data?.products;
      const edges = pageData?.edges || [];

      for (const edge of edges) {
        const node = edge.node;
        exportedProducts.push({
          id: node.id,
          title: node.title || "",
          handle: node.handle || "",
          vendor: node.vendor || "",
          productType: node.productType || "",
          tags: node.tags || [],
          variants: (node.variants?.edges || []).map((e: any) => ({
            sku: e.node.sku || "",
            price: e.node.price || "0.00",
            compareAtPrice: e.node.compareAtPrice || null,
            inventoryQuantity: e.node.inventoryQuantity ?? 0,
          })),
        });
      }

      hasNext = pageData?.pageInfo?.hasNextPage || false;
      cursor = pageData?.pageInfo?.endCursor || null;
    }
  }

  // Build CSV rows
  const csvLines: string[] = [
    "Handle,Title,SKU,Price,Compare At Price,Inventory,Tags,Vendor,Product Type",
  ];

  for (const product of exportedProducts) {
    const tagsString = product.tags.join(", ");
    if (product.variants.length === 0) {
      csvLines.push(
        [
          escapeCSV(product.handle),
          escapeCSV(product.title),
          "",
          "0.00",
          "",
          "0",
          escapeCSV(tagsString),
          escapeCSV(product.vendor),
          escapeCSV(product.productType),
        ].join(","),
      );
    } else {
      for (const variant of product.variants) {
        csvLines.push(
          [
            escapeCSV(product.handle),
            escapeCSV(product.title),
            escapeCSV(variant.sku),
            escapeCSV(variant.price),
            escapeCSV(variant.compareAtPrice),
            escapeCSV(variant.inventoryQuantity),
            escapeCSV(tagsString),
            escapeCSV(product.vendor),
            escapeCSV(product.productType),
          ].join(","),
        );
      }
    }
  }

  // Record BulkJob audit log
  try {
    await db.bulkJob.create({
      data: {
        shop: session.shop,
        action: "CSV Export: Products Catalog",
        status: "COMPLETED",
        productsAffected: exportedProducts.length,
        details: `Exported ${exportedProducts.length} products (${csvLines.length - 1} rows) to CSV`,
      },
    });
  } catch (logErr) {
    console.warn("[ExportCsv] Could not log audit bulkJob:", logErr);
  }

  const today = new Date().toISOString().slice(0, 10);
  return new Response(csvLines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="catalog_export_${today}.csv"`,
    },
  });
};
