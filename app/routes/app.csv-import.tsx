import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  DropZone,
  IndexTable,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

interface ParsedRow {
  rowNumber: number;
  identifier: string;
  title: string | null;
  price: string | null;
  compareAtPrice: string | null;
  inventory: number | null;
  tags: string[] | null;
  vendor: string | null;
  productType: string | null;
  isValid: boolean;
  errors: string[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const rowsPayload = formData.get("rows");

  if (!rowsPayload || typeof rowsPayload !== "string") {
    return { success: false as const, error: "No CSV rows provided." };
  }

  try {
    const rows: ParsedRow[] = JSON.parse(rowsPayload);
    const validRows = rows.filter((r) => r.isValid);

    if (validRows.length === 0) {
      return { success: false as const, error: "No valid rows to process." };
    }

    let updatedProductsCount = 0;
    const errors: string[] = [];

    // Query primary location for inventory adjustments
    let primaryLocationId = "gid://shopify/Location/0";
    try {
      const locResponse = await admin.graphql(
        `#graphql
          query getPrimaryLocation {
            locations(first: 1) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        `,
      );
      const locJson = await locResponse.json();
      const queriedId = locJson.data?.locations?.edges?.[0]?.node?.id;
      if (queriedId) {
        primaryLocationId = queriedId;
      }
    } catch (locErr) {
      console.warn("[CsvImport] Could not fetch locations list, using fallback:", locErr);
    }

    for (const row of validRows) {
      // 1. Resolve product by handle, ID, or SKU
      const trimmedId = row.identifier.trim();
      let product: {
        id: string;
        title: string;
        tags: string[];
        vendor?: string;
        productType?: string;
        variants: {
          edges: Array<{
            node: {
              id: string;
              price: string;
              compareAtPrice?: string | null;
              inventoryItem?: {
                id: string;
                tracked: boolean;
                inventoryLevels?: {
                  edges?: Array<{
                    node: {
                      id: string;
                      location?: { id: string };
                    };
                  }>;
                };
              } | null;
            };
          }>;
        };
      } | null = null;

      try {
        if (trimmedId.startsWith("gid://shopify/Product/")) {
          const prodResponse = await admin.graphql(
            `#graphql
              query getProductById($id: ID!) {
                product(id: $id) {
                  id
                  title
                  tags
                  vendor
                  productType
                  variants(first: 25) {
                    edges {
                      node {
                        id
                        price
                        compareAtPrice
                        inventoryItem {
                          id
                          tracked
                          inventoryLevels(first: 5) {
                            edges {
                              node {
                                id
                                location { id }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            `,
            { variables: { id: trimmedId } },
          );
          const prodJson = await prodResponse.json();
          product = prodJson.data?.product || null;
        } else if (/^\d+$/.test(trimmedId)) {
          // Numeric product ID
          const gid = `gid://shopify/Product/${trimmedId}`;
          const prodResponse = await admin.graphql(
            `#graphql
              query getProductById($id: ID!) {
                product(id: $id) {
                  id
                  title
                  tags
                  vendor
                  productType
                  variants(first: 25) {
                    edges {
                      node {
                        id
                        price
                        compareAtPrice
                        inventoryItem {
                          id
                          tracked
                          inventoryLevels(first: 5) {
                            edges {
                              node {
                                id
                                location { id }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            `,
            { variables: { id: gid } },
          );
          const prodJson = await prodResponse.json();
          product = prodJson.data?.product || null;
        } else {
          // Try handle first using modern productByIdentifier
          const prodResponse = await admin.graphql(
            `#graphql
              query getProductByIdentifier($handle: String!) {
                productByIdentifier(identifier: { handle: $handle }) {
                  id
                  title
                  tags
                  vendor
                  productType
                  variants(first: 25) {
                    edges {
                      node {
                        id
                        price
                        compareAtPrice
                        inventoryItem {
                          id
                          tracked
                          inventoryLevels(first: 5) {
                            edges {
                              node {
                                id
                                location { id }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            `,
            { variables: { handle: trimmedId.toLowerCase() } },
          );
          const prodJson = await prodResponse.json();
          product = prodJson.data?.productByIdentifier || null;

          // If not found by handle, search by SKU
          if (!product) {
            const skuSearchResponse = await admin.graphql(
              `#graphql
                query searchProductBySku($query: String!) {
                  products(first: 1, query: $query) {
                    edges {
                      node {
                        id
                        title
                        tags
                        vendor
                        productType
                        variants(first: 25) {
                          edges {
                            node {
                              id
                              price
                              compareAtPrice
                              inventoryItem {
                                id
                                tracked
                                inventoryLevels(first: 5) {
                                  edges {
                                    node {
                                      id
                                      location { id }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              `,
              { variables: { query: `sku:${trimmedId}` } },
            );
            const skuJson = await skuSearchResponse.json();
            product = skuJson.data?.products?.edges?.[0]?.node || null;
          }
        }
      } catch (lookupErr: any) {
        errors.push(`Row ${row.rowNumber}: Lookup failed for "${trimmedId}": ${lookupErr.message}`);
        continue;
      }

      if (!product) {
        errors.push(`Row ${row.rowNumber}: Product "${trimmedId}" not found in store.`);
        continue;
      }

      // 2. Update Price and/or Compare-At Price if specified
      if (row.price !== null || row.compareAtPrice !== null) {
        const variantUpdates = product.variants.edges.map((e) => {
          const u: { id: string; price?: string; compareAtPrice?: string } = {
            id: e.node.id,
          };
          if (row.price !== null) u.price = row.price;
          if (row.compareAtPrice !== null) u.compareAtPrice = row.compareAtPrice;
          return u;
        });

        const priceResponse = await admin.graphql(
          `#graphql
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            variables: {
              productId: product.id,
              variants: variantUpdates,
            },
          },
        );
        const priceJson = await priceResponse.json();
        const priceErrors =
          priceJson.data?.productVariantsBulkUpdate?.userErrors || [];
        if (priceErrors.length > 0) {
          errors.push(
            `Row ${row.rowNumber} (Price): ${priceErrors.map((e: { message: string }) => e.message).join(", ")}`,
          );
        }
      }

      // 3. Update Inventory if specified (non-negative enforced)
      if (row.inventory !== null) {
        const safeInventory = Math.max(0, Math.floor(row.inventory));
        const inventoryItems = product.variants.edges
          .filter((e) => Boolean(e.node.inventoryItem?.id))
          .map((e) => {
            const item = e.node.inventoryItem!;
            const existingLevel = item.inventoryLevels?.edges?.[0]?.node;
            const locationId = existingLevel?.location?.id || primaryLocationId;
            return {
              inventoryItemId: item.id,
              locationId,
              quantity: safeInventory,
              tracked: item.tracked,
            };
          });

        for (const inv of inventoryItems) {
          if (!inv.tracked) {
            await admin.graphql(
              `#graphql
                mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
                  inventoryItemUpdate(id: $id, input: $input) {
                    userErrors { message }
                  }
                }
              `,
              { variables: { id: inv.inventoryItemId, input: { tracked: true } } },
            );
          }
        }

        if (inventoryItems.length > 0) {
          const invResponse = await admin.graphql(
            `#graphql
              mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
                inventorySetQuantities(input: $input) {
                  userErrors { message }
                }
              }
            `,
            {
              variables: {
                input: {
                  reason: "correction",
                  name: "available",
                  ignoreCompareQuantity: true,
                  quantities: inventoryItems.map((i) => ({
                    inventoryItemId: i.inventoryItemId,
                    locationId: i.locationId,
                    quantity: i.quantity,
                  })),
                },
              },
            },
          );
          const invJson = await invResponse.json();
          const invErrors =
            invJson.data?.inventorySetQuantities?.userErrors || [];
          if (invErrors.length > 0) {
            errors.push(
              `Row ${row.rowNumber} (Inventory): ${invErrors.map((e: { message: string }) => e.message).join(", ")}`,
            );
          }
        }
      }

      // 4. Update Product Details: Tags, Vendor, Product Type
      if (row.tags !== null || row.vendor !== null || row.productType !== null) {
        const input: { id: string; tags?: string[]; vendor?: string; productType?: string } = {
          id: product.id,
        };
        if (row.tags !== null) input.tags = row.tags;
        if (row.vendor !== null) input.vendor = row.vendor;
        if (row.productType !== null) input.productType = row.productType;

        const prodUpdateResponse = await admin.graphql(
          `#graphql
            mutation productUpdate($product: ProductUpdateInput!) {
              productUpdate(product: $product) {
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          { variables: { product: input } },
        );
        const prodUpdateJson = await prodUpdateResponse.json();
        const prodErrors = prodUpdateJson.data?.productUpdate?.userErrors || [];
        if (prodErrors.length > 0) {
          errors.push(
            `Row ${row.rowNumber} (Details): ${prodErrors.map((e: { message: string }) => e.message).join(", ")}`,
          );
        }
      }

      updatedProductsCount++;
    }

    // Record BulkJob in audit trail
    await db.bulkJob.create({
      data: {
        shop: session.shop,
        action: "CSV Import: Price, Inventory, Tags & Organization",
        status: errors.length > 0 && updatedProductsCount === 0 ? "FAILED" : "COMPLETED",
        productsAffected: updatedProductsCount,
        details: `Imported ${updatedProductsCount} products${errors.length > 0 ? ` (${errors.length} errors/notices)` : ""}`,
      },
    });

    return {
      success: true as const,
      updatedProductsCount,
      errors,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to import CSV.";
    await db.bulkJob.create({
      data: {
        shop: session.shop,
        action: "CSV Import",
        status: "FAILED",
        productsAffected: 0,
        details: message,
      },
    });
    return { success: false as const, error: message };
  }
};

function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[] = [];
  let currentLine = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const entries: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        entries.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    entries.push(current.trim());
    return entries;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map((h) => h.trim().toLowerCase());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    rows.push(row);
  }

  return { headers: rawHeaders, rows };
}

function validateAndParseRows(
  csvData: { headers: string[]; rows: Record<string, string>[] },
): { parsedRows: ParsedRow[]; globalError: string | null } {
  const normalizedHeaders = csvData.headers.map((h) => h.trim().toLowerCase());

  const hasIdentifier =
    normalizedHeaders.includes("handle") ||
    normalizedHeaders.includes("id") ||
    normalizedHeaders.includes("product id") ||
    normalizedHeaders.includes("product_id") ||
    normalizedHeaders.includes("sku");

  if (!hasIdentifier) {
    return {
      parsedRows: [],
      globalError:
        "CSV must contain a product identifier column ('Handle', 'ID', or 'SKU').",
    };
  }

  const hasSupportedField =
    normalizedHeaders.includes("price") ||
    normalizedHeaders.includes("compare at price") ||
    normalizedHeaders.includes("compare_at_price") ||
    normalizedHeaders.includes("compareatprice") ||
    normalizedHeaders.includes("inventory") ||
    normalizedHeaders.includes("quantity") ||
    normalizedHeaders.includes("stock") ||
    normalizedHeaders.includes("tags") ||
    normalizedHeaders.includes("vendor") ||
    normalizedHeaders.includes("product type") ||
    normalizedHeaders.includes("product_type") ||
    normalizedHeaders.includes("type");

  if (!hasSupportedField) {
    return {
      parsedRows: [],
      globalError:
        "CSV must contain at least one supported update column ('Price', 'Compare At Price', 'Inventory', 'Tags', 'Vendor', or 'Product Type').",
    };
  }

  const parsedRows: ParsedRow[] = csvData.rows.map((row, idx) => {
    const rowNumber = idx + 2; // 1-indexed plus header line
    const identifier =
      row.handle || row.id || row["product id"] || row.product_id || row.sku || "";

    const title = row.title || null;
    const errors: string[] = [];

    if (!identifier.trim()) {
      errors.push("Missing product identifier (Handle/ID/SKU).");
    }

    // Validate Price
    let price: string | null = null;
    if ("price" in row && row.price.trim() !== "") {
      const cleanPrice = row.price.replace(/[$,]/g, "").trim();
      const num = parseFloat(cleanPrice);
      if (isNaN(num) || num < 0) {
        errors.push("Price must be a valid non-negative number.");
      } else {
        price = num.toFixed(2);
      }
    }

    // Validate Compare At Price
    let compareAtPrice: string | null = null;
    const compareKey = Object.keys(row).find((k) =>
      ["compare at price", "compare_at_price", "compareatprice", "compare at"].includes(k.toLowerCase()),
    );
    if (compareKey && row[compareKey].trim() !== "") {
      const cleanCompare = row[compareKey].replace(/[$,]/g, "").trim();
      const num = parseFloat(cleanCompare);
      if (isNaN(num) || num < 0) {
        errors.push("Compare-At Price must be a valid non-negative number.");
      } else {
        compareAtPrice = num.toFixed(2);
      }
    }

    // Validate Inventory
    let inventory: number | null = null;
    const invKey = Object.keys(row).find((k) =>
      ["inventory", "quantity", "stock"].includes(k.toLowerCase()),
    );
    if (invKey && row[invKey].trim() !== "") {
      const num = parseInt(row[invKey].trim(), 10);
      if (isNaN(num) || num < 0) {
        errors.push("Inventory must be a valid non-negative integer.");
      } else {
        inventory = Math.max(0, num);
      }
    }

    // Validate Tags
    let tags: string[] | null = null;
    if ("tags" in row && row.tags.trim() !== "") {
      tags = row.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // Validate Vendor
    let vendor: string | null = null;
    if ("vendor" in row && row.vendor.trim() !== "") {
      vendor = row.vendor.trim();
    }

    // Validate Product Type
    let productType: string | null = null;
    const typeKey = Object.keys(row).find((k) =>
      ["product type", "product_type", "producttype", "type"].includes(k.toLowerCase()),
    );
    if (typeKey && row[typeKey].trim() !== "") {
      productType = row[typeKey].trim();
    }

    if (
      price === null &&
      compareAtPrice === null &&
      inventory === null &&
      tags === null &&
      vendor === null &&
      productType === null
    ) {
      errors.push("Row contains no values for Price, Compare-At, Inventory, Tags, Vendor, or Type.");
    }

    return {
      rowNumber,
      identifier,
      title,
      price,
      compareAtPrice,
      inventory,
      tags,
      vendor,
      productType,
      isValid: errors.length === 0,
      errors,
    };
  });

  return { parsedRows, globalError: null };
}

export default function CsvImportPage() {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const processCsvText = (text: string, name?: string) => {
    setCsvContent(text);
    if (name) setFileName(name);

    const parsed = parseCSVText(text);
    const { parsedRows: validatedRows, globalError } =
      validateAndParseRows(parsed);

    setValidationError(globalError);
    setParsedRows(validatedRows);
  };

  const handleDropZone = (
    _dropFiles: File[],
    acceptedFiles: File[],
    _rejectedFiles: File[],
  ) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processCsvText(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    const sample = `Handle,Title,SKU,Price,Compare At Price,Inventory,Tags,Vendor,Product Type
snowboard,All-Mountain Snowboard,BOARD-158,299.99,349.99,25,"winter, sports, outdoor",Apex Gear,Snowboards
classic-tee,Classic Cotton T-Shirt,TSHIRT-BLK-M,29.99,39.99,50,"apparel, summer, cotton",Acme Apparel,Clothing
wool-beanie,Merino Wool Beanie,BEANIE-GRY,18.50,24.00,40,"accessories, winter, warm",Nordic Knits,Accessories`;
    processCsvText(sample, "sample_catalog_update.csv");
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/app/template-csv";
    link.download = "catalog_update_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCatalog = () => {
    const link = document.createElement("a");
    link.href = "/app/export-csv";
    link.download = `catalog_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClear = () => {
    setFileName(null);
    setCsvContent("");
    setParsedRows([]);
    setValidationError(null);
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  const handleSubmitImport = () => {
    if (validRows.length === 0) return;
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("rows", JSON.stringify(validRows));
    submit(formData, { method: "post" });
  };

  const previewHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: "Row" },
    { title: "Identifier" },
    { title: "Price" },
    { title: "Compare-At" },
    { title: "Inventory" },
    { title: "Tags" },
    { title: "Vendor / Type" },
    { title: "Status" },
  ];

  return (
    <Page
      title="CSV Import & Export"
      subtitle="Upload bulk updates for prices, compare-at prices, inventory, tags, and organization, or export your store catalog"
      backAction={{ content: "Products", onAction: () => navigate("/app/products") }}
    >
      <BlockStack gap="400">
        {actionData?.success === true && (
          <Banner
            tone="success"
            title="CSV import completed successfully"
            action={{
              content: "View in Job History",
              onAction: () => navigate("/app/jobs"),
            }}
          >
            <p>
              Successfully updated {actionData.updatedProductsCount} products
              from your CSV upload.
            </p>
            {actionData.errors && actionData.errors.length > 0 && (
              <Box paddingBlockStart="200">
                <Text as="p" variant="bodySm" tone="critical">
                  Notes: {actionData.errors.join("; ")}
                </Text>
              </Box>
            )}
          </Banner>
        )}

        {actionData?.success === false && (
          <Banner tone="critical" title="CSV import failed">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {/* Upload Card */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center" wrap gap="300">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Upload CSV File
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Import updates for Price, Compare-At Price, Inventory, Tags, Vendor, and Product Type. File must include a Handle, ID, or SKU column.
                </Text>
              </BlockStack>
              <InlineStack gap="200" wrap>
                <Button onClick={handleDownloadTemplate} variant="secondary">
                  Download CSV Template
                </Button>
                <Button onClick={handleExportCatalog}>
                  Export Catalog CSV
                </Button>
                <Button onClick={handleLoadSample}>Load Sample Data</Button>
              </InlineStack>
            </InlineStack>

            <DropZone
              accept=".csv,text/csv"
              type="file"
              onDrop={handleDropZone}
            >
              <DropZone.FileUpload
                actionTitle={
                  fileName ? `Selected: ${fileName}` : "Add CSV file"
                }
                actionHint="or drop file to upload"
              />
            </DropZone>

            {/* Optional manual CSV paste input */}
            <TextField
              label="Or paste CSV text directly"
              value={csvContent}
              onChange={(val) => processCsvText(val, "pasted_input.csv")}
              multiline={4}
              autoComplete="off"
              placeholder={`Handle,Title,SKU,Price,Compare At Price,Inventory,Tags,Vendor,Product Type\nsnowboard,All-Mountain Snowboard,BOARD-158,299.99,349.99,25,"winter, sports",Apex Gear,Snowboards`}
            />

            {csvContent && (
              <InlineStack align="end">
                <Button onClick={handleClear}>Clear</Button>
              </InlineStack>
            )}
          </BlockStack>
        </Card>

        {/* Validation Error Banner */}
        {validationError && (
          <Banner tone="critical" title="CSV Validation Error">
            <p>{validationError}</p>
          </Banner>
        )}

        {/* Validation Summary Card */}
        {parsedRows.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center" wrap gap="300">
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Validation Summary
                    </Text>
                    <Badge tone={validRows.length > 0 ? "success" : undefined}>
                      {`${validRows.length} valid rows`}
                    </Badge>
                    {invalidRows.length > 0 && (
                      <Badge tone="critical">
                        {`${invalidRows.length} errors`}
                      </Badge>
                    )}
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Review parsed rows and error status before applying changes to your store
                  </Text>
                </BlockStack>

                <Button
                  variant="primary"
                  onClick={handleSubmitImport}
                  disabled={validRows.length === 0 || isSubmitting}
                  loading={isSubmitting}
                >
                  {`Import & Apply Changes (${validRows.length})`}
                </Button>
              </InlineStack>

              {invalidRows.length > 0 && (
                <Banner tone="warning">
                  <p>Some rows contain errors and will be skipped:</p>
                  <ul>
                    {invalidRows.slice(0, 5).map((row) => (
                      <li key={row.rowNumber}>
                        Row {row.rowNumber} ({row.identifier || "No ID"}):{" "}
                        {row.errors.join(", ")}
                      </li>
                    ))}
                  </ul>
                </Banner>
              )}

              {/* Preview Table */}
              <IndexTable
                resourceName={{ singular: "row", plural: "rows" }}
                itemCount={parsedRows.length}
                headings={previewHeadings}
                selectable={false}
              >
                {parsedRows.map((row, index) => (
                  <IndexTable.Row
                    id={String(row.rowNumber)}
                    key={row.rowNumber}
                    position={index}
                  >
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        #{row.rowNumber}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd">
                          {row.identifier || "—"}
                        </Text>
                        {row.title && (
                          <Text as="span" variant="bodySm" tone="subdued">
                            {row.title}
                          </Text>
                        )}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd">
                        {row.price ? `$${row.price}` : "—"}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd">
                        {row.compareAtPrice ? `$${row.compareAtPrice}` : "—"}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd">
                        {row.inventory !== null
                          ? `${row.inventory} in stock`
                          : "—"}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd">
                        {row.tags ? row.tags.join(", ") : "—"}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd">
                        {row.vendor || row.productType
                          ? `${row.vendor || ""}${row.vendor && row.productType ? " / " : ""}${row.productType || ""}`
                          : "—"}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {row.isValid ? (
                        <Badge tone="success">Valid</Badge>
                      ) : (
                        <Badge tone="critical">
                          {row.errors[0] || "Invalid"}
                        </Badge>
                      )}
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
