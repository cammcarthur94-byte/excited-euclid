import { useState } from "react";
import { useNavigate } from "@remix-run/react";
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
  ArrowRightIcon,
  DiscountIcon,
  ImageIcon,
  InventoryIcon,
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
  onBulkEdit,
}: CatalogHealthOverviewProps) {
  const navigate = useNavigate();
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
          <HealthMetricTile
            icon={InventoryIcon}
            iconTone={stats.outOfStockProducts > 0 ? "critical" : "success"}
            iconBg={
              stats.outOfStockProducts > 0
                ? "#FDF1F1"
                : "#EDF7ED"
            }
            title="Stock Health"
            badgeText={
              stats.outOfStockProducts === 0
                ? "Healthy"
                : `${stats.outOfStockProducts} Out`
            }
            badgeTone={stats.outOfStockProducts === 0 ? "success" : "critical"}
            primaryValue={
              stats.outOfStockProducts === 0
                ? "100% In Stock"
                : `${stats.outOfStockProducts} Out of Stock`
            }
            valueTone={stats.outOfStockProducts > 0 ? "critical" : "base"}
            description={
              stats.outOfStockProducts === 0
                ? "Zero stockouts across catalog"
                : "Items need stock replenishment"
            }
            actionText={
              stats.outOfStockProducts > 0
                ? "Filter out of stock"
                : "View inventory"
            }
            onClick={() =>
              navigate(
                stats.outOfStockProducts > 0
                  ? "/app/products?inventory=OUT_OF_STOCK"
                  : "/app/products",
              )
            }
          />

          {/* Media Completeness */}
          <HealthMetricTile
            icon={ImageIcon}
            iconTone={stats.missingImagesProducts > 0 ? "warning" : "success"}
            iconBg={
              stats.missingImagesProducts > 0
                ? "#FFFBEB"
                : "#EDF7ED"
            }
            title="Media Completeness"
            badgeText={
              stats.missingImagesProducts === 0
                ? "Complete"
                : `${stats.missingImagesProducts} Missing`
            }
            badgeTone={
              stats.missingImagesProducts === 0 ? "success" : "attention"
            }
            primaryValue={
              stats.missingImagesProducts === 0
                ? "100% Complete"
                : `${stats.missingImagesProducts} Missing`
            }
            valueTone={stats.missingImagesProducts > 0 ? "warning" : "base"}
            description={
              stats.missingImagesProducts === 0
                ? "All listings have media files"
                : "Products lacking image files"
            }
            actionText={
              stats.missingImagesProducts > 0
                ? "Review missing images"
                : "View media"
            }
            onClick={() => navigate("/app/products")}
          />

          {/* Publishing Status */}
          <HealthMetricTile
            icon={ProductIcon}
            iconTone="info"
            iconBg="#EFF6FF"
            title="Publishing Status"
            badgeText={
              stats.draftProducts > 0
                ? `${stats.draftProducts} Draft${stats.draftProducts === 1 ? "" : "s"}`
                : "Live"
            }
            badgeTone={stats.draftProducts > 0 ? "attention" : "info"}
            primaryValue={`${stats.activeProducts} Active`}
            valueTone="base"
            description={
              stats.draftProducts === 0
                ? "0 drafts pending review"
                : `${stats.draftProducts} draft item${stats.draftProducts === 1 ? "" : "s"} saved`
            }
            actionText={
              stats.draftProducts > 0 ? "Review drafts" : "Browse catalog"
            }
            onClick={() =>
              navigate(
                stats.draftProducts > 0
                  ? "/app/products?status=DRAFT"
                  : "/app/products",
              )
            }
          />

          {/* Promotions & Sales */}
          <HealthMetricTile
            icon={DiscountIcon}
            iconTone="magic"
            iconBg="#F5F3FF"
            title="Promotions & Sales"
            badgeText={stats.saleProducts > 0 ? `${stats.saleProducts} Active` : "Regular"}
            badgeTone={stats.saleProducts > 0 ? "success" : "info"}
            primaryValue={`${stats.saleProducts} On Sale`}
            valueTone="base"
            description={
              stats.saleProducts === 0
                ? "Standard store pricing active"
                : `${stats.saleProducts} compare-at discount${stats.saleProducts === 1 ? "" : "s"} active`
            }
            actionText="Manage pricing"
            onClick={onBulkEdit || (() => navigate("/app/bulk-edit"))}
          />
        </InlineGrid>
      </BlockStack>
    </Card>
  );
}

interface HealthMetricTileProps {
  icon: any;
  iconTone?: "base" | "success" | "warning" | "critical" | "info" | "magic";
  iconBg: string;
  title: string;
  badgeText: string;
  badgeTone: "success" | "attention" | "critical" | "info";
  primaryValue: string;
  valueTone?: "critical" | "warning" | "success" | "base";
  description: string;
  actionText?: string;
  onClick: () => void;
}

function HealthMetricTile({
  icon,
  iconTone = "base",
  iconBg,
  title,
  badgeText,
  badgeTone,
  primaryValue,
  valueTone = "base",
  description,
  actionText = "View details",
  onClick,
}: HealthMetricTileProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${primaryValue}, ${description}`}
      style={{
        height: "100%",
        display: "flex",
        cursor: "pointer",
        outline: "none",
        transition: "transform 0.15s ease",
        transform: isHovered ? "translateY(-2px)" : "none",
      }}
    >
      <Box
        background="bg-surface"
        borderRadius="300"
        borderWidth="025"
        borderColor={
          isHovered
            ? "border-hover"
            : badgeTone === "critical"
            ? "border-critical"
            : badgeTone === "attention"
            ? "border-caution"
            : "border"
        }
        padding="300"
        width="100%"
        shadow={isHovered ? "200" : "100"}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            minHeight: "135px",
            gap: "12px",
          }}
        >
          <BlockStack gap="150">
            {/* Header: Icon + Category on left, Status Badge on right */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    backgroundColor: iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon source={icon} tone={iconTone} />
                </div>
                <Text as="span" variant="bodySm" fontWeight="semibold">
                  {title}
                </Text>
              </div>
              <Badge tone={badgeTone} size="small">
                {badgeText}
              </Badge>
            </div>

            {/* Metric Value */}
            <div>
              <Text
                as="p"
                variant="headingMd"
                fontWeight="bold"
                tone={valueTone === "critical" ? "critical" : undefined}
              >
                {primaryValue}
              </Text>
            </div>

            {/* Subtitle / Description */}
            <div style={{ minHeight: "28px" }}>
              <Text as="p" variant="bodyXs" tone="subdued">
                {description}
              </Text>
            </div>
          </BlockStack>

          {/* Action Footer */}
          <div
            style={{
              paddingTop: "8px",
              borderTop: "1px solid var(--p-color-border-subdued, #e5e5e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text as="span" variant="bodyXs" fontWeight="medium">
              <span
                style={{
                  color: isHovered
                    ? "var(--p-color-text-brand, #005bd3)"
                    : "var(--p-color-text-secondary, #616161)",
                  transition: "color 0.15s ease",
                }}
              >
                {actionText}
              </span>
            </Text>
            <div
              style={{
                transform: isHovered ? "translateX(2px)" : "none",
                transition: "transform 0.15s ease",
              }}
            >
              <Icon
                source={ArrowRightIcon}
                tone={isHovered ? "primary" : "subdued"}
              />
            </div>
          </div>
        </div>
      </Box>
    </div>
  );
}
