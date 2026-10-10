import {
  Badge,
  BlockStack,
  Box,
  Button,
  Icon,
  InlineStack,
  Text,
} from "@shopify/polaris";
import type { IconSource } from "@shopify/polaris";

interface MetricCardProps {
  title: string;
  value: string | number;
  badgeText?: string;
  badgeTone?: "success" | "info" | "attention" | "warning" | "critical";
  description: string;
  icon: IconSource;
  actionLabel?: string;
  onAction?: () => void;
}

export function MetricCard({
  title,
  value,
  badgeText,
  badgeTone = "info",
  description,
  icon,
  actionLabel,
  onAction,
}: MetricCardProps) {
  return (
    <div style={{ height: "100%", display: "flex" }}>
      <Box
        background="bg-surface"
        borderRadius="200"
        padding="400"
        borderWidth="025"
        borderColor="border"
        width="100%"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            minHeight: "185px",
          }}
        >
          <BlockStack gap="200">
            {/* Header: Title & Icon */}
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="bodyMd" fontWeight="semibold">
                {title}
              </Text>
              <Box
                background="bg-surface-secondary"
                borderRadius="100"
                padding="100"
              >
                <Icon source={icon} tone="subdued" />
              </Box>
            </InlineStack>

            {/* Metric Value */}
            <Text as="p" variant="heading2xl" fontWeight="bold">
              {value}
            </Text>

            {/* Status Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                minHeight: "24px",
              }}
            >
              {badgeText && <Badge tone={badgeTone}>{badgeText}</Badge>}
            </div>

            {/* Supporting Description (normalized height across all cards) */}
            <div style={{ minHeight: "38px" }}>
              <Text as="p" variant="bodySm" tone="subdued">
                {description}
              </Text>
            </div>
          </BlockStack>

          {/* Bottom Action Link (pinned to bottom baseline) */}
          {actionLabel && onAction && (
            <div style={{ marginTop: "auto", paddingTop: "12px" }}>
              <Button variant="plain" onClick={onAction}>
                {actionLabel} →
              </Button>
            </div>
          )}
        </div>
      </Box>
    </div>
  );
}
