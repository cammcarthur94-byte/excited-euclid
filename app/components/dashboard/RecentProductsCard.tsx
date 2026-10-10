import {
  Badge,
  BlockStack,
  Button,
  Card,
  EmptySearchResult,
  IndexTable,
  InlineStack,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";

export interface DashboardProductItem {
  id: string;
  title: string;
  status: string;
  vendor: string;
  totalInventory: number | null;
  featuredImage: {
    url: string;
    altText: string | null;
  } | null;
}

interface RecentProductsCardProps {
  products: DashboardProductItem[];
  onViewAllProducts: () => void;
  onSelectProduct?: (productId: string) => void;
}

export function RecentProductsCard({
  products,
  onViewAllProducts,
  onSelectProduct,
}: RecentProductsCardProps) {
  const getStatusTone = (
    status: string,
  ): "success" | "info" | "attention" | undefined => {
    switch (status.toUpperCase()) {
      case "ACTIVE":
        return "success";
      case "DRAFT":
        return "info";
      case "ARCHIVED":
        return "attention";
      default:
        return undefined;
    }
  };

  const headings: [{ title: string }, ...{ title: string }[]] = [
    { title: "" },
    { title: "Product" },
    { title: "Status" },
    { title: "Inventory" },
    { title: "Vendor" },
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Catalog Snapshot
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Most recently updated products and inventory counts.
            </Text>
          </BlockStack>
          <Button variant="plain" onClick={onViewAllProducts}>
            View full catalog →
          </Button>
        </InlineStack>

        {products.length === 0 ? (
          <EmptySearchResult
            title="No products found in catalog"
            description="Products created in your Shopify store will appear here."
          />
        ) : (
          <IndexTable
            resourceName={{ singular: "product", plural: "products" }}
            itemCount={products.length}
            headings={headings}
            selectable={false}
          >
            {products.map((product, index) => {
              const inventoryTone =
                product.totalInventory === null
                  ? undefined
                  : product.totalInventory <= 0
                  ? "critical"
                  : product.totalInventory <= 5
                  ? "attention"
                  : undefined;

              return (
                <IndexTable.Row
                  id={product.id}
                  key={product.id}
                  position={index}
                  onClick={() => onSelectProduct?.(product.id)}
                >
                  <IndexTable.Cell>
                    {product.featuredImage?.url ? (
                      <Thumbnail
                        source={product.featuredImage.url}
                        alt={product.featuredImage.altText || product.title}
                        size="small"
                      />
                    ) : (
                      <Thumbnail
                        source={ImageIcon}
                        alt="No image"
                        size="small"
                      />
                    )}
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {product.title}
                    </Text>
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <Badge tone={getStatusTone(product.status)}>
                      {product.status}
                    </Badge>
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    {product.totalInventory !== null ? (
                      <InlineStack gap="150" blockAlign="center">
                        <Text as="span" variant="bodyMd">
                          {product.totalInventory} in stock
                        </Text>
                        {inventoryTone && (
                          <Badge tone={inventoryTone}>
                            {product.totalInventory <= 0
                              ? "Out of Stock"
                              : "Low"}
                          </Badge>
                        )}
                      </InlineStack>
                    ) : (
                      <Text as="span" variant="bodySm" tone="subdued">
                        Not tracked
                      </Text>
                    )}
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {product.vendor || "—"}
                    </Text>
                  </IndexTable.Cell>
                </IndexTable.Row>
              );
            })}
          </IndexTable>
        )}
      </BlockStack>
    </Card>
  );
}
