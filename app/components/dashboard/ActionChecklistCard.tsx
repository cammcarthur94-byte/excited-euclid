import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  Icon,
  InlineStack,
  Text,
} from "@shopify/polaris";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ImageIcon,
  ProductIcon,
} from "@shopify/polaris-icons";
import type { CatalogHealthStats } from "./CatalogHealthOverview";

interface ActionChecklistCardProps {
  stats: CatalogHealthStats;
  onFilterOutOfStock: () => void;
  onFilterDrafts: () => void;
  onFilterMissingImages: () => void;
  onBulkEdit: () => void;
}

export function ActionChecklistCard({
  stats,
  onFilterOutOfStock,
  onFilterDrafts,
  onFilterMissingImages,
  onBulkEdit,
}: ActionChecklistCardProps) {
  const items = [
    {
      id: "out-of-stock",
      title: "Out-of-stock products",
      description:
        stats.outOfStockProducts > 0
          ? `${stats.outOfStockProducts} product${stats.outOfStockProducts === 1 ? "" : "s"} have 0 total available inventory and may be unavailable for checkout.`
          : "All active products have positive inventory balances across locations.",
      status: stats.outOfStockProducts > 0 ? "attention" : "success",
      badgeText:
        stats.outOfStockProducts > 0
          ? `${stats.outOfStockProducts} Out of Stock`
          : "Healthy",
      badgeTone:
        stats.outOfStockProducts > 0
          ? ("attention" as const)
          : ("success" as const),
      icon: stats.outOfStockProducts > 0 ? AlertCircleIcon : CheckCircleIcon,
      actionText: stats.outOfStockProducts > 0 ? "Review Stock" : undefined,
      onAction: onFilterOutOfStock,
    },
    {
      id: "missing-images",
      title: "Missing product media",
      description:
        stats.missingImagesProducts > 0
          ? `${stats.missingImagesProducts} product${stats.missingImagesProducts === 1 ? "" : "s"} lack featured images, which hurts customer conversion.`
          : "All catalog items have featured images assigned.",
      status: stats.missingImagesProducts > 0 ? "attention" : "success",
      badgeText:
        stats.missingImagesProducts > 0
          ? `${stats.missingImagesProducts} Missing Media`
          : "Complete",
      badgeTone:
        stats.missingImagesProducts > 0
          ? ("attention" as const)
          : ("success" as const),
      icon: stats.missingImagesProducts > 0 ? ImageIcon : CheckCircleIcon,
      actionText:
        stats.missingImagesProducts > 0 ? "Inspect Images" : undefined,
      onAction: onFilterMissingImages,
    },
    {
      id: "draft-products",
      title: "Unpublished draft products",
      description:
        stats.draftProducts > 0
          ? `${stats.draftProducts} product${stats.draftProducts === 1 ? "" : "s"} are saved in draft status and not visible on the online store.`
          : "No drafts pending publication.",
      status: stats.draftProducts > 0 ? "info" : "success",
      badgeText: `${stats.draftProducts} In Draft`,
      badgeTone:
        stats.draftProducts > 0 ? ("info" as const) : ("success" as const),
      icon: stats.draftProducts > 0 ? ProductIcon : CheckCircleIcon,
      actionText: stats.draftProducts > 0 ? "Review Drafts" : undefined,
      onAction: onFilterDrafts,
    },
    {
      id: "price-audits",
      title: "Pricing & margin rules",
      description:
        stats.saleProducts > 0
          ? `${stats.saleProducts} product${stats.saleProducts === 1 ? "" : "s"} have active compare-at discounts configured.`
          : "Standard catalog pricing applied across all active variants.",
      status: "success",
      badgeText:
        stats.saleProducts > 0
          ? `${stats.saleProducts} On Sale`
          : "Verified",
      badgeTone: "success" as const,
      icon: CheckCircleIcon,
      actionText: "Bulk Edit Prices",
      onAction: onBulkEdit,
    },
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="050">
            <Text as="h2" variant="headingMd">
              Catalog Triage & Attention Items
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Automated audit flags to keep your store catalog clean, accurate, and ready for sales.
            </Text>
          </BlockStack>
        </InlineStack>

        <BlockStack gap="300">
          {items.map((item, index) => (
            <Box key={item.id}>
              {index > 0 && (
                <Box paddingBlockEnd="300">
                  <Divider />
                </Box>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    flex: "1 1 320px",
                  }}
                >
                  <div style={{ marginTop: "2px", flexShrink: 0 }}>
                    <Icon
                      source={item.icon}
                      tone={
                        item.status === "attention"
                          ? "warning"
                          : item.status === "success"
                          ? "success"
                          : "subdued"
                      }
                    />
                  </div>
                  <BlockStack gap="050">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        {item.title}
                      </Text>
                      <Badge tone={item.badgeTone}>{item.badgeText}</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {item.description}
                    </Text>
                  </BlockStack>
                </div>

                {item.actionText && (
                  <div style={{ flexShrink: 0 }}>
                    <Button onClick={item.onAction}>{item.actionText}</Button>
                  </div>
                )}
              </div>
            </Box>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
