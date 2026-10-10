import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  Divider,
  InlineStack,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return json({
    shop: session.shop,
  });
};

export default function SettingsPage() {
  const { shop } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page
      title="Settings"
      subtitle="Manage your store catalog configuration and preferences."
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="400">
        {/* Store Connection Info */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                Store Connection
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Information about your connected Shopify store
              </Text>
            </BlockStack>

            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodyMd" tone="subdued">
                  Store Domain
                </Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {shop}
                </Text>
              </InlineStack>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodyMd" tone="subdued">
                  Connection Status
                </Text>
                <Badge tone="success">Active & Authenticated</Badge>
              </InlineStack>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodyMd" tone="subdued">
                  API Version
                </Text>
                <Badge tone="info">2025-01 Active</Badge>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Catalog Safeguards */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                Catalog Safeguards
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Built-in rules and protections applied during bulk updates
              </Text>
            </BlockStack>

            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    Negative Inventory Guard
                  </Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Stock levels cannot be reduced below 0 during bulk edits or CSV imports
                  </Text>
                </BlockStack>
                <Badge tone="success">Enforced</Badge>
              </InlineStack>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    Confirmation Modals
                  </Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Review preview tables and confirm before changes commit to your catalog
                  </Text>
                </BlockStack>
                <Badge tone="success">Active</Badge>
              </InlineStack>

              <Divider />

              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    Bulk Operation Audit Log
                  </Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Every bulk edit and CSV import records affected product count and status
                  </Text>
                </BlockStack>
                <Button variant="plain" onClick={() => navigate("/app/jobs")}>
                  View Job History →
                </Button>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Subscription & Billing */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                Subscription & Billing
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Manage your store subscription plan and billing details
              </Text>
            </BlockStack>

            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  Flat-Rate Plan ($9.99/mo)
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  Unlimited products, all bulk edit operations, and CSV import included
                </Text>
              </BlockStack>
              <Button variant="primary" onClick={() => navigate("/app/billing")}>
                Manage Subscription
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
