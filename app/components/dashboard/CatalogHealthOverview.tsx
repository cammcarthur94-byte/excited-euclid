import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineGrid,
  ProgressBar,
  Text,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  ProductIcon,
} from "@shopify/polaris-icons";

export interface CatalogHealthStats {
  score: number;
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  outOfStockProducts: number;
  missingImagesProducts: number;
  saleProducts: number;
}

interface CatalogHealthOverviewProps {
  stats: CatalogHealthStats;
  onOpenAudit: () => void;
  onBulkEdit: () => void;
}

export function CatalogHealthOverview({
  stats,
  onOpenAudit,
}: CatalogHealthOverviewProps) {
  const getScoreTone = (score: number): "success" | "attention" | "critical" => {
    if (score >= 90) return "success";
    if (score >= 70) return "attention";
    return "critical";
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return "Optimal Health";
    if (score >= 70) return "Needs Review";
    return "Action Required";
  };

  const scoreTone = getScoreTone(stats.score);
  const totalIssues = stats.outOfStockProducts + stats.missingImagesProducts;

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Box
              background="bg-surface-secondary"
              borderRadius="200"
              padding="200"
            >
              <Icon source={ProductIcon} tone="base" />
            </Box>
            <BlockStack gap="050">
              <Text as="h2" variant="headingMd">
                Catalog Health Score
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Real-time assessment of stock availability, media integrity, and catalog readiness.
              </Text>
            </BlockStack>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Badge tone={scoreTone}>{getScoreLabel(stats.score)}</Badge>
            <Button size="medium" onClick={onOpenAudit}>
              Review Issues
            </Button>
          </div>
        </div>

        {/* Progress Bar Container */}
        <Box
          padding="400"
          background="bg-surface-secondary"
          borderRadius="200"
        >
          <BlockStack gap="200">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <Text as="span" variant="heading2xl" fontWeight="bold">
                  {stats.score}%
                </Text>
                <Text as="span" variant="bodyMd" tone="subdued" fontWeight="medium">
                  catalog readiness
                </Text>
              </div>
              <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                {totalIssues === 0
                  ? "All products meet publishing standards"
                  : `${totalIssues} issue${totalIssues === 1 ? "" : "s"} flagged for review`}
              </Text>
            </div>

            <ProgressBar
              progress={stats.score}
              tone={
                scoreTone === "critical"
                  ? "critical"
                  : scoreTone === "success"
                  ? "success"
                  : "primary"
              }
              size="small"
            />
          </BlockStack>
        </Box>

        {/* 4 Health Category Metric Tiles */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
          {/* Stock Health */}
          <div style={{ height: "100%", display: "flex" }}>
            <Box
              background="bg-surface-secondary"
              borderRadius="200"
              padding="300"
              width="100%"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: "105px",
                }}
              >
                <BlockStack gap="150">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon
                      source={stats.outOfStockProducts === 0 ? CheckCircleIcon : AlertCircleIcon}
                      tone={stats.outOfStockProducts === 0 ? "success" : "warning"}
                    />
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Stock Health
                    </Text>
                  </div>
                  <Text as="p" variant="headingSm" fontWeight="bold">
                    {stats.outOfStockProducts === 0
                      ? "100% In Stock"
                      : `${stats.outOfStockProducts} Out of Stock`}
                  </Text>
                  <div style={{ minHeight: "32px" }}>
                    <Text as="p" variant="bodyXs" tone="subdued">
                      {stats.outOfStockProducts === 0
                        ? "Zero out-of-stock items"
                        : "Items need stock replenishment"}
                    </Text>
                  </div>
                </BlockStack>
              </div>
            </Box>
          </div>

          {/* Media Completeness */}
          <div style={{ height: "100%", display: "flex" }}>
            <Box
              background="bg-surface-secondary"
              borderRadius="200"
              padding="300"
              width="100%"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: "105px",
                }}
              >
                <BlockStack gap="150">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon
                      source={stats.missingImagesProducts === 0 ? CheckCircleIcon : AlertCircleIcon}
                      tone={stats.missingImagesProducts === 0 ? "success" : "warning"}
                    />
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Media Completeness
                    </Text>
                  </div>
                  <Text as="p" variant="headingSm" fontWeight="bold">
                    {stats.missingImagesProducts === 0
                      ? "100% Complete"
                      : `${stats.missingImagesProducts} Missing`}
                  </Text>
                  <div style={{ minHeight: "32px" }}>
                    <Text as="p" variant="bodyXs" tone="subdued">
                      {stats.missingImagesProducts === 0
                        ? "All listings have media"
                        : "Products lacking image files"}
                    </Text>
                  </div>
                </BlockStack>
              </div>
            </Box>
          </div>

          {/* Publishing Status */}
          <div style={{ height: "100%", display: "flex" }}>
            <Box
              background="bg-surface-secondary"
              borderRadius="200"
              padding="300"
              width="100%"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: "105px",
                }}
              >
                <BlockStack gap="150">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon source={CheckCircleIcon} tone="success" />
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Publishing Status
                    </Text>
                  </div>
                  <Text as="p" variant="headingSm" fontWeight="bold">
                    {stats.activeProducts} Active
                  </Text>
                  <div style={{ minHeight: "32px" }}>
                    <Text as="p" variant="bodyXs" tone="subdued">
                      {stats.draftProducts === 0
                        ? "0 drafts pending"
                        : `${stats.draftProducts} draft item${stats.draftProducts === 1 ? "" : "s"} saved`}
                    </Text>
                  </div>
                </BlockStack>
              </div>
            </Box>
          </div>

          {/* Promotions & Deals */}
          <div style={{ height: "100%", display: "flex" }}>
            <Box
              background="bg-surface-secondary"
              borderRadius="200"
              padding="300"
              width="100%"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: "105px",
                }}
              >
                <BlockStack gap="150">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon source={CheckCircleIcon} tone="success" />
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Promotions & Sales
                    </Text>
                  </div>
                  <Text as="p" variant="headingSm" fontWeight="bold">
                    {stats.saleProducts} On Sale
                  </Text>
                  <div style={{ minHeight: "32px" }}>
                    <Text as="p" variant="bodyXs" tone="subdued">
                      {stats.saleProducts === 0
                        ? "Standard store pricing"
                        : `${stats.saleProducts} compare-at discount${stats.saleProducts === 1 ? "" : "s"}`}
                    </Text>
                  </div>
                </BlockStack>
              </div>
            </Box>
          </div>
        </InlineGrid>
      </BlockStack>
    </Card>
  );
}
