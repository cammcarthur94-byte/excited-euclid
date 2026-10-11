import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Page,
  Text,
} from "@shopify/polaris";
import { CheckCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getMerchantPlan } from "../billing.server";
import db from "../db.server";
import { CatalogHealthOverview } from "../components/dashboard/CatalogHealthOverview";
import type { CatalogHealthStats } from "../components/dashboard/CatalogHealthOverview";
import { MetricsGrid } from "../components/dashboard/MetricsGrid";
import { QuickActionsGrid } from "../components/dashboard/QuickActionsGrid";
import { ActionChecklistCard } from "../components/dashboard/ActionChecklistCard";
import { RecentJobsCard } from "../components/dashboard/RecentJobsCard";
import type { BulkJobSummary } from "../components/dashboard/RecentJobsCard";
import { RecentProductsCard } from "../components/dashboard/RecentProductsCard";
import type { DashboardProductItem } from "../components/dashboard/RecentProductsCard";

interface VariantNode {
  price: string;
  compareAtPrice: string | null;
}

interface RawProductNode {
  id: string;
  title: string;
  status: string;
  vendor: string;
  totalInventory: number | null;
  featuredImage: {
    url: string;
    altText: string | null;
  } | null;
  variants?: {
    edges: Array<{
      node: VariantNode;
    }>;
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const billingStatus = await getMerchantPlan(billing);

  // 1. Ensure merchant record exists in Prisma
  let merchant = await db.merchant.findUnique({
    where: { shop: session.shop },
    include: { settings: true },
  });

  if (!merchant) {
    merchant = await db.merchant.create({
      data: {
        shop: session.shop,
        settings: {
          create: {},
        },
      },
      include: { settings: true },
    });
  }

  // 2. Fetch recent jobs from SQLite
  const rawJobs = await db.bulkJob.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const recentJobs: BulkJobSummary[] = rawJobs.map((job) => ({
    id: job.id,
    action: job.action,
    status: job.status,
    productsAffected: job.productsAffected,
    details: job.details,
    createdAt: job.createdAt.toISOString(),
  }));

  // 3. Query catalog overview from Shopify Admin GraphQL
  let rawProducts: RawProductNode[] = [];
  let shopTitle = session.shop.replace(".myshopify.com", "");

  try {
    const response = await admin.graphql(
      `#graphql
        query getDashboardCatalog {
          shop {
            name
            myshopifyDomain
            currencyCode
          }
          products(first: 50, sortKey: UPDATED_AT, reverse: true) {
            edges {
              node {
                id
                title
                status
                vendor
                totalInventory
                featuredImage {
                  url
                  altText
                }
                variants(first: 5) {
                  edges {
                    node {
                      price
                      compareAtPrice
                    }
                  }
                }
              }
            }
          }
        }
      `,
    );

    const json = await response.json();
    const data = json.data;

    if (data?.shop?.name) {
      shopTitle = data.shop.name;
    }

    if (data?.products?.edges) {
      rawProducts = data.products.edges.map(
        (e: { node: RawProductNode }) => e.node,
      );
    }
  } catch (error) {
    console.error("Dashboard GraphQL query error:", error);
  }

  // 4. Compute catalog health statistics
  const totalProducts = rawProducts.length;
  let activeProducts = 0;
  let draftProducts = 0;
  let outOfStockProducts = 0;
  let missingImagesProducts = 0;
  let saleProducts = 0;

  for (const prod of rawProducts) {
    if (prod.status === "ACTIVE") activeProducts++;
    else if (prod.status === "DRAFT") draftProducts++;

    if (prod.totalInventory !== null && prod.totalInventory <= 0) {
      outOfStockProducts++;
    }

    if (!prod.featuredImage?.url) {
      missingImagesProducts++;
    }

    const hasSaleVariant = prod.variants?.edges?.some((v) => {
      const price = parseFloat(v.node.price || "0");
      const compareAt = parseFloat(v.node.compareAtPrice || "0");
      return compareAt > price;
    });

    if (hasSaleVariant) {
      saleProducts++;
    }
  }

  // Calculate composite health score (0 - 100)
  let score = 100;
  if (totalProducts > 0) {
    const outOfStockRatio = outOfStockProducts / totalProducts;
    const missingImagesRatio = missingImagesProducts / totalProducts;
    const draftRatio = draftProducts / totalProducts;

    const stockPenalty = Math.round(outOfStockRatio * 35);
    const imagePenalty = Math.round(missingImagesRatio * 30);
    const draftPenalty = Math.round(draftRatio * 15);

    score = Math.max(10, 100 - stockPenalty - imagePenalty - draftPenalty);
  }

  const catalogStats: CatalogHealthStats = {
    score,
    totalProducts,
    activeProducts,
    draftProducts,
    outOfStockProducts,
    missingImagesProducts,
    saleProducts,
  };

  const recentProducts: DashboardProductItem[] = rawProducts
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      vendor: p.vendor,
      totalInventory: p.totalInventory,
      featuredImage: p.featuredImage,
    }));

  return {
    shop: session.shop,
    shopTitle,
    merchantId: merchant.id,
    installedAt: merchant.createdAt.toISOString(),
    catalogStats,
    recentJobs,
    recentProducts,
    isSubscribed: billingStatus.hasActivePayment,
  };
};

export default function Dashboard() {
  const {
    shop,
    shopTitle,
    catalogStats,
    recentJobs,
    recentProducts,
    isSubscribed,
  } = useLoaderData<typeof loader>();

  const navigate = useNavigate();

  return (
    <Page
      title="Catalog Commander"
      subtitle="Manage products, inventory, pricing, and catalog operations from one place."
      primaryAction={{
        content: "Bulk Edit Products",
        onAction: () => navigate("/app/bulk-edit"),
      }}
      secondaryActions={[
        {
          content: "Import CSV",
          onAction: () => navigate("/app/csv-import"),
        },
        {
          content: "View Products",
          onAction: () => navigate("/app/products"),
        },
        {
          content: "Job History",
          onAction: () => navigate("/app/jobs"),
        },
      ]}
    >
      <BlockStack gap="500">
        {!isSubscribed && (
          <Banner
            title="Subscription Required ($9.99/month)"
            tone="warning"
            action={{
              content: "Subscribe Now ($9.99/mo)",
              onAction: () => navigate("/app/billing"),
            }}
          >
            <p>
              Catalog Commander is a paid app with flat-rate pricing of $9.99/month. Please activate your subscription to access all bulk editing, inventory balancing, and CSV syncing tools.
            </p>
          </Banner>
        )}

        {/* Store Connection Status Banner */}
        <Box
          background="bg-surface"
          padding="300"
          borderRadius="200"
          borderWidth="025"
          borderColor="border"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge tone="success" icon={CheckCircleIcon}>
                {`Store Connected: ${shopTitle}`}
              </Badge>
              <Badge tone="info">API 2025-01 Active</Badge>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Text as="span" variant="bodySm" tone="subdued">
                Store domain:
              </Text>
              <Text as="span" variant="bodySm" fontWeight="semibold">
                {shop}
              </Text>
            </div>
          </div>
        </Box>

        {/* 10-Second Health Scan: Top Overview & KPI Cards */}
        <CatalogHealthOverview
          stats={catalogStats}
          onOpenAudit={() => navigate("/app/products")}
          onBulkEdit={() => navigate("/app/bulk-edit")}
        />

        <MetricsGrid
          stats={catalogStats}
          onBrowseProducts={() => navigate("/app/products")}
          onFilterOutOfStock={() =>
            navigate("/app/products?inventory=OUT_OF_STOCK")
          }
          onBulkPriceEdit={() => navigate("/app/bulk-edit")}
          onFilterMissingImages={() => navigate("/app/products")}
        />

        {/* Quick Operations Launchpad */}
        <QuickActionsGrid
          onBulkPriceEdit={() => navigate("/app/bulk-edit")}
          onInventoryAdjust={() => navigate("/app/bulk-edit")}
          onCsvImport={() => navigate("/app/csv-import")}
          onBrowseProducts={() => navigate("/app/products")}
        />

        {/* Action Items Checklist */}
        <ActionChecklistCard
          stats={catalogStats}
          onFilterOutOfStock={() =>
            navigate("/app/products?inventory=OUT_OF_STOCK")
          }
          onFilterDrafts={() =>
            navigate("/app/products?status=DRAFT")
          }
          onFilterMissingImages={() => navigate("/app/products")}
          onBulkEdit={() => navigate("/app/bulk-edit")}
        />

        {/* Recent Jobs History & Catalog Snapshot */}
        <RecentJobsCard
          jobs={recentJobs}
          onViewAllJobs={() => navigate("/app/jobs")}
          onNewJob={() => navigate("/app/bulk-edit")}
        />

        <RecentProductsCard
          products={recentProducts}
          onViewAllProducts={() => navigate("/app/products")}
          onSelectProduct={() => navigate("/app/products")}
        />
      </BlockStack>
    </Page>
  );
}
