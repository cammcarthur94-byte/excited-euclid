import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  EmptySearchResult,
  Icon,
  IndexTable,
  InlineStack,
  Link,
  Page,
  Pagination,
  Select,
  Tabs,
  Tag,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { ImageIcon, SearchIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

const STORAGE_KEY = "catalog_commander_selected_products";

const STATUS_TABS = [
  { id: "ALL", content: "All" },
  { id: "ACTIVE", content: "Active" },
  { id: "DRAFT", content: "Draft" },
  { id: "ARCHIVED", content: "Archived" },
];

interface ProductNode {
  id: string;
  title: string;
  handle?: string;
  status: string;
  vendor: string;
  totalInventory: number | null;
  featuredImage: {
    url: string;
    altText: string | null;
  } | null;
  priceRangeV2?: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface ProductsFilterState {
  search: string;
  status: string;
  inventory: string;
  invMin: string;
  invMax: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);

  // Read filter parameters (supports backwards compatibility for `query`)
  const searchParam =
    url.searchParams.get("search") || url.searchParams.get("query") || "";
  const rawStatus = (url.searchParams.get("status") || "ALL").toUpperCase();
  const rawInventory = (
    url.searchParams.get("inventory") || "ALL"
  ).toUpperCase();
  const invMin = url.searchParams.get("invMin") || "";
  const invMax = url.searchParams.get("invMax") || "";

  const validStatuses = ["ALL", "ACTIVE", "DRAFT", "ARCHIVED"];
  const status = validStatuses.includes(rawStatus) ? rawStatus : "ALL";

  const validInventories = [
    "ALL",
    "IN_STOCK",
    "OUT_OF_STOCK",
    "LOW_STOCK",
    "CUSTOM",
  ];
  const inventory = validInventories.includes(rawInventory)
    ? rawInventory
    : "ALL";

  const cursor = url.searchParams.get("cursor");
  const direction = url.searchParams.get("direction");

  const PAGE_SIZE = 10;
  const variables: Record<string, unknown> = {};

  const queryParts: string[] = [];

  // 1. Product name / text search
  if (searchParam.trim()) {
    const trimmed = searchParam.trim();
    if (
      trimmed.includes(":") ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      queryParts.push(trimmed);
    } else if (trimmed.includes(" ")) {
      queryParts.push(`"${trimmed}"`);
    } else {
      queryParts.push(`${trimmed}*`);
    }
  }

  // 2. Status filter
  if (status !== "ALL") {
    queryParts.push(`status:${status.toLowerCase()}`);
  }

  // 3. Inventory filter
  if (inventory === "IN_STOCK") {
    queryParts.push("inventory_total:>0");
  } else if (inventory === "OUT_OF_STOCK") {
    queryParts.push("inventory_total:<=0");
  } else if (inventory === "LOW_STOCK") {
    queryParts.push("inventory_total:>0 inventory_total:<=10");
  } else if (inventory === "CUSTOM") {
    if (invMin !== "" && !isNaN(Number(invMin))) {
      queryParts.push(`inventory_total:>=${Number(invMin)}`);
    }
    if (invMax !== "" && !isNaN(Number(invMax))) {
      queryParts.push(`inventory_total:<=${Number(invMax)}`);
    }
  }

  if (queryParts.length > 0) {
    variables.query = queryParts.join(" ");
  }

  if (direction === "previous" && cursor) {
    variables.last = PAGE_SIZE;
    variables.before = cursor;
  } else if (direction === "next" && cursor) {
    variables.first = PAGE_SIZE;
    variables.after = cursor;
  } else {
    variables.first = PAGE_SIZE;
  }

  const response = await admin.graphql(
    `#graphql
      query getProducts($first: Int, $last: Int, $after: String, $before: String, $query: String) {
        products(first: $first, last: $last, after: $after, before: $before, query: $query) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          edges {
            cursor
            node {
              id
              title
              handle
              status
              vendor
              totalInventory
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `,
    { variables },
  );

  const responseJson = await response.json();
  const productsData = responseJson.data?.products;

  const products: ProductNode[] =
    productsData?.edges?.map(
      (edge: { cursor: string; node: ProductNode }) => edge.node,
    ) || [];

  const pageInfo: PageInfo = productsData?.pageInfo || {
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
    endCursor: null,
  };

  return {
    products,
    pageInfo,
    shop: session.shop,
    filters: {
      search: searchParam,
      status,
      inventory,
      invMin,
      invMax,
    },
  };
};

function getStatusTone(
  status: string,
): "success" | "info" | "attention" | undefined {
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
}

function getInventoryBadgeText(
  inventory: string,
  min?: string,
  max?: string,
): string {
  switch (inventory) {
    case "IN_STOCK":
      return "In stock (> 0)";
    case "OUT_OF_STOCK":
      return "Out of stock (≤ 0)";
    case "LOW_STOCK":
      return "Low stock (1 - 10)";
    case "CUSTOM":
      if (min && max) return `${min} - ${max} units`;
      if (min) return `≥ ${min} units`;
      if (max) return `≤ ${max} units`;
      return "Custom inventory";
    default:
      return "All";
  }
}

export default function ProductsPage() {
  const { products, pageInfo, filters, shop = "" } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState(filters.search);
  const [statusSelect, setStatusSelect] = useState(filters.status);
  const [inventorySelect, setInventorySelect] = useState(filters.inventory);
  const [invMinInput, setInvMinInput] = useState(filters.invMin);
  const [invMaxInput, setInvMaxInput] = useState(filters.invMax);

  const [selectedResources, setSelectedResources] = useState<string[]>([]);

  // Sync state whenever filters change from loader / URL navigation
  useEffect(() => {
    setSearchInput(filters.search);
    setStatusSelect(filters.status);
    setInventorySelect(filters.inventory);
    setInvMinInput(filters.invMin);
    setInvMaxInput(filters.invMax);
  }, [
    filters.search,
    filters.status,
    filters.inventory,
    filters.invMin,
    filters.invMax,
  ]);

  // Restore persistent selection from sessionStorage on client mount
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedResources(parsed);
        }
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }, []);

  const updateSelection = (newSelection: string[]) => {
    setSelectedResources(newSelection);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newSelection));
    } catch {
      // Ignore sessionStorage errors
    }
  };

  const handleClearAllSelections = () => {
    updateSelection([]);
  };

  const pageProductIds = products.map((p) => p.id);
  const selectedOnPage = pageProductIds.filter((id) =>
    selectedResources.includes(id),
  );
  const allOnPageSelected =
    pageProductIds.length > 0 &&
    selectedOnPage.length === pageProductIds.length;

  const selectedItemsCount = allOnPageSelected
    ? ("All" as const)
    : selectedOnPage.length;

  const handleSelectionChange = (
    selectionType: "all" | "page" | "multi" | "single" | "range" | any,
    isSelecting: boolean,
    selection?: string | [number, number],
  ) => {
    let nextSelected = [...selectedResources];

    if (selectionType === "single" && typeof selection === "string") {
      if (isSelecting) {
        if (!nextSelected.includes(selection)) {
          nextSelected.push(selection);
        }
      } else {
        nextSelected = nextSelected.filter((id) => id !== selection);
      }
    } else if (selectionType === "all" || selectionType === "page") {
      if (isSelecting) {
        for (const id of pageProductIds) {
          if (!nextSelected.includes(id)) {
            nextSelected.push(id);
          }
        }
      } else {
        nextSelected = nextSelected.filter((id) => !pageProductIds.includes(id));
      }
    } else if (
      (selectionType === "multi" || selectionType === "range") &&
      Array.isArray(selection)
    ) {
      const [start, end] = selection;
      const rangeIds = products.slice(start, end + 1).map((p) => p.id);
      if (isSelecting) {
        for (const id of rangeIds) {
          if (!nextSelected.includes(id)) {
            nextSelected.push(id);
          }
        }
      } else {
        nextSelected = nextSelected.filter((id) => !rangeIds.includes(id));
      }
    }

    updateSelection(nextSelected);
  };

  const applyFilters = (newFilters: {
    search?: string;
    status?: string;
    inventory?: string;
    invMin?: string;
    invMax?: string;
  }) => {
    const params = new URLSearchParams();
    const searchVal =
      newFilters.search !== undefined ? newFilters.search : searchInput;
    const statusVal =
      newFilters.status !== undefined ? newFilters.status : statusSelect;
    const invVal =
      newFilters.inventory !== undefined ? newFilters.inventory : inventorySelect;
    const minVal =
      newFilters.invMin !== undefined ? newFilters.invMin : invMinInput;
    const maxVal =
      newFilters.invMax !== undefined ? newFilters.invMax : invMaxInput;

    if (searchVal.trim()) {
      params.set("search", searchVal.trim());
    }
    if (statusVal && statusVal !== "ALL") {
      params.set("status", statusVal);
    }
    if (invVal && invVal !== "ALL") {
      params.set("inventory", invVal);
      if (invVal === "CUSTOM") {
        if (minVal !== "") params.set("invMin", minVal);
        if (maxVal !== "") params.set("invMax", maxVal);
      }
    }

    const queryStr = params.toString();
    navigate(queryStr ? `?${queryStr}` : "/app/products");
  };

  const selectedTabIndex = Math.max(
    0,
    STATUS_TABS.findIndex((tab) => tab.id === filters.status),
  );

  const handleTabSelect = (tabIndex: number) => {
    const newStatus = STATUS_TABS[tabIndex].id;
    setStatusSelect(newStatus);
    applyFilters({ status: newStatus });
  };

  const handleFilterSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    applyFilters({
      search: searchInput,
      status: statusSelect,
      inventory: inventorySelect,
      invMin: invMinInput,
      invMax: invMaxInput,
    });
  };

  const handleStatusSelectChange = (newStatus: string) => {
    setStatusSelect(newStatus);
    applyFilters({ status: newStatus });
  };

  const handleInventorySelectChange = (newInventory: string) => {
    setInventorySelect(newInventory);
    if (newInventory !== "CUSTOM") {
      applyFilters({ inventory: newInventory, invMin: "", invMax: "" });
    }
  };

  const handleResetAllFilters = () => {
    setSearchInput("");
    setStatusSelect("ALL");
    setInventorySelect("ALL");
    setInvMinInput("");
    setInvMaxInput("");
    navigate("/app/products");
  };

  const handleRemoveSearchFilter = () => {
    setSearchInput("");
    applyFilters({ search: "" });
  };

  const handleRemoveStatusFilter = () => {
    setStatusSelect("ALL");
    applyFilters({ status: "ALL" });
  };

  const handleRemoveInventoryFilter = () => {
    setInventorySelect("ALL");
    setInvMinInput("");
    setInvMaxInput("");
    applyFilters({ inventory: "ALL", invMin: "", invMax: "" });
  };

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    filters.status !== "ALL" ||
    filters.inventory !== "ALL";

  const buildPageUrl = (cursorVal: string, dir: "next" | "previous") => {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.status && filters.status !== "ALL") {
      params.set("status", filters.status);
    }
    if (filters.inventory && filters.inventory !== "ALL") {
      params.set("inventory", filters.inventory);
      if (filters.inventory === "CUSTOM") {
        if (filters.invMin) params.set("invMin", filters.invMin);
        if (filters.invMax) params.set("invMax", filters.invMax);
      }
    }
    params.set("direction", dir);
    params.set("cursor", cursorVal);
    return `?${params.toString()}`;
  };

  const handleNextPage = () => {
    if (!pageInfo.endCursor) return;
    navigate(buildPageUrl(pageInfo.endCursor, "next"));
  };

  const handlePreviousPage = () => {
    if (!pageInfo.startCursor) return;
    navigate(buildPageUrl(pageInfo.startCursor, "previous"));
  };

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const headings: [{ title: string }, ...{ title: string }[]] = [
    { title: "Image" },
    { title: "Title" },
    { title: "Status" },
    { title: "Price" },
    { title: "Inventory" },
    { title: "Vendor" },
  ];

  const emptyStateMarkup = (
    <BlockStack gap="300" inlineAlign="center">
      <EmptySearchResult
        title="No products found"
        description={
          hasActiveFilters
            ? "No products matched your selected filters. Try adjusting your filters or clearing them to view all products."
            : "No products in this store yet."
        }
        withIllustration
      />
      {hasActiveFilters && (
        <InlineStack align="center">
          <Button onClick={handleResetAllFilters}>Clear all filters</Button>
        </InlineStack>
      )}
    </BlockStack>
  );

  const rowMarkup = products.map((product, index) => {
    const formattedPrice = product.priceRangeV2
      ? product.priceRangeV2.minVariantPrice.amount ===
        product.priceRangeV2.maxVariantPrice.amount
        ? `$${parseFloat(product.priceRangeV2.minVariantPrice.amount).toFixed(2)}`
        : `$${parseFloat(product.priceRangeV2.minVariantPrice.amount).toFixed(2)} – $${parseFloat(product.priceRangeV2.maxVariantPrice.amount).toFixed(2)}`
      : "—";

    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        position={index}
        selected={selectedResources.includes(product.id)}
      >
        <IndexTable.Cell>
          <Thumbnail
            source={product.featuredImage?.url || ImageIcon}
            alt={product.featuredImage?.altText || product.title}
            size="small"
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {product.title}
            </Text>
            {shop && (
              <Link
                url={`https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/products/${product.id.split("/").pop()}`}
                target="_blank"
                removeUnderline
              >
                <Text as="span" variant="bodyXs" tone="subdued">
                  Admin ↗
                </Text>
              </Link>
            )}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={getStatusTone(product.status)}>{product.status}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {formattedPrice}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {product.totalInventory != null
              ? `${product.totalInventory} in stock`
              : "0 in stock"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {product.vendor || "—"}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Products"
      subtitle="Select products to bulk edit prices, inventory, status, tags, collections, compare-at, and organization"
      primaryAction={
        selectedResources.length > 0
          ? {
              content: `Bulk Edit Selected (${selectedResources.length})`,
              onAction: () => {
                navigate(
                  `/app/bulk-edit?ids=${encodeURIComponent(selectedResources.join(","))}`,
                );
              },
            }
          : undefined
      }
      secondaryActions={[
        {
          content:
            selectedResources.length > 0
              ? `Export Selected (${selectedResources.length}) to CSV`
              : "Export Catalog to CSV",
          onAction: async () => {
            const url =
              selectedResources.length > 0
                ? `/app/export-csv?ids=${encodeURIComponent(selectedResources.join(","))}`
                : "/app/export-csv";
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error(`Export failed: ${res.status}`);
              const blob = await res.blob();
              const blobUrl = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = blobUrl;
              link.download = `catalog_export_${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(blobUrl);
            } catch (err) {
              console.error("[Products] Export failed:", err);
              window.open(url, "_blank");
            }
          },
        },
        {
          content: "Import CSV",
          onAction: () => navigate("/app/csv-import"),
        },
      ]}
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            {/* Quick Status Segment Tabs */}
            <Tabs
              tabs={STATUS_TABS}
              selected={selectedTabIndex}
              onSelect={handleTabSelect}
            />

            {/* Filter Controls Form */}
            <form onSubmit={handleFilterSubmit}>
              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="end" wrap>
                  {/* Product Name Filter */}
                  <div style={{ flex: "1 1 240px", minWidth: "200px" }}>
                    <TextField
                      label="Product name"
                      value={searchInput}
                      onChange={setSearchInput}
                      placeholder="Filter by product name..."
                      autoComplete="off"
                      clearButton
                      onClearButtonClick={() => {
                        setSearchInput("");
                        if (filters.search) {
                          applyFilters({ search: "" });
                        }
                      }}
                      prefix={<Icon source={SearchIcon} />}
                    />
                  </div>

                  {/* Status Dropdown Filter */}
                  <div style={{ flex: "0 1 170px", minWidth: "140px" }}>
                    <Select
                      label="Status"
                      options={[
                        { label: "All statuses", value: "ALL" },
                        { label: "Active", value: "ACTIVE" },
                        { label: "Draft", value: "DRAFT" },
                        { label: "Archived", value: "ARCHIVED" },
                      ]}
                      value={statusSelect}
                      onChange={handleStatusSelectChange}
                    />
                  </div>

                  {/* Inventory Filter */}
                  <div style={{ flex: "0 1 190px", minWidth: "160px" }}>
                    <Select
                      label="Inventory"
                      options={[
                        { label: "All inventory", value: "ALL" },
                        { label: "In stock (> 0)", value: "IN_STOCK" },
                        { label: "Out of stock (≤ 0)", value: "OUT_OF_STOCK" },
                        { label: "Low stock (1 - 10)", value: "LOW_STOCK" },
                        { label: "Custom range...", value: "CUSTOM" },
                      ]}
                      value={inventorySelect}
                      onChange={handleInventorySelectChange}
                    />
                  </div>

                  {/* Custom Inventory Range (when CUSTOM selected) */}
                  {inventorySelect === "CUSTOM" && (
                    <InlineStack gap="200" blockAlign="end">
                      <div style={{ width: "95px" }}>
                        <TextField
                          label="Min stock"
                          type="number"
                          value={invMinInput}
                          onChange={setInvMinInput}
                          autoComplete="off"
                          placeholder="0"
                        />
                      </div>
                      <div style={{ width: "95px" }}>
                        <TextField
                          label="Max stock"
                          type="number"
                          value={invMaxInput}
                          onChange={setInvMaxInput}
                          autoComplete="off"
                          placeholder="100"
                        />
                      </div>
                    </InlineStack>
                  )}

                  {/* Action Buttons */}
                  <InlineStack gap="200" blockAlign="end">
                    <Button submit variant="primary">
                      Apply
                    </Button>
                    {hasActiveFilters && (
                      <Button onClick={handleResetAllFilters}>Clear</Button>
                    )}
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </form>

            {/* Active Filter Badges */}
            {hasActiveFilters && (
              <Box
                background="bg-surface-secondary"
                padding="200"
                borderRadius="200"
              >
                <InlineStack gap="200" blockAlign="center" wrap>
                  <Text
                    as="span"
                    variant="bodySm"
                    tone="subdued"
                    fontWeight="medium"
                  >
                    Active filters:
                  </Text>
                  {filters.search.trim() ? (
                    <Tag onRemove={handleRemoveSearchFilter}>
                      Product: &quot;{filters.search.trim()}&quot;
                    </Tag>
                  ) : null}
                  {filters.status !== "ALL" ? (
                    <Tag onRemove={handleRemoveStatusFilter}>
                      Status:{" "}
                      {filters.status.charAt(0) +
                        filters.status.slice(1).toLowerCase()}
                    </Tag>
                  ) : null}
                  {filters.inventory !== "ALL" ? (
                    <Tag onRemove={handleRemoveInventoryFilter}>
                      Inventory:{" "}
                      {getInventoryBadgeText(
                        filters.inventory,
                        filters.invMin,
                        filters.invMax,
                      )}
                    </Tag>
                  ) : null}
                  <Button
                    variant="plain"
                    tone="critical"
                    onClick={handleResetAllFilters}
                  >
                    Clear all filters
                  </Button>
                </InlineStack>
              </Box>
            )}

            {/* Selected Product Count and Bulk Action Toolbar */}
            <Box
              background="bg-surface-secondary"
              padding="300"
              borderRadius="200"
            >
              <InlineStack align="space-between" blockAlign="center" wrap>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    Selected products:
                  </Text>
                  <Badge
                    tone={selectedResources.length > 0 ? "info" : undefined}
                  >
                    {`${selectedResources.length} selected`}
                  </Badge>
                  {selectedResources.length > 0 && (
                    <Text as="span" variant="bodySm" tone="subdued">
                      (persists across pages)
                    </Text>
                  )}
                </InlineStack>
                {selectedResources.length > 0 && (
                  <InlineStack gap="200" blockAlign="center" wrap>
                    <Button
                      variant="primary"
                      onClick={() => {
                        navigate(
                          `/app/bulk-edit?ids=${encodeURIComponent(selectedResources.join(","))}`,
                        );
                      }}
                    >
                      {`Edit products (${selectedResources.length})`}
                    </Button>
                    <Button
                      variant="plain"
                      tone="critical"
                      onClick={handleClearAllSelections}
                    >
                      Clear selection
                    </Button>
                  </InlineStack>
                )}
              </InlineStack>
            </Box>

            {/* Products Table */}
            <IndexTable
              resourceName={resourceName}
              itemCount={products.length}
              selectedItemsCount={selectedItemsCount}
              onSelectionChange={handleSelectionChange}
              headings={headings}
              emptyState={emptyStateMarkup}
              promotedBulkActions={[
                {
                  content: "Edit products",
                  onAction: () => {
                    navigate(
                      `/app/bulk-edit?ids=${encodeURIComponent(selectedResources.join(","))}`,
                    );
                  },
                },
                {
                  content: "Export to CSV",
                  onAction: async () => {
                    const url = `/app/export-csv?ids=${encodeURIComponent(selectedResources.join(","))}`;
                    try {
                      const res = await fetch(url);
                      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
                      const blob = await res.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = blobUrl;
                      link.download = `catalog_export_selected_${new Date().toISOString().slice(0, 10)}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(blobUrl);
                    } catch (err) {
                      console.error("[Products] Export selected failed:", err);
                      window.open(url, "_blank");
                    }
                  },
                },
              ]}
            >
              {rowMarkup}
            </IndexTable>

            {/* Pagination */}
            {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
              <Box paddingBlockStart="300">
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={pageInfo.hasPreviousPage}
                    onPrevious={handlePreviousPage}
                    hasNext={pageInfo.hasNextPage}
                    onNext={handleNextPage}
                  />
                </InlineStack>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
