import { InlineGrid } from "@shopify/polaris";
import {
  ProductIcon,
  InventoryIcon,
  MoneyIcon,
  AlertCircleIcon,
} from "@shopify/polaris-icons";
import { MetricCard } from "./MetricCard";
import type { CatalogHealthStats } from "./CatalogHealthOverview";

interface MetricsGridProps {
  stats: CatalogHealthStats;
  onBrowseProducts: () => void;
  onFilterOutOfStock: () => void;
  onBulkPriceEdit: () => void;
  onFilterMissingImages: () => void;
}

export function MetricsGrid({
  stats,
  onBrowseProducts,
  onFilterOutOfStock,
  onBulkPriceEdit,
  onFilterMissingImages,
}: MetricsGridProps) {
  const inStockPercentage =
    stats.totalProducts > 0
      ? Math.round(
          ((stats.totalProducts - stats.outOfStockProducts) /
            stats.totalProducts) *
            100,
        )
      : 100;

  return (
    <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
      <MetricCard
        title="Total Products"
        value={stats.totalProducts}
        badgeText={`${stats.activeProducts} Active`}
        badgeTone="success"
        description={
          stats.draftProducts > 0
            ? `${stats.draftProducts} draft item${stats.draftProducts === 1 ? "" : "s"} pending`
            : "All catalog items published"
        }
        icon={ProductIcon}
        actionLabel="View products"
        onAction={onBrowseProducts}
      />

      <MetricCard
        title="Stock Availability"
        value={`${inStockPercentage}%`}
        badgeText={
          stats.outOfStockProducts > 0
            ? `${stats.outOfStockProducts} Out of stock`
            : "Optimal Stock"
        }
        badgeTone={stats.outOfStockProducts > 0 ? "attention" : "success"}
        description={
          stats.outOfStockProducts > 0
            ? `${stats.outOfStockProducts} item${stats.outOfStockProducts === 1 ? "" : "s"} need restocking`
            : "All items have inventory in stock"
        }
        icon={InventoryIcon}
        actionLabel="Audit stock"
        onAction={onFilterOutOfStock}
      />

      <MetricCard
        title="Pricing & Deals"
        value={stats.saleProducts}
        badgeText={stats.saleProducts > 0 ? "Active Deals" : "Standard"}
        badgeTone={stats.saleProducts > 0 ? "info" : undefined}
        description={
          stats.saleProducts > 0
            ? `${stats.saleProducts} item${stats.saleProducts === 1 ? "" : "s"} with compare-at price`
            : "Standard prices without discounts"
        }
        icon={MoneyIcon}
        actionLabel="Edit pricing"
        onAction={onBulkPriceEdit}
      />

      <MetricCard
        title="Catalog Completeness"
        value={`${stats.score}%`}
        badgeText={
          stats.missingImagesProducts > 0
            ? `${stats.missingImagesProducts} Missing media`
            : "Complete"
        }
        badgeTone={stats.missingImagesProducts > 0 ? "warning" : "success"}
        description={
          stats.missingImagesProducts > 0
            ? `${stats.missingImagesProducts} item${stats.missingImagesProducts === 1 ? "" : "s"} missing imagery`
            : "All items have media attached"
        }
        icon={AlertCircleIcon}
        actionLabel="Review media"
        onAction={onFilterMissingImages}
      />
    </InlineGrid>
  );
}
