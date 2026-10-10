import {
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineGrid,
  InlineStack,
  Text,
} from "@shopify/polaris";
import {
  EditIcon,
  InventoryIcon,
  ImportIcon,
  SearchIcon,
} from "@shopify/polaris-icons";
import type { IconSource } from "@shopify/polaris";

interface QuickActionItem {
  title: string;
  description: string;
  buttonText: string;
  icon: IconSource;
  onClick: () => void;
}

interface QuickActionsGridProps {
  onBulkPriceEdit: () => void;
  onInventoryAdjust: () => void;
  onCsvImport: () => void;
  onBrowseProducts: () => void;
}

export function QuickActionsGrid({
  onBulkPriceEdit,
  onInventoryAdjust,
  onCsvImport,
  onBrowseProducts,
}: QuickActionsGridProps) {
  const actions: QuickActionItem[] = [
    {
      title: "Bulk Price Editor",
      description:
        "Update prices, profit margins, and compare-at discounts across products.",
      buttonText: "Edit Prices",
      icon: EditIcon,
      onClick: onBulkPriceEdit,
    },
    {
      title: "Inventory Balances",
      description:
        "Audit stock levels and adjust available inventory counts across locations.",
      buttonText: "Adjust Stock",
      icon: InventoryIcon,
      onClick: onInventoryAdjust,
    },
    {
      title: "Spreadsheet Import",
      description:
        "Import CSV spreadsheets to execute batch product catalog updates.",
      buttonText: "Import CSV",
      icon: ImportIcon,
      onClick: onCsvImport,
    },
    {
      title: "Catalog Inspector",
      description:
        "Filter and inspect products by inventory level, status, or keyword.",
      buttonText: "Browse Products",
      icon: SearchIcon,
      onClick: onBrowseProducts,
    },
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="050">
            <Text as="h2" variant="headingMd">
              Catalog Operations Launchpad
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Direct access to bulk workflows, inventory management, and catalog tools.
            </Text>
          </BlockStack>
        </InlineStack>

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
          {actions.map((action) => (
            <div
              key={action.title}
              style={{
                display: "flex",
                height: "100%",
              }}
            >
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
                    minHeight: "165px",
                  }}
                >
                  <BlockStack gap="200">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Box
                        background="bg-surface"
                        borderRadius="100"
                        padding="100"
                      >
                        <Icon source={action.icon} tone="base" />
                      </Box>
                      <Text as="h3" variant="headingSm">
                        {action.title}
                      </Text>
                    </div>

                    <div style={{ minHeight: "44px" }}>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {action.description}
                      </Text>
                    </div>
                  </BlockStack>

                  <div style={{ marginTop: "auto", paddingTop: "14px" }}>
                    <Button
                      fullWidth
                      variant="secondary"
                      onClick={action.onClick}
                    >
                      {action.buttonText}
                    </Button>
                  </div>
                </div>
              </Box>
            </div>
          ))}
        </InlineGrid>
      </BlockStack>
    </Card>
  );
}
