import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  AppProvider,
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  IndexTable,
  Thumbnail,
  TextField,
  Select,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
];

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const screen = params.screen || "products";
  return json({ screen });
};

// Realistic store products
const SAMPLE_PRODUCTS = [
  {
    id: "gid://shopify/Product/1",
    title: "The Minimal Snowboard",
    handle: "the-minimal-snowboard",
    status: "ACTIVE",
    vendor: "Snowboard Vendor",
    type: "Snowboard",
    price: "$550.00",
    compareAtPrice: "$500.00",
    inventory: 55,
    variantsCount: 1,
    image: "https://cdn.shopify.com/s/files/1/0262/4071/2766/files/snowboard_1.png",
  },
  {
    id: "gid://shopify/Product/2",
    title: "The Inventory Not Tracked Snowboard",
    handle: "the-inventory-not-tracked-snowboard",
    status: "ACTIVE",
    vendor: "Snowboard Vendor",
    type: "Snowboard",
    price: "$605.00",
    compareAtPrice: "$699.99",
    inventory: 5,
    variantsCount: 1,
    image: "https://cdn.shopify.com/s/files/1/0262/4071/2766/files/snowboard_2.png",
  },
  {
    id: "gid://shopify/Product/3",
    title: "The Complete Snowboard",
    handle: "the-complete-snowboard",
    status: "ACTIVE",
    vendor: "Alpine Sports",
    type: "Snowboard",
    price: "$685.00",
    compareAtPrice: "$750.00",
    inventory: 42,
    variantsCount: 3,
    image: "https://cdn.shopify.com/s/files/1/0262/4071/2766/files/snowboard_3.png",
  },
  {
    id: "gid://shopify/Product/4",
    title: "Gift Card",
    handle: "gift-card",
    status: "ACTIVE",
    vendor: "Catalog Commander",
    type: "Gift Card",
    price: "$10.00 - $100.00",
    compareAtPrice: null,
    inventory: 99,
    variantsCount: 4,
    image: "https://cdn.shopify.com/s/files/1/0262/4071/2766/files/giftcard.png",
  },
  {
    id: "gid://shopify/Product/5",
    title: "The Draft Snowboard",
    handle: "the-draft-snowboard",
    status: "DRAFT",
    vendor: "Snowboard Vendor",
    type: "Snowboard",
    price: "$671.00",
    compareAtPrice: "$700.00",
    inventory: 25,
    variantsCount: 1,
    image: "https://cdn.shopify.com/s/files/1/0262/4071/2766/files/snowboard_4.png",
  },
  {
    id: "gid://shopify/Product/6",
    title: "The Archived Snowboard",
    handle: "the-archived-snowboard",
    status: "ARCHIVED",
    vendor: "Snowboard Vendor",
    type: "Snowboard",
    price: "$671.00",
    compareAtPrice: "$750.00",
    inventory: 0,
    variantsCount: 1,
    image: "https://cdn.shopify.com/s/files/1/0262/4071/2766/files/snowboard_5.png",
  },
];

// Price preview sample items
const PRICE_PREVIEW_ITEMS = [
  {
    productId: "gid://shopify/Product/1",
    productTitle: "The Minimal Snowboard",
    variantTitle: "Default Title",
    currentPrice: "$500.00",
    newPrice: "$550.00",
    diff: "+$50.00",
    percent: "+10.0%",
    status: "ACTIVE",
  },
  {
    productId: "gid://shopify/Product/2",
    productTitle: "The Inventory Not Tracked Snowboard",
    variantTitle: "Default Title",
    currentPrice: "$550.00",
    newPrice: "$605.00",
    diff: "+$55.00",
    percent: "+10.0%",
    status: "ACTIVE",
  },
  {
    productId: "gid://shopify/Product/4",
    productTitle: "Gift Card",
    variantTitle: "$10",
    currentPrice: "$10.00",
    newPrice: "$11.00",
    diff: "+$1.00",
    percent: "+10.0%",
    status: "ACTIVE",
  },
  {
    productId: "gid://shopify/Product/4",
    productTitle: "Gift Card",
    variantTitle: "$25",
    currentPrice: "$25.00",
    newPrice: "$27.50",
    diff: "+$2.50",
    percent: "+10.0%",
    status: "ACTIVE",
    isSame: true,
  },
  {
    productId: "gid://shopify/Product/4",
    productTitle: "Gift Card",
    variantTitle: "$50",
    currentPrice: "$50.00",
    newPrice: "$55.00",
    diff: "+$5.00",
    percent: "+10.0%",
    status: "ACTIVE",
    isSame: true,
  },
  {
    productId: "gid://shopify/Product/4",
    productTitle: "Gift Card",
    variantTitle: "$100",
    currentPrice: "$100.00",
    newPrice: "$110.00",
    diff: "+$10.00",
    percent: "+10.0%",
    status: "ACTIVE",
    isSame: true,
  },
  {
    productId: "gid://shopify/Product/5",
    productTitle: "The Draft Snowboard",
    variantTitle: "Default Title",
    currentPrice: "$610.00",
    newPrice: "$671.00",
    diff: "+$61.00",
    percent: "+10.0%",
    status: "DRAFT",
  },
];

// Inventory preview items
const INVENTORY_PREVIEW_ITEMS = [
  {
    productTitle: "The Minimal Snowboard",
    variantTitle: "Default Title",
    location: "Main Warehouse",
    currentStock: 50,
    newStock: 55,
    diff: "+5",
  },
  {
    productTitle: "The Minimal Snowboard",
    variantTitle: "Default Title",
    location: "Retail Storefront",
    currentStock: 5,
    newStock: 10,
    diff: "+5",
  },
  {
    productTitle: "The Inventory Not Tracked Snowboard",
    variantTitle: "Default Title",
    location: "Main Warehouse",
    currentStock: 5,
    newStock: 10,
    diff: "+5",
  },
  {
    productTitle: "The Complete Snowboard",
    variantTitle: "Ice / 156cm",
    location: "Main Warehouse",
    currentStock: 12,
    newStock: 17,
    diff: "+5",
  },
  {
    productTitle: "The Complete Snowboard",
    variantTitle: "Dawn / 159cm",
    location: "Main Warehouse",
    currentStock: 15,
    newStock: 20,
    diff: "+5",
  },
  {
    productTitle: "The Complete Snowboard",
    variantTitle: "Powder / 162cm",
    location: "Main Warehouse",
    currentStock: 15,
    newStock: 20,
    diff: "+5",
  },
];

// Job history items
const SAMPLE_JOBS = [
  {
    id: "job-1",
    action: "Price Adjustment: Percentage increase (%)",
    status: "COMPLETED",
    productsAffected: 10,
    details: "19 variants updated (+10.0% catalog increase)",
    date: "Just now",
  },
  {
    id: "job-2",
    action: "Inventory Adjustment: Add inventory (+)",
    status: "COMPLETED",
    productsAffected: 6,
    details: "12 stock levels updated (+5 units per location)",
    date: "12 minutes ago",
  },
  {
    id: "job-3",
    action: "Compare-at Price: Set promotional sale margin",
    status: "COMPLETED",
    productsAffected: 8,
    details: "14 promotional compare-at prices configured",
    date: "1 hour ago",
  },
  {
    id: "job-4",
    action: "Tag Management: Add tag 'Winter 2026'",
    status: "COMPLETED",
    productsAffected: 10,
    details: "10 products updated with marketing campaign tags",
    date: "Yesterday at 4:15 PM",
  },
  {
    id: "job-5",
    action: "CSV Import: Catalog bulk synchronization",
    status: "COMPLETED",
    productsAffected: 25,
    details: "25 products created and synchronized from CSV",
    date: "Oct 9, 2026",
  },
];

export default function ShowcaseScreen() {
  const { screen } = useLoaderData<typeof loader>();

  return (
    <AppProvider i18n={{}}>
      <div
        style={{
          width: "1600px",
          height: "900px",
          background: "#f1f2f4",
          display: "flex",
          flexDirection: "column",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top Shopify Admin Global Navigation Bar */}
        <header
          style={{
            height: "54px",
            background: "#1a1a1a",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            boxShadow: "0 1px 0 rgba(255, 255, 255, 0.1)",
            flexShrink: 0,
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: 600,
                fontSize: "14px",
                color: "#e3e3e3",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#95bf47">
                <path d="M18.8 6.5c-.1-.3-.3-.4-.5-.4h-2.1c-.2-1.7-1.1-4.1-3.6-4.1-2.5 0-3.4 2.4-3.6 4.1H6.9c-.2 0-.4.1-.5.4L3 21.2c0 .2 0 .4.2.6.2.1.3.2.5.2h16.6c.2 0 .4-.1.5-.2.2-.2.2-.4.2-.6L18.8 6.5zm-6.2-2.7c1.3 0 1.8 1.5 2 2.7H10.6c.2-1.2.7-2.7 2-2.7zm-6.9 16.4l2.5-12h1.6l-1.5 12H5.7zm3.4 0l1.5-12h4.8l1.5 12H9.1zm9.2 0l-1.5-12h1.6l2.5 12h-2.6z"/>
              </svg>
              <span>ecom-test-store</span>
            </div>
            <span style={{ color: "#555" }}>|</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#2a2a2a",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#a6a6a6",
                width: "420px",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Search products, orders, and customers (Ctrl + K)</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span
              style={{
                fontSize: "12px",
                background: "#2f3829",
                color: "#97cf67",
                padding: "3px 8px",
                borderRadius: "12px",
                fontWeight: 600,
              }}
            >
              Development Store
            </span>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#303030",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: "13px",
                color: "#fff",
              }}
            >
              CC
            </div>
          </div>
        </header>

        {/* Embedded App Title and Navigation Bar */}
        <nav
          style={{
            height: "50px",
            background: "#ffffff",
            borderBottom: "1px solid #e1e3e5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            flexShrink: 0,
            zIndex: 90,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #008060 0%, #004c3f 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontWeight: "bold",
                  fontSize: "15px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }}
              >
                ⊞
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "15px",
                  color: "#202223",
                  letterSpacing: "-0.2px",
                }}
              >
                Catalog Commander
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {[
                { id: "products", label: "Products" },
                { id: "bulk-price", label: "Bulk Edit" },
                { id: "csv-import", label: "CSV Import" },
                { id: "jobs", label: "Job History" },
                { id: "settings", label: "Settings" },
                { id: "billing", label: "Billing & Plans" },
              ].map((tab) => {
                const isActive =
                  (screen === "products" && tab.id === "products") ||
                  ((screen === "bulk-price" ||
                    screen === "bulk-inventory" ||
                    screen === "compare-at") &&
                    tab.id === "bulk-edit") ||
                  (screen === "csv-import" && tab.id === "csv-import") ||
                  (screen === "jobs" && tab.id === "jobs");

                return (
                  <div
                    key={tab.id}
                    style={{
                      padding: "14px 14px",
                      fontSize: "14px",
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#008060" : "#5c5f62",
                      borderBottom: isActive
                        ? "2px solid #008060"
                        : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontSize: "12px",
                color: "#6d7175",
                background: "#f6f6f7",
                padding: "4px 10px",
                borderRadius: "4px",
                fontWeight: 500,
              }}
            >
              Synced with Shopify Admin
            </span>
          </div>
        </nav>

        {/* Main Content Area */}
        <main
          style={{
            flex: 1,
            padding: "24px 36px",
            overflowY: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {screen === "products" && <ScreenProducts />}
          {screen === "bulk-price" && <ScreenBulkPrice />}
          {screen === "bulk-inventory" && <ScreenBulkInventory />}
          {screen === "compare-at" && <ScreenCompareAt />}
          {screen === "csv-import" && <ScreenCsvImport />}
          {screen === "jobs" && <ScreenJobs />}
        </main>
      </div>
    </AppProvider>
  );
}

// SCREEN 1: Products Management & Bulk Action Hub
function ScreenProducts() {
  return (
    <Page
      title="Products"
      subtitle="Manage your store catalog with fast multi-select bulk operations"
      primaryAction={{
        content: "Bulk Edit (10 selected)",
        tone: "success",
      }}
      secondaryActions={[
        { content: "Export CSV" },
        { content: "Import CSV" },
      ]}
    >
      <BlockStack gap="400">
        {/* Metric Cards Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Total Products</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">10</Text>
              <Text as="p" variant="bodyXs" tone="success">100% synchronized</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Active On Store</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">7</Text>
              <Text as="p" variant="bodyXs" tone="subdued">Visible to shoppers</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Low / Tracked Stock</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">2</Text>
              <Text as="p" variant="bodyXs" tone="caution">Needs restocking</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Draft / Hidden</Text>
              <Text as="p" variant="headingLg" fontWeight="bold">3</Text>
              <Text as="p" variant="bodyXs" tone="subdued">In review or staging</Text>
            </BlockStack>
          </Card>
        </div>

        {/* Selected Banner */}
        <Banner tone="info">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              ✓ All 10 products selected across your catalog (19 total variants)
            </Text>
            <InlineStack gap="200">
              <Button size="slim" variant="primary">Launch Bulk Editor</Button>
              <Button size="slim">Export Selected (CSV)</Button>
            </InlineStack>
          </InlineStack>
        </Banner>

        {/* Products IndexTable */}
        <Card padding="0">
          <Box padding="300">
            <InlineStack align="space-between" blockAlign="center">
              <div style={{ width: "380px" }}>
                <TextField
                  label="Search"
                  labelHidden
                  placeholder="Filter products by title, vendor, or SKU..."
                  value=""
                  autoComplete="off"
                />
              </div>
              <InlineStack gap="200">
                <Button size="slim" pressed>All (10)</Button>
                <Button size="slim">Active (7)</Button>
                <Button size="slim">Draft (2)</Button>
                <Button size="slim">Archived (1)</Button>
              </InlineStack>
            </InlineStack>
          </Box>
          <Divider />
          <IndexTable
            resourceName={{ singular: "product", plural: "products" }}
            itemCount={SAMPLE_PRODUCTS.length}
            selectedItemsCount="All"
            headings={[
              { title: "Product" },
              { title: "Status" },
              { title: "Inventory" },
              { title: "Price Range" },
              { title: "Vendor" },
              { title: "Type" },
            ]}
          >
            {SAMPLE_PRODUCTS.map((product, index) => (
              <IndexTable.Row
                id={product.id}
                key={product.id}
                position={index}
                selected={true}
              >
                <IndexTable.Cell>
                  <InlineStack gap="300" blockAlign="center">
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "6px",
                        background: "#e4e5e7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: "12px",
                        color: "#5c5f62",
                      }}
                    >
                      🏂
                    </div>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {product.title}
                      </Text>
                      <Text as="span" variant="bodyXs" tone="subdued">
                        {product.variantsCount} {product.variantsCount === 1 ? "variant" : "variants"} &bull; SKU: SNOW-{100 + index}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge
                    tone={
                      product.status === "ACTIVE"
                        ? "success"
                        : product.status === "DRAFT"
                          ? "warning"
                          : "subdued"
                    }
                  >
                    {product.status === "ACTIVE" ? "Active" : product.status === "DRAFT" ? "Draft" : "Archived"}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="150" blockAlign="center">
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: product.inventory > 10 ? "#008060" : product.inventory > 0 ? "#b98900" : "#d82c0d",
                      }}
                    />
                    <Text as="span" variant="bodyMd">
                      {product.inventory > 0 ? `${product.inventory} in stock` : "Out of stock"}
                    </Text>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {product.price}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm">{product.vendor}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone="info">{product.type}</Badge>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}

// SCREEN 2: Bulk Price Adjuster & Live Difference Preview
function ScreenBulkPrice() {
  return (
    <Page
      title="Bulk Catalog Editor"
      subtitle="Apply global price updates across 10 selected products (19 variants)"
      backAction={{ content: "Products" }}
    >
      <BlockStack gap="400">
        {/* Selected Products pill */}
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="info">10 products</Badge>
            <Badge tone="info">19 variants</Badge>
          </InlineStack>
          <Button size="slim">Change selection</Button>
        </InlineStack>

        {/* Feature Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            background: "#ebeef1",
            padding: "4px",
            borderRadius: "8px",
            width: "fit-content",
          }}
        >
          {["Price Adjustment", "Inventory Adjustment", "Product Status", "Tags", "Collections", "Compare-at Price", "Vendor & Product Type"].map((tab, idx) => (
            <div
              key={tab}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: idx === 0 ? 600 : 500,
                background: idx === 0 ? "#ffffff" : "transparent",
                color: idx === 0 ? "#202223" : "#5c5f62",
                boxShadow: idx === 0 ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Action Strategy Card */}
        <Card>
          <BlockStack gap="300">
            <div>
              <Text as="h2" variant="headingMd">Price Adjustment Rule</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Apply global price rules or manually adjust specific variant prices in the live calculation preview below.
              </Text>
            </div>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
              <div style={{ width: "260px" }}>
                <Select
                  label="Adjustment Type"
                  options={[
                    { label: "Percentage increase (%)", value: "pct_inc" },
                    { label: "Percentage decrease (%)", value: "pct_dec" },
                    { label: "Increase price ($)", value: "fix_inc" },
                    { label: "Decrease price ($)", value: "fix_dec" },
                    { label: "Set exact price ($)", value: "exact" },
                  ]}
                  value="pct_inc"
                  onChange={() => {}}
                />
              </div>
              <div style={{ width: "200px" }}>
                <TextField
                  label="Percentage (%)"
                  value="10"
                  suffix="%"
                  autoComplete="off"
                  onChange={() => {}}
                />
              </div>
              <Button variant="primary" tone="success">
                Review & Apply Prices (+10.0%)
              </Button>
            </div>
          </BlockStack>
        </Card>

        {/* Live Preview Table */}
        <Card padding="0">
          <Box padding="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="headingSm">Live Price Preview</Text>
                <Badge tone="attention">19 of 19 changing</Badge>
              </InlineStack>
              <InlineStack gap="200">
                <Button size="slim">All (19)</Button>
                <Button size="slim" pressed>Modified only (19)</Button>
              </InlineStack>
            </InlineStack>
          </Box>
          <Divider />
          <IndexTable
            resourceName={{ singular: "variant", plural: "variants" }}
            itemCount={PRICE_PREVIEW_ITEMS.length}
            selectable={false}
            headings={[
              { title: "Product" },
              { title: "Variant" },
              { title: "Current Price" },
              { title: "New Price" },
              { title: "Difference" },
            ]}
          >
            {PRICE_PREVIEW_ITEMS.map((item, index) => (
              <IndexTable.Row id={String(index)} key={index} position={index}>
                <IndexTable.Cell>
                  {item.isSame ? (
                    <div style={{ paddingLeft: "36px", color: "#6d7175", fontSize: "13px" }}>
                      ↳ (same product)
                    </div>
                  ) : (
                    <InlineStack gap="200" blockAlign="center">
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "4px",
                          background: "#e4e5e7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                        }}
                      >
                        🏂
                      </div>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {item.productTitle}
                        </Text>
                        <InlineStack gap="100">
                          <Badge tone={item.status === "ACTIVE" ? "success" : "warning"}>
                            {item.status === "ACTIVE" ? "Active" : "Draft"}
                          </Badge>
                          <Text as="span" variant="bodyXs" tone="subdued">Admin ↗</Text>
                          <Text as="span" variant="bodyXs" tone="subdued">Store ↗</Text>
                        </InlineStack>
                      </BlockStack>
                    </InlineStack>
                  )}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm">{item.variantTitle}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {item.currentPrice}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <div style={{ width: "130px" }}>
                    <TextField
                      label="New Price"
                      labelHidden
                      value={item.newPrice}
                      autoComplete="off"
                      onChange={() => {}}
                    />
                  </div>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone="success">
                    {`${item.diff} (${item.percent})`}
                  </Badge>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}

// SCREEN 3: Multi-Location Bulk Inventory
function ScreenBulkInventory() {
  return (
    <Page
      title="Bulk Catalog Editor"
      subtitle="Adjust stock levels across multiple locations with negative inventory prevention"
      backAction={{ content: "Products" }}
    >
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="info">10 products</Badge>
            <Badge tone="info">19 variants</Badge>
          </InlineStack>
          <Button size="slim">Change selection</Button>
        </InlineStack>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            background: "#ebeef1",
            padding: "4px",
            borderRadius: "8px",
            width: "fit-content",
          }}
        >
          {["Price Adjustment", "Inventory Adjustment", "Product Status", "Tags", "Collections", "Compare-at Price", "Vendor & Product Type"].map((tab, idx) => (
            <div
              key={tab}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: idx === 1 ? 600 : 500,
                background: idx === 1 ? "#ffffff" : "transparent",
                color: idx === 1 ? "#202223" : "#5c5f62",
                boxShadow: idx === 1 ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        <Card>
          <BlockStack gap="300">
            <div>
              <Text as="h2" variant="headingMd">Inventory Adjustment Rule</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Negative inventory is automatically prevented (minimum quantity will remain 0).
              </Text>
            </div>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
              <div style={{ width: "240px" }}>
                <Select
                  label="Adjustment Type"
                  options={[
                    { label: "Add inventory (+)", value: "add" },
                    { label: "Remove inventory (-)", value: "remove" },
                    { label: "Set exact inventory (=)", value: "set_exact" },
                  ]}
                  value="add"
                  onChange={() => {}}
                />
              </div>
              <div style={{ width: "180px" }}>
                <TextField
                  label="Quantity"
                  value="5"
                  autoComplete="off"
                  onChange={() => {}}
                />
              </div>
              <div style={{ width: "240px" }}>
                <Select
                  label="Location Target"
                  options={[
                    { label: "All Active Locations", value: "all" },
                    { label: "Main Warehouse", value: "warehouse" },
                    { label: "Retail Storefront", value: "retail" },
                  ]}
                  value="all"
                  onChange={() => {}}
                />
              </div>
              <Button variant="primary" tone="success">
                Review & Apply Inventory (+5 units)
              </Button>
            </div>
          </BlockStack>
        </Card>

        <Card padding="0">
          <Box padding="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="headingSm">Stock Level Changes</Text>
                <Badge tone="success">12 stock levels increasing</Badge>
              </InlineStack>
              <InlineStack gap="200">
                <Button size="slim">All (12)</Button>
                <Button size="slim" pressed>Modified only (12)</Button>
              </InlineStack>
            </InlineStack>
          </Box>
          <Divider />
          <IndexTable
            resourceName={{ singular: "item", plural: "items" }}
            itemCount={INVENTORY_PREVIEW_ITEMS.length}
            selectable={false}
            headings={[
              { title: "Product" },
              { title: "Variant" },
              { title: "Location" },
              { title: "Current Stock" },
              { title: "New Stock" },
              { title: "Difference" },
            ]}
          >
            {INVENTORY_PREVIEW_ITEMS.map((item, index) => (
              <IndexTable.Row id={String(index)} key={index} position={index}>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {item.productTitle}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm">{item.variantTitle}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone="info">{item.location}</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {item.currentStock} in stock
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <div style={{ width: "110px" }}>
                    <TextField
                      label="New Stock"
                      labelHidden
                      value={String(item.newStock)}
                      autoComplete="off"
                      onChange={() => {}}
                    />
                  </div>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone="success">{item.diff}</Badge>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}

// SCREEN 4: Promotional Compare-at / MSRP Pricing
function ScreenCompareAt() {
  return (
    <Page
      title="Bulk Catalog Editor"
      subtitle="Configure promotional compare-at strike-through pricing for high-converting sales"
      backAction={{ content: "Products" }}
    >
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="info">10 products</Badge>
            <Badge tone="info">19 variants</Badge>
          </InlineStack>
          <Button size="slim">Change selection</Button>
        </InlineStack>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            background: "#ebeef1",
            padding: "4px",
            borderRadius: "8px",
            width: "fit-content",
          }}
        >
          {["Price Adjustment", "Inventory Adjustment", "Product Status", "Tags", "Collections", "Compare-at Price", "Vendor & Product Type"].map((tab, idx) => (
            <div
              key={tab}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: idx === 5 ? 600 : 500,
                background: idx === 5 ? "#ffffff" : "transparent",
                color: idx === 5 ? "#202223" : "#5c5f62",
                boxShadow: idx === 5 ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer",
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        <Card>
          <BlockStack gap="300">
            <div>
              <Text as="h2" variant="headingMd">Promotional Strike-Through Pricing</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Set compare-at price above selling price to display attractive sale badges and crossed-out original prices on your storefront.
              </Text>
            </div>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
              <div style={{ width: "260px" }}>
                <Select
                  label="Promotional Strategy"
                  options={[
                    { label: "Set % above selling price (MSRP)", value: "pct_above" },
                    { label: "Set fixed amount above price ($)", value: "fix_above" },
                    { label: "Match selling price (Remove sale)", value: "match" },
                    { label: "Clear all compare-at prices", value: "clear" },
                  ]}
                  value="pct_above"
                  onChange={() => {}}
                />
              </div>
              <div style={{ width: "180px" }}>
                <TextField
                  label="Markup Percentage"
                  value="20"
                  suffix="%"
                  autoComplete="off"
                  onChange={() => {}}
                />
              </div>
              <Button variant="primary" tone="success">
                Apply Compare-At Pricing (+20% MSRP)
              </Button>
            </div>
          </BlockStack>
        </Card>

        <Card padding="0">
          <Box padding="300">
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="headingSm">Storefront Sale Preview</Text>
                <Badge tone="attention">Automatic Strike-Through Badges</Badge>
              </InlineStack>
            </InlineStack>
          </Box>
          <Divider />
          <IndexTable
            resourceName={{ singular: "item", plural: "items" }}
            itemCount={4}
            selectable={false}
            headings={[
              { title: "Product" },
              { title: "Selling Price" },
              { title: "Compare-at Price (MSRP)" },
              { title: "Shopper Discount" },
              { title: "Storefront Appearance" },
            ]}
          >
            {[
              { title: "The Minimal Snowboard", price: "$550.00", compare: "$660.00", discount: "17% OFF" },
              { title: "The Inventory Not Tracked Snowboard", price: "$605.00", compare: "$726.00", discount: "17% OFF" },
              { title: "The Complete Snowboard", price: "$685.00", compare: "$822.00", discount: "17% OFF" },
              { title: "The Draft Snowboard", price: "$671.00", compare: "$805.20", discount: "17% OFF" },
            ].map((p, idx) => (
              <IndexTable.Row id={String(idx)} key={idx} position={idx}>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">{p.title}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" fontWeight="bold">{p.price}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <div style={{ width: "140px" }}>
                    <TextField
                      label="Compare At"
                      labelHidden
                      value={p.compare}
                      autoComplete="off"
                      onChange={() => {}}
                    />
                  </div>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone="success">{p.discount}</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="200" blockAlign="center">
                    <span style={{ textDecoration: "line-through", color: "#8c9196" }}>{p.compare}</span>
                    <span style={{ fontWeight: 700, color: "#d82c0d" }}>{p.price}</span>
                    <Badge tone="attention">Sale</Badge>
                  </InlineStack>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}

// SCREEN 5: CSV Import & Catalog Sync
function ScreenCsvImport() {
  return (
    <Page
      title="CSV Import & Catalog Sync"
      subtitle="Import, validate, and bulk synchronize products, prices, and inventory using standard CSV spreadsheets"
      primaryAction={{
        content: "Download Official CSV Template",
      }}
    >
      <BlockStack gap="400">
        {/* Banner with guidelines */}
        <Banner tone="info" title="Zero-friction CSV Spreadsheet Integration">
          <p>
            Update prices, compare-at MSRP, and inventory levels in bulk using Excel or Google Sheets. Catalog Commander automatically detects column headers and matches them to your Shopify catalog.
          </p>
        </Banner>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Dropzone Card */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Upload Spreadsheet</Text>
              <div
                style={{
                  border: "2px dashed #babfc3",
                  borderRadius: "8px",
                  padding: "48px 24px",
                  textAlign: "center",
                  background: "#f9fafb",
                  cursor: "pointer",
                }}
              >
                <BlockStack gap="200" inlineAlign="center">
                  <div style={{ fontSize: "36px" }}>📂</div>
                  <Text as="p" variant="headingSm">Drag and drop your CSV file here</Text>
                  <Text as="p" variant="bodySm" tone="subdued">or click to browse your computer (.csv files up to 20MB)</Text>
                  <div style={{ marginTop: "12px" }}>
                    <Button variant="primary">Select CSV File</Button>
                  </div>
                </BlockStack>
              </div>
            </BlockStack>
          </Card>

          {/* Validation & Template Card */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Pre-Import Validation Check</Text>
              <Box padding="200" background="bg-surface-secondary" borderRadius="150">
                <BlockStack gap="200">
                  <InlineStack gap="150" blockAlign="center">
                    <span style={{ color: "#008060", fontWeight: "bold" }}>✓</span>
                    <Text as="p" variant="bodySm"><strong>Handle / SKU:</strong> Matches existing products safely without creating duplicates.</Text>
                  </InlineStack>
                  <InlineStack gap="150" blockAlign="center">
                    <span style={{ color: "#008060", fontWeight: "bold" }}>✓</span>
                    <Text as="p" variant="bodySm"><strong>Price Formatting:</strong> Automated currency normalization ($500.00 standard).</Text>
                  </InlineStack>
                  <InlineStack gap="150" blockAlign="center">
                    <span style={{ color: "#008060", fontWeight: "bold" }}>✓</span>
                    <Text as="p" variant="bodySm"><strong>Inventory Guard:</strong> Prevents accidental negative inventory counts.</Text>
                  </InlineStack>
                  <InlineStack gap="150" blockAlign="center">
                    <span style={{ color: "#008060", fontWeight: "bold" }}>✓</span>
                    <Text as="p" variant="bodySm"><strong>Dry-run Preview:</strong> Review every calculated row before committing changes.</Text>
                  </InlineStack>
                </BlockStack>
              </Box>
              <Divider />
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodySm" tone="subdued">Need an example structure?</Text>
                <Button variant="plain">Get CSV Template (.csv) ↓</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </div>

        {/* Sample Column Mapping */}
        <Card padding="0">
          <Box padding="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm">Detected Column Structure (Template Preview)</Text>
              <Badge tone="success">100% Schema Matched</Badge>
            </InlineStack>
          </Box>
          <Divider />
          <IndexTable
            resourceName={{ singular: "column", plural: "columns" }}
            itemCount={5}
            selectable={false}
            headings={[
              { title: "CSV Column Name" },
              { title: "Target Field in Shopify" },
              { title: "Example Value" },
              { title: "Status" },
            ]}
          >
            {[
              { col: "Handle", target: "Product Handle", ex: "the-minimal-snowboard", status: "Required Identifier" },
              { col: "Variant SKU", target: "Variant SKU", ex: "SNOW-101", status: "Auto-matched" },
              { col: "Variant Price", target: "Variant Price", ex: "550.00", status: "Auto-matched" },
              { col: "Variant Compare At Price", target: "Compare-at Price", ex: "660.00", status: "Auto-matched" },
              { col: "Variant Inventory Qty", target: "Stock Quantity", ex: "55", status: "Auto-matched" },
            ].map((row, idx) => (
              <IndexTable.Row id={String(idx)} key={idx} position={idx}>
                <IndexTable.Cell><Text as="span" variant="bodyMd" fontWeight="semibold">{row.col}</Text></IndexTable.Cell>
                <IndexTable.Cell><Badge tone="info">{row.target}</Badge></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" variant="bodySm" tone="subdued">{row.ex}</Text></IndexTable.Cell>
                <IndexTable.Cell><Badge tone="success">{row.status}</Badge></IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}

// SCREEN 6: Audit Log & Job History
function ScreenJobs() {
  return (
    <Page
      title="Job History & Audit Trail"
      subtitle="Complete chronological timeline of bulk batch executions and catalog changes"
      primaryAction={{
        content: "Refresh Jobs",
      }}
    >
      <BlockStack gap="400">
        <Banner tone="success" title="All Background Jobs Running Smoothly">
          <p>Every bulk price update, inventory adjustment, and tag sync is logged with full details for compliance and accountability.</p>
        </Banner>

        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "job", plural: "jobs" }}
            itemCount={SAMPLE_JOBS.length}
            selectable={false}
            headings={[
              { title: "Operation / Action" },
              { title: "Status" },
              { title: "Products Affected" },
              { title: "Execution Summary" },
              { title: "Timestamp" },
            ]}
          >
            {SAMPLE_JOBS.map((job, index) => (
              <IndexTable.Row id={job.id} key={job.id} position={index}>
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {job.action}
                    </Text>
                    <Text as="span" variant="bodyXs" tone="subdued">
                      Batch ID: {job.id}-2026
                    </Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone="success">{job.status}</Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {job.productsAffected} products
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm">{job.details}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm" tone="subdued">{job.date}</Text>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}
