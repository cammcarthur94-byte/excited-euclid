import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigate,
  useSubmit,
} from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  IndexTable,
  InlineStack,
  Link,
  Modal,
  Page,
  Select,
  Tabs,
  Tag,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { ImageIcon, SearchIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const STORAGE_KEY = "catalog_commander_selected_products";
const TAB_MODES = [
  "price",
  "inventory",
  "status",
  "tags",
  "collections",
  "compare_at",
  "organization",
] as const;

export interface CollectionDetail {
  id: string;
  title: string;
  isAutomated: boolean;
}

export interface StoreCollectionItem {
  id: string;
  title: string;
  isAutomated: boolean;
}

interface InventoryLevelDetail {
  id: string;
  locationId: string;
  locationName: string;
  available: number;
}

interface VariantDetail {
  id: string;
  title: string;
  price: string;
  compareAtPrice: string | null;
  inventoryItemId: string | null;
  inventoryTracked: boolean;
  inventoryLevels: InventoryLevelDetail[];
}

interface ProductDetail {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  onlineStoreUrl: string | null;
  onlineStorePreviewUrl: string | null;
  featuredImage: {
    url: string;
    altText: string | null;
  } | null;
  collections: CollectionDetail[];
  variants: VariantDetail[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const idsParam = url.searchParams.get("ids");
  const modeParam = url.searchParams.get("mode") || "price";

  if (!idsParam) {
    return { products: [], mode: modeParam, storeCollections: [] as StoreCollectionItem[], shop: session.shop };
  }

  const ids = idsParam
    .split(",")
    .map((id) => decodeURIComponent(id.trim()))
    .filter(Boolean);

  if (ids.length === 0) {
    return { products: [], mode: modeParam, storeCollections: [] as StoreCollectionItem[], shop: session.shop };
  }

  // Query products and variant data in chunks of 250 to support unlimited products per batch
  const chunkSize = 250;
  const rawNodes: any[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunkIds = ids.slice(i, i + chunkSize);
    const response = await admin.graphql(
      `#graphql
        query getProductsByIds($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              handle
              status
              vendor
              productType
              tags
              onlineStoreUrl
              onlineStorePreviewUrl
              featuredImage {
                url
                altText
              }
              collections(first: 50) {
                edges {
                  node {
                    id
                    title
                    ruleSet {
                      appliedDisjunctively
                    }
                  }
                }
              }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    price
                    compareAtPrice
                    inventoryItem {
                      id
                      tracked
                      inventoryLevels(first: 10) {
                        edges {
                          node {
                            id
                            location {
                              id
                              name
                            }
                            quantities(names: ["available"]) {
                              name
                              quantity
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
      { variables: { ids: chunkIds } },
    );
    const responseJson = await response.json();
    const fetchedNodes = responseJson.data?.nodes || [];
    rawNodes.push(...fetchedNodes.filter(Boolean));
  }

  // Gracefully fetch store locations if granted, with fallback
  let fallbackLocation = {
    id: "gid://shopify/Location/0",
    name: "Primary Location",
  };

  try {
    const locRes = await admin.graphql(
      `#graphql
        query getStoreLocations {
          locations(first: 5) {
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
    const locJson = await locRes.json();
    const firstLoc = locJson.data?.locations?.edges?.[0]?.node;
    if (firstLoc) {
      fallbackLocation = firstLoc;
    }
  } catch (locErr) {
    // If read_locations is not yet granted or store has restricted location access,
    // fallback location is used smoothly without crashing price edits
    console.warn("[BulkEdit] Could not fetch locations list, using fallback:", locErr);
  }

  // Gracefully fetch store collections with fallback
  let storeCollections: StoreCollectionItem[] = [];
  try {
    const colRes = await admin.graphql(
      `#graphql
        query getStoreCollections {
          collections(first: 100, sortKey: TITLE) {
            edges {
              node {
                id
                title
                ruleSet {
                  appliedDisjunctively
                }
              }
            }
          }
        }
      `,
    );
    const colJson = await colRes.json();
    const edges = colJson.data?.collections?.edges || [];
    storeCollections = edges.map(
      (e: {
        node: {
          id: string;
          title: string;
          ruleSet?: { appliedDisjunctively?: boolean } | null;
        };
      }) => ({
        id: e.node.id,
        title: e.node.title,
        isAutomated: Boolean(e.node.ruleSet),
      }),
    );
  } catch (colErr) {
    console.warn("[BulkEdit] Could not fetch store collections list:", colErr);
  }

  interface RawLevelNode {
    id: string;
    location?: { id: string; name: string };
    quantities?: Array<{ name: string; quantity: number }>;
  }

  interface RawVariantNode {
    id: string;
    title: string;
    price: string;
    compareAtPrice: string | null;
    inventoryItem?: {
      id: string;
      tracked: boolean;
      inventoryLevels?: {
        edges?: Array<{ node: RawLevelNode }>;
      };
    } | null;
  }

  interface RawCollectionNode {
    id: string;
    title: string;
    ruleSet?: { appliedDisjunctively?: boolean } | null;
  }

  interface RawProductNode {
    id: string;
    title: string;
    handle?: string;
    status?: string;
    vendor?: string;
    productType?: string;
    tags?: string[];
    onlineStoreUrl?: string | null;
    onlineStorePreviewUrl?: string | null;
    featuredImage?: { url: string; altText: string | null } | null;
    collections?: {
      edges?: Array<{ node: RawCollectionNode }>;
    };
    variants?: {
      edges?: Array<{ node: RawVariantNode }>;
    };
  }

  const products: ProductDetail[] = ((rawNodes as unknown[]) || [])
    .filter(
      (node): node is RawProductNode =>
        Boolean(node && typeof node === "object" && "id" in node),
    )
    .map((node) => ({
      id: node.id,
      title: node.title,
      handle: node.handle || "",
      status: node.status || "ACTIVE",
      vendor: node.vendor || "",
      productType: node.productType || "",
      tags: Array.isArray(node.tags) ? node.tags : [],
      onlineStoreUrl: node.onlineStoreUrl || null,
      onlineStorePreviewUrl: node.onlineStorePreviewUrl || null,
      featuredImage: node.featuredImage || null,
      collections:
        node.collections?.edges?.map((edge) => ({
          id: edge.node.id,
          title: edge.node.title,
          isAutomated: Boolean(edge.node.ruleSet),
        })) || [],
      variants:
        node.variants?.edges?.map((edge) => {
          const v = edge.node;
          const levels: InventoryLevelDetail[] =
            v.inventoryItem?.inventoryLevels?.edges?.map((lvl) => {
              const availableQty =
                lvl.node.quantities?.find((q) => q.name === "available")
                  ?.quantity ?? 0;
              return {
                id: lvl.node.id,
                locationId: lvl.node.location?.id || fallbackLocation.id,
                locationName: lvl.node.location?.name || fallbackLocation.name,
                available: availableQty,
              };
            }) || [];

          // If no levels exist yet, add a baseline level with the store's primary location
          if (levels.length === 0 && v.inventoryItem) {
            levels.push({
              id: `${v.inventoryItem.id}-default`,
              locationId: fallbackLocation.id,
              locationName: fallbackLocation.name,
              available: 0,
            });
          }

          return {
            id: v.id,
            title: v.title,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            inventoryItemId: v.inventoryItem?.id || null,
            inventoryTracked: v.inventoryItem?.tracked ?? true,
            inventoryLevels: levels,
          };
        }) || [],
    }));

  return { products, mode: modeParam, storeCollections, shop: session.shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const strategyLabel = String(formData.get("strategyLabel") || "Bulk Update");
  const productCount = Number(formData.get("productCount")) || 0;

  if (actionType === "inventory") {
    const inventoryUpdatesPayload = formData.get("inventoryUpdates");
    if (
      !inventoryUpdatesPayload ||
      typeof inventoryUpdatesPayload !== "string"
    ) {
      return {
        success: false as const,
        error: "No inventory update payload provided.",
      };
    }

    try {
      const updates: Array<{
        inventoryItemId: string;
        locationId: string;
        quantity: number;
        tracked: boolean;
      }> = JSON.parse(inventoryUpdatesPayload);

      if (updates.length === 0) {
        return {
          success: false as const,
          error: "No valid inventory items to update.",
        };
      }

      // 1. Ensure any untracked inventory items are enabled for tracking
      for (const item of updates) {
        if (!item.tracked) {
          await admin.graphql(
            `#graphql
              mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
                inventoryItemUpdate(id: $id, input: $input) {
                  inventoryItem {
                    id
                    tracked
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            {
              variables: {
                id: item.inventoryItemId,
                input: { tracked: true },
              },
            },
          );
        }
      }

      // 2. Set the quantities using inventorySetQuantities
      // Enforce Math.max(0, quantity) on the server as well
      const quantitiesInput = updates.map((u) => ({
        inventoryItemId: u.inventoryItemId,
        locationId: u.locationId,
        quantity: Math.max(0, Math.floor(u.quantity)),
      }));

      const setResponse = await admin.graphql(
        `#graphql
          mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
            inventorySetQuantities(input: $input) {
              inventoryAdjustmentGroup {
                createdAt
                reason
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          variables: {
            input: {
              reason: "correction",
              name: "available",
              ignoreCompareQuantity: true,
              quantities: quantitiesInput,
            },
          },
        },
      );

      const setJson = await setResponse.json();
      const userErrors =
        setJson.data?.inventorySetQuantities?.userErrors || [];

      if (userErrors.length > 0) {
        const errorMessages = userErrors.map(
          (err: { message: string }) => err.message,
        );
        await db.bulkJob.create({
          data: {
            shop: session.shop,
            action: `Inventory Adjustment: ${strategyLabel}`,
            status: "FAILED",
            productsAffected: productCount || updates.length,
            details: errorMessages.join(", "),
          },
        });
        return {
          success: false as const,
          error: errorMessages.join(", "),
        };
      }

      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Inventory Adjustment: ${strategyLabel}`,
          status: "COMPLETED",
          productsAffected: productCount || updates.length,
          details: `${updates.length} stock levels updated`,
        },
      });

      return {
        success: true as const,
        updatedType: "inventory" as const,
        updatedCount: updates.length,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update inventory.";
      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Inventory Adjustment: ${strategyLabel}`,
          status: "FAILED",
          productsAffected: productCount,
          details: message,
        },
      });
      return { success: false as const, error: message };
    }
  }

  // Action: Status updates
  if (actionType === "status") {
    const statusUpdatesPayload = formData.get("statusUpdates");
    if (!statusUpdatesPayload || typeof statusUpdatesPayload !== "string") {
      return {
        success: false as const,
        error: "No status update payload provided.",
      };
    }

    try {
      const updates: Array<{ productId: string; status: string }> =
        JSON.parse(statusUpdatesPayload);

      const errors: string[] = [];
      let updatedCount = 0;

      for (const update of updates) {
        const response = await admin.graphql(
          `#graphql
            mutation updateProductStatus($product: ProductUpdateInput!) {
              productUpdate(product: $product) {
                product {
                  id
                  status
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            variables: {
              product: {
                id: update.productId,
                status: update.status,
              },
            },
          },
        );

        const json = await response.json();
        const userErrors = json.data?.productUpdate?.userErrors || [];
        if (userErrors.length > 0) {
          for (const err of userErrors) {
            errors.push(err.message);
          }
        } else {
          updatedCount++;
        }
      }

      if (errors.length > 0) {
        await db.bulkJob.create({
          data: {
            shop: session.shop,
            action: `Status Update: ${strategyLabel}`,
            status: "FAILED",
            productsAffected: productCount || updates.length,
            details: errors.join(", "),
          },
        });
        return {
          success: false as const,
          error: errors.join(", "),
        };
      }

      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Status Update: ${strategyLabel}`,
          status: "COMPLETED",
          productsAffected: productCount || updates.length,
          details: `${updatedCount} products updated to ${strategyLabel}`,
        },
      });

      return {
        success: true as const,
        updatedType: "status" as const,
        updatedCount,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update product status.";
      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Status Update: ${strategyLabel}`,
          status: "FAILED",
          productsAffected: productCount,
          details: message,
        },
      });
      return { success: false as const, error: message };
    }
  }

  // Action: Tag updates
  if (actionType === "tags") {
    const tagUpdatesPayload = formData.get("tagUpdates");
    if (!tagUpdatesPayload || typeof tagUpdatesPayload !== "string") {
      return {
        success: false as const,
        error: "No tag update payload provided.",
      };
    }

    try {
      const updates: Array<{ productId: string; tags: string[] }> =
        JSON.parse(tagUpdatesPayload);

      const errors: string[] = [];
      let updatedCount = 0;

      for (const update of updates) {
        const response = await admin.graphql(
          `#graphql
            mutation updateProductTags($product: ProductUpdateInput!) {
              productUpdate(product: $product) {
                product {
                  id
                  tags
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            variables: {
              product: {
                id: update.productId,
                tags: update.tags,
              },
            },
          },
        );

        const json = await response.json();
        const userErrors = json.data?.productUpdate?.userErrors || [];
        if (userErrors.length > 0) {
          for (const err of userErrors) {
            errors.push(err.message);
          }
        } else {
          updatedCount++;
        }
      }

      if (errors.length > 0) {
        await db.bulkJob.create({
          data: {
            shop: session.shop,
            action: `Tag Management: ${strategyLabel}`,
            status: "FAILED",
            productsAffected: productCount || updates.length,
            details: errors.join(", "),
          },
        });
        return {
          success: false as const,
          error: errors.join(", "),
        };
      }

      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Tag Management: ${strategyLabel}`,
          status: "COMPLETED",
          productsAffected: productCount || updates.length,
          details: `${updatedCount} products updated (${strategyLabel})`,
        },
      });

      return {
        success: true as const,
        updatedType: "tags" as const,
        updatedCount,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update tags.";
      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Tag Management: ${strategyLabel}`,
          status: "FAILED",
          productsAffected: productCount,
          details: message,
        },
      });
      return { success: false as const, error: message };
    }
  }

  // Action: Collections management
  if (actionType === "collections") {
    const collectionAction = String(formData.get("collectionAction") || "add");
    const targetCollectionIdsPayload = formData.get("targetCollectionIds");
    const replacePayload = formData.get("replacePayload");
    const errors: string[] = [];
    let updatedProductsCount = 0;

    try {
      if (collectionAction === "add") {
        if (!targetCollectionIdsPayload || typeof targetCollectionIdsPayload !== "string") {
          return { success: false as const, error: "No target collections selected." };
        }
        const targetCollectionIds: string[] = JSON.parse(targetCollectionIdsPayload);
        const productIdsPayload = formData.get("productIds");
        if (!productIdsPayload || typeof productIdsPayload !== "string") {
          return { success: false as const, error: "No products provided for collection update." };
        }
        const productIds: string[] = JSON.parse(productIdsPayload);

        if (targetCollectionIds.length === 0) {
          return { success: false as const, error: "Please select at least one collection to add products to." };
        }

        for (const colId of targetCollectionIds) {
          const res = await admin.graphql(
            `#graphql
              mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
                collectionAddProducts(id: $id, productIds: $productIds) {
                  collection {
                    id
                    title
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            { variables: { id: colId, productIds } },
          );
          const resJson = await res.json();
          const userErrors = resJson.data?.collectionAddProducts?.userErrors || [];
          if (userErrors.length > 0) {
            for (const err of userErrors) {
              errors.push(err.message);
            }
          }
        }
        updatedProductsCount = productIds.length;
      } else if (collectionAction === "remove") {
        if (!targetCollectionIdsPayload || typeof targetCollectionIdsPayload !== "string") {
          return { success: false as const, error: "No target collections selected." };
        }
        const targetCollectionIds: string[] = JSON.parse(targetCollectionIdsPayload);
        const productIdsPayload = formData.get("productIds");
        if (!productIdsPayload || typeof productIdsPayload !== "string") {
          return { success: false as const, error: "No products provided for collection update." };
        }
        const productIds: string[] = JSON.parse(productIdsPayload);

        if (targetCollectionIds.length === 0) {
          return { success: false as const, error: "Please select at least one collection to remove products from." };
        }

        for (const colId of targetCollectionIds) {
          const res = await admin.graphql(
            `#graphql
              mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
                collectionRemoveProducts(id: $id, productIds: $productIds) {
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            { variables: { id: colId, productIds } },
          );
          const resJson = await res.json();
          const userErrors = resJson.data?.collectionRemoveProducts?.userErrors || [];
          if (userErrors.length > 0) {
            for (const err of userErrors) {
              errors.push(err.message);
            }
          }
        }
        updatedProductsCount = productIds.length;
      } else if (collectionAction === "replace") {
        if (!replacePayload || typeof replacePayload !== "string") {
          return { success: false as const, error: "No replacement assignments provided." };
        }
        const replaceItems: Array<{
          productId: string;
          additions: string[];
          removals: string[];
        }> = JSON.parse(replacePayload);

        const removalsByCollection = new Map<string, string[]>();
        const additionsByCollection = new Map<string, string[]>();

        for (const item of replaceItems) {
          for (const remColId of item.removals) {
            if (!removalsByCollection.has(remColId)) removalsByCollection.set(remColId, []);
            removalsByCollection.get(remColId)!.push(item.productId);
          }
          for (const addColId of item.additions) {
            if (!additionsByCollection.has(addColId)) additionsByCollection.set(addColId, []);
            additionsByCollection.get(addColId)!.push(item.productId);
          }
        }

        for (const [colId, pIds] of removalsByCollection.entries()) {
          const res = await admin.graphql(
            `#graphql
              mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
                collectionRemoveProducts(id: $id, productIds: $productIds) {
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            { variables: { id: colId, productIds: pIds } },
          );
          const resJson = await res.json();
          const userErrors = resJson.data?.collectionRemoveProducts?.userErrors || [];
          if (userErrors.length > 0) {
            for (const err of userErrors) {
              errors.push(err.message);
            }
          }
        }

        for (const [colId, pIds] of additionsByCollection.entries()) {
          const res = await admin.graphql(
            `#graphql
              mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
                collectionAddProducts(id: $id, productIds: $productIds) {
                  collection {
                    id
                    title
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            { variables: { id: colId, productIds: pIds } },
          );
          const resJson = await res.json();
          const userErrors = resJson.data?.collectionAddProducts?.userErrors || [];
          if (userErrors.length > 0) {
            for (const err of userErrors) {
              errors.push(err.message);
            }
          }
        }
        updatedProductsCount = replaceItems.length;
      }

      if (errors.length > 0) {
        await db.bulkJob.create({
          data: {
            shop: session.shop,
            action: `Collections Management: ${strategyLabel}`,
            status: "FAILED",
            productsAffected: productCount || updatedProductsCount,
            details: errors.join(", "),
          },
        });
        return {
          success: false as const,
          error: errors.join(", "),
        };
      }

      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Collections Management: ${strategyLabel}`,
          status: "COMPLETED",
          productsAffected: productCount || updatedProductsCount,
          details: `${updatedProductsCount} products updated (${strategyLabel})`,
        },
      });

      return {
        success: true as const,
        updatedType: "collections" as const,
        updatedCount: updatedProductsCount,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update collections.";
      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Collections Management: ${strategyLabel}`,
          status: "FAILED",
          productsAffected: productCount,
          details: message,
        },
      });
      return { success: false as const, error: message };
    }
  }

  // Action: Compare-at Price updates
  if (actionType === "compare_at") {
    const compareAtPayload = formData.get("compareAtUpdates");
    if (!compareAtPayload || typeof compareAtPayload !== "string") {
      return {
        success: false as const,
        error: "No compare-at price update payload provided.",
      };
    }

    try {
      const updates: Array<{
        productId: string;
        variants: Array<{ id: string; compareAtPrice: string | null }>;
      }> = JSON.parse(compareAtPayload);

      const errors: string[] = [];
      let updatedVariantsCount = 0;

      for (const update of updates) {
        const response = await admin.graphql(
          `#graphql
            mutation bulkUpdateCompareAtPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  compareAtPrice
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            variables: {
              productId: update.productId,
              variants: update.variants,
            },
          },
        );

        const json = await response.json();
        const userErrors =
          json.data?.productVariantsBulkUpdate?.userErrors || [];
        if (userErrors.length > 0) {
          for (const err of userErrors) {
            errors.push(err.message);
          }
        } else {
          updatedVariantsCount +=
            json.data?.productVariantsBulkUpdate?.productVariants?.length || 0;
        }
      }

      if (errors.length > 0) {
        await db.bulkJob.create({
          data: {
            shop: session.shop,
            action: `Compare-at Price: ${strategyLabel}`,
            status: "FAILED",
            productsAffected: updates.length,
            details: errors.join(", "),
          },
        });
        return {
          success: false as const,
          error: errors.join(", "),
        };
      }

      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Compare-at Price: ${strategyLabel}`,
          status: "COMPLETED",
          productsAffected: updates.length,
          details: `${updatedVariantsCount} variants updated (${strategyLabel})`,
        },
      });

      return {
        success: true as const,
        updatedType: "compare_at" as const,
        updatedVariantsCount,
        updatedProductsCount: updates.length,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update compare-at prices.";
      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Compare-at Price: ${strategyLabel}`,
          status: "FAILED",
          productsAffected: productCount || 0,
          details: message,
        },
      });
      return { success: false as const, error: message };
    }
  }

  // Action: Vendor and Product Type updates
  if (actionType === "organization") {
    const orgPayload = formData.get("organizationUpdates");
    if (!orgPayload || typeof orgPayload !== "string") {
      return {
        success: false as const,
        error: "No organization update payload provided.",
      };
    }

    try {
      const updates: Array<{
        productId: string;
        vendor?: string;
        productType?: string;
      }> = JSON.parse(orgPayload);

      const errors: string[] = [];
      let updatedCount = 0;

      for (const update of updates) {
        const input: { id: string; vendor?: string; productType?: string } = {
          id: update.productId,
        };
        if (update.vendor !== undefined) {
          input.vendor = update.vendor;
        }
        if (update.productType !== undefined) {
          input.productType = update.productType;
        }

        const response = await admin.graphql(
          `#graphql
            mutation updateProductOrganization($product: ProductUpdateInput!) {
              productUpdate(product: $product) {
                product {
                  id
                  vendor
                  productType
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            variables: { product: input },
          },
        );

        const json = await response.json();
        const userErrors = json.data?.productUpdate?.userErrors || [];
        if (userErrors.length > 0) {
          for (const err of userErrors) {
            errors.push(err.message);
          }
        } else {
          updatedCount++;
        }
      }

      if (errors.length > 0) {
        await db.bulkJob.create({
          data: {
            shop: session.shop,
            action: `Organization Update: ${strategyLabel}`,
            status: "FAILED",
            productsAffected: productCount || updates.length,
            details: errors.join(", "),
          },
        });
        return {
          success: false as const,
          error: errors.join(", "),
        };
      }

      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Organization Update: ${strategyLabel}`,
          status: "COMPLETED",
          productsAffected: productCount || updates.length,
          details: `${updatedCount} products updated (${strategyLabel})`,
        },
      });

      return {
        success: true as const,
        updatedType: "organization" as const,
        updatedCount,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update vendor and product type.";
      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Organization Update: ${strategyLabel}`,
          status: "FAILED",
          productsAffected: productCount,
          details: message,
        },
      });
      return { success: false as const, error: message };
    }
  }

  // Default: Price updates
  const updatesPayload = formData.get("updates");
  if (!updatesPayload || typeof updatesPayload !== "string") {
    return {
      success: false as const,
      error: "No price update payload provided.",
    };
  }

  try {
    const updates: Array<{
      productId: string;
      variants: Array<{ id: string; price: string }>;
    }> = JSON.parse(updatesPayload);

    if (!Array.isArray(updates) || updates.length === 0) {
      return {
        success: false as const,
        error: "No variant price changes were detected to submit.",
      };
    }

    const errors: string[] = [];
    let updatedVariantsCount = 0;

    for (const update of updates) {
      // Ensure variant prices are properly formatted strings with 2 decimal places
      const formattedVariants = (update.variants || []).map((v) => {
        const num = parseFloat(String(v.price));
        return {
          id: v.id,
          price: isNaN(num) ? "0.00" : Math.max(0, num).toFixed(2),
        };
      });

      if (formattedVariants.length === 0) continue;

      const response = await admin.graphql(
        `#graphql
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants {
                id
                price
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          variables: {
            productId: update.productId,
            variants: formattedVariants,
          },
        },
      );

      const json = await response.json();

      // Check for top-level GraphQL syntax/server errors
      if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
        for (const err of json.errors) {
          errors.push(err.message || "GraphQL request failed");
        }
        continue;
      }

      const userErrors =
        json.data?.productVariantsBulkUpdate?.userErrors || [];
      if (userErrors.length > 0) {
        for (const err of userErrors) {
          errors.push(err.message);
        }
      } else {
        updatedVariantsCount +=
          json.data?.productVariantsBulkUpdate?.productVariants?.length || 0;
      }
    }

    if (errors.length > 0) {
      const errorMsg = errors.join(", ");
      await db.bulkJob.create({
        data: {
          shop: session.shop,
          action: `Price Adjustment: ${strategyLabel}`,
          status: "FAILED",
          productsAffected: updates.length,
          details: errorMsg,
        },
      });
      return {
        success: false as const,
        error: errorMsg,
      };
    }

    await db.bulkJob.create({
      data: {
        shop: session.shop,
        action: `Price Adjustment: ${strategyLabel}`,
        status: "COMPLETED",
        productsAffected: updates.length,
        details: `${updatedVariantsCount} variants updated`,
      },
    });

    return {
      success: true as const,
      updatedType: "price" as const,
      updatedVariantsCount,
      updatedProductsCount: updates.length,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update prices.";
    await db.bulkJob.create({
      data: {
        shop: session.shop,
        action: `Price Adjustment: ${strategyLabel}`,
        status: "FAILED",
        productsAffected: productCount || 0,
        details: message,
      },
    });
    return { success: false as const, error: message };
  }
};

function computeNewPrice(
  currentPriceNum: number,
  strategy: string,
  valueNum: number,
): number {
  let newPrice = currentPriceNum;
  switch (strategy) {
    case "increase_fixed":
      newPrice = currentPriceNum + valueNum;
      break;
    case "decrease_fixed":
      newPrice = Math.max(0, currentPriceNum - valueNum);
      break;
    case "increase_percent":
      newPrice = currentPriceNum * (1 + valueNum / 100);
      break;
    case "decrease_percent":
      newPrice = Math.max(0, currentPriceNum * (1 - valueNum / 100));
      break;
    case "set_exact":
      newPrice = Math.max(0, valueNum);
      break;
    default:
      newPrice = currentPriceNum;
  }
  return Number(newPrice.toFixed(2));
}

function computeNewInventory(
  currentQty: number,
  strategy: string,
  amount: number,
): number {
  let newQty = currentQty;
  switch (strategy) {
    case "add":
      newQty = currentQty + amount;
      break;
    case "remove":
      newQty = currentQty - amount;
      break;
    case "set_exact":
      newQty = amount;
      break;
    default:
      newQty = currentQty;
  }
  // Prevent negative inventory
  return Math.max(0, Math.floor(newQty));
}

function computeNewCompareAt(
  currentCompareAtNum: number | null,
  currentPriceNum: number,
  strategy: string,
  valueNum: number,
): number | null {
  if (strategy === "clear") {
    return null;
  }

  if (strategy === "set_exact") {
    return Number(Math.max(0, valueNum).toFixed(2));
  }

  const base =
    currentCompareAtNum !== null && currentCompareAtNum > 0
      ? currentCompareAtNum
      : currentPriceNum;

  let newPrice = base;
  switch (strategy) {
    case "increase_fixed":
      newPrice = base + valueNum;
      break;
    case "decrease_fixed":
      newPrice = Math.max(0, base - valueNum);
      break;
    case "increase_percent":
      newPrice = base * (1 + valueNum / 100);
      break;
    case "decrease_percent":
      newPrice = Math.max(0, base * (1 - valueNum / 100));
      break;
    default:
      newPrice = base;
  }
  return Number(newPrice.toFixed(2));
}

function PreviewToolbar({
  search,
  onSearchChange,
  filterOnlyChanged,
  onFilterOnlyChangedChange,
  totalCount,
  changedCount,
  itemLabel = "items",
}: {
  search: string;
  onSearchChange: (val: string) => void;
  filterOnlyChanged: boolean;
  onFilterOnlyChangedChange: (val: boolean) => void;
  totalCount: number;
  changedCount: number;
  itemLabel?: string;
}) {
  return (
    <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
      <div style={{ flex: 1, minWidth: "240px", maxWidth: "380px" }}>
        <TextField
          label={`Filter ${itemLabel}`}
          labelHidden
          placeholder={`Search ${itemLabel}...`}
          prefix={<Icon source={SearchIcon} />}
          value={search}
          onChange={onSearchChange}
          clearButton
          onClearButtonClick={() => onSearchChange("")}
          autoComplete="off"
        />
      </div>
      <InlineStack gap="200" blockAlign="center">
        <Button
          size="slim"
          pressed={!filterOnlyChanged}
          onClick={() => onFilterOnlyChangedChange(false)}
        >
          {`All (${totalCount})`}
        </Button>
        <Button
          size="slim"
          pressed={filterOnlyChanged}
          onClick={() => onFilterOnlyChangedChange(true)}
        >
          {`Modified only (${changedCount})`}
        </Button>
      </InlineStack>
    </InlineStack>
  );
}

function PreviewFooterBar({
  showingCount,
  totalCount,
  changedCount,
  itemLabel = "items",
  actionLabel,
  onAction,
  disabled = false,
}: {
  showingCount: number;
  totalCount: number;
  changedCount: number;
  itemLabel?: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <BlockStack gap="200">
      <Divider />
      <Box paddingBlockStart="100">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <Text as="span" variant="bodySm" tone="subdued">
            {`Showing ${showingCount} of ${totalCount} ${itemLabel} • ${changedCount} will be updated`}
          </Text>
          <Button
            variant="primary"
            onClick={onAction}
            disabled={disabled || changedCount === 0}
          >
            {actionLabel}
          </Button>
        </InlineStack>
      </Box>
    </BlockStack>
  );
}

function PreviewEmptyFilter({ onClear }: { onClear: () => void }) {
  return (
    <Box padding="600">
      <BlockStack align="center" inlineAlign="center" gap="200">
        <Text as="p" tone="subdued" variant="bodyMd">
          No items match the current search or filter criteria.
        </Text>
        <Button size="slim" onClick={onClear}>
          Clear filters
        </Button>
      </BlockStack>
    </Box>
  );
}

export default function BulkEditPage() {
  const { products, mode, storeCollections = [], shop = "" } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  // Tab mode: 0 for Price, 1 for Inventory, 2 for Status, 3 for Tags, 4 for Collections, 5 for Compare-at, 6 for Organization
  const initialTabIndex = TAB_MODES.indexOf(mode as (typeof TAB_MODES)[number]);
  const initialTab = initialTabIndex >= 0 ? initialTabIndex : 0;
  const [selectedTab, setSelectedTab] = useState(initialTab);

  // Price adjustment state - defaults to empty so table starts with 0 pending changes cleanly
  const [priceStrategy, setPriceStrategy] = useState("increase_percent");
  const [priceValue, setPriceValue] = useState("");
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [manualPriceOverrides, setManualPriceOverrides] = useState<
    Record<string, string>
  >({});

  // Inventory adjustment state
  const [inventoryStrategy, setInventoryStrategy] = useState("add");
  const [inventoryValue, setInventoryValue] = useState("");
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [manualInventoryOverrides, setManualInventoryOverrides] = useState<
    Record<string, string>
  >({});

  // Product Status state
  const [targetStatus, setTargetStatus] = useState<"ACTIVE" | "DRAFT" | "ARCHIVED">("ACTIVE");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [manualStatusOverrides, setManualStatusOverrides] = useState<
    Record<string, "ACTIVE" | "DRAFT" | "ARCHIVED">
  >({});

  // Tag Management state
  const [tagAction, setTagAction] = useState<"add" | "remove" | "replace">("add");
  const [tagInput, setTagInput] = useState("");
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [manualTagInputs, setManualTagInputs] = useState<
    Record<string, string>
  >({});

  // Collections Management state
  const [collectionAction, setCollectionAction] = useState<"add" | "remove" | "replace">("add");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);

  // Compare-at Price Management state
  const [compareAtStrategy, setCompareAtStrategy] = useState("set_exact");
  const [compareAtValue, setCompareAtValue] = useState("");
  const [isCompareAtModalOpen, setIsCompareAtModalOpen] = useState(false);
  const [manualCompareAtOverrides, setManualCompareAtOverrides] = useState<
    Record<string, string>
  >({});

  // Vendor & Product Type Management state
  const [orgStrategy, setOrgStrategy] = useState<"both" | "vendor_only" | "type_only">("both");
  const [targetVendor, setTargetVendor] = useState("");
  const [targetProductType, setTargetProductType] = useState("");
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [manualOrgOverrides, setManualOrgOverrides] = useState<
    Record<string, { vendor?: string; productType?: string }>
  >({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");
  const [filterOnlyChanged, setFilterOnlyChanged] = useState(false);

  const handleTabChange = (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    setPreviewSearch("");
    setFilterOnlyChanged(false);
  };

  // If navigated without ?ids in URL, load from sessionStorage
  useEffect(() => {
    if (products.length === 0) {
      try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            navigate(
              `?mode=${TAB_MODES[selectedTab] || "price"}&ids=${encodeURIComponent(parsed.join(","))}`,
              { replace: true },
            );
          }
        }
      } catch {
        // ignore
      }
    }
  }, [products.length, navigate, selectedTab]);

  useEffect(() => {
    if (actionData) {
      setIsSubmitting(false);
      setIsPriceModalOpen(false);
      setIsInventoryModalOpen(false);
      setIsStatusModalOpen(false);
      setIsTagModalOpen(false);
      setIsCollectionModalOpen(false);
      setIsCompareAtModalOpen(false);
      setIsOrgModalOpen(false);
      if (actionData.success) {
        // Reset inputs and overrides upon success so the UI displays 0 pending changes cleanly
        setPriceValue("");
        setInventoryValue("");
        setCompareAtValue("");
        setTagInput("");
        setTargetVendor("");
        setTargetProductType("");
        setManualPriceOverrides({});
        setManualInventoryOverrides({});
        setManualStatusOverrides({});
        setManualTagInputs({});
        setSelectedCollectionIds([]);
        setManualCompareAtOverrides({});
        setManualOrgOverrides({});
      }
    }
  }, [actionData]);

  const priceStrategyOptions = [
    { label: "Increase price ($)", value: "increase_fixed" },
    { label: "Decrease price ($)", value: "decrease_fixed" },
    { label: "Percentage increase (%)", value: "increase_percent" },
    { label: "Percentage decrease (%)", value: "decrease_percent" },
    { label: "Set exact price ($)", value: "set_exact" },
  ];

  const currentPriceStrategyLabel =
    priceStrategyOptions.find((o) => o.value === priceStrategy)?.label ||
    priceStrategy;

  const inventoryStrategyOptions = [
    { label: "Add inventory (+)", value: "add" },
    { label: "Remove inventory (-)", value: "remove" },
    { label: "Set exact inventory (=)", value: "set_exact" },
  ];

  const currentInventoryStrategyLabel =
    inventoryStrategyOptions.find((o) => o.value === inventoryStrategy)
      ?.label || inventoryStrategy;

  const isPriceInputValid =
    priceValue.trim() !== "" &&
    !isNaN(parseFloat(priceValue)) &&
    parseFloat(priceValue) >= 0;

  const numericPriceValue = isPriceInputValid ? parseFloat(priceValue) : 0;

  const isInventoryInputValid =
    inventoryValue.trim() !== "" &&
    !isNaN(parseInt(inventoryValue, 10)) &&
    parseInt(inventoryValue, 10) >= 0;

  const numericInventoryValue = isInventoryInputValid
    ? Math.max(0, parseInt(inventoryValue, 10))
    : 0;

  // Price preview calculation (respects manual inline edits)
  const pricePreviewItems = products.flatMap((product) =>
    product.variants.map((variant) => {
      const currentPriceNum = parseFloat(variant.price) || 0;
      const hasManualOverride = Object.prototype.hasOwnProperty.call(
        manualPriceOverrides,
        variant.id,
      );

      let newPriceNum: number;
      if (hasManualOverride) {
        const manualStr = manualPriceOverrides[variant.id];
        const parsed = parseFloat(manualStr);
        newPriceNum = isNaN(parsed) ? currentPriceNum : Math.max(0, Number(parsed.toFixed(2)));
      } else if (isPriceInputValid) {
        newPriceNum = computeNewPrice(
          currentPriceNum,
          priceStrategy,
          numericPriceValue,
        );
      } else {
        newPriceNum = currentPriceNum;
      }

      const diff = Number((newPriceNum - currentPriceNum).toFixed(2));
      const percentDiff =
        currentPriceNum > 0 ? (diff / currentPriceNum) * 100 : 0;
      const isChanged = Math.abs(diff) > 0.001;

      const compareAtPriceNum = variant.compareAtPrice
        ? parseFloat(variant.compareAtPrice)
        : null;

      return {
        productId: product.id,
        productTitle: product.title,
        productHandle: product.handle,
        productStatus: product.status,
        onlineStoreUrl: product.onlineStoreUrl,
        onlineStorePreviewUrl: product.onlineStorePreviewUrl,
        productImage: product.featuredImage?.url || null,
        variantId: variant.id,
        variantTitle: variant.title,
        currentPrice: currentPriceNum.toFixed(2),
        compareAtPrice: compareAtPriceNum ? compareAtPriceNum.toFixed(2) : null,
        newPrice: newPriceNum.toFixed(2),
        diff,
        percentDiff,
        isChanged,
        isCustom: hasManualOverride,
      };
    }),
  );

  // Inventory preview calculation (respects manual inline edits)
  const inventoryPreviewItems = products.flatMap((product) =>
    product.variants.flatMap((variant) =>
      variant.inventoryLevels.map((lvl) => {
        const currentQty = lvl.available;
        const levelKey = `${variant.id}-${lvl.locationId}`;
        const hasManualOverride = Object.prototype.hasOwnProperty.call(
          manualInventoryOverrides,
          levelKey,
        );

        let newQty: number;
        if (hasManualOverride) {
          const manualStr = manualInventoryOverrides[levelKey];
          const parsed = parseInt(manualStr, 10);
          newQty = isNaN(parsed) ? currentQty : Math.max(0, parsed);
        } else if (isInventoryInputValid) {
          newQty = computeNewInventory(
            currentQty,
            inventoryStrategy,
            numericInventoryValue,
          );
        } else {
          newQty = currentQty;
        }

        const diff = newQty - currentQty;
        const isChanged = diff !== 0;

        return {
          productId: product.id,
          productTitle: product.title,
          productImage: product.featuredImage?.url || null,
          variantId: variant.id,
          variantTitle: variant.title,
          inventoryItemId: variant.inventoryItemId,
          inventoryTracked: variant.inventoryTracked,
          locationId: lvl.locationId,
          locationName: lvl.locationName,
          currentQty,
          newQty,
          diff,
          levelKey,
          isChanged,
          isCustom: hasManualOverride,
        };
      }),
    ),
  );

  const handleConfirmPriceUpdate = () => {
    const updatesMap = new Map<string, Array<{ id: string; price: string }>>();
    for (const item of pricePreviewItems) {
      if (!item.isChanged) continue;
      if (!updatesMap.has(item.productId)) {
        updatesMap.set(item.productId, []);
      }
      updatesMap.get(item.productId)!.push({
        id: item.variantId,
        price: item.newPrice,
      });
    }

    if (updatesMap.size === 0) {
      setIsPriceModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    const updates = Array.from(updatesMap.entries()).map(
      ([productId, variants]) => ({
        productId,
        variants,
      }),
    );

    const formData = new FormData();
    formData.append("actionType", "price");
    formData.append("strategyLabel", isPriceInputValid ? currentPriceStrategyLabel : "Manual Price Edits");
    formData.append("productCount", String(updates.length));
    formData.append("updates", JSON.stringify(updates));
    submit(formData, { method: "post" });
  };

  const handleConfirmInventoryUpdate = () => {
    const validUpdates = inventoryPreviewItems
      .filter((item) => Boolean(item.inventoryItemId) && item.isChanged)
      .map((item) => ({
        inventoryItemId: item.inventoryItemId!,
        locationId: item.locationId,
        quantity: item.newQty,
        tracked: item.inventoryTracked,
      }));

    if (validUpdates.length === 0) {
      setIsInventoryModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("actionType", "inventory");
    formData.append("strategyLabel", isInventoryInputValid ? currentInventoryStrategyLabel : "Manual Inventory Edits");
    formData.append("productCount", String(new Set(validUpdates.map((u) => u.locationId)).size));
    formData.append("inventoryUpdates", JSON.stringify(validUpdates));
    submit(formData, { method: "post" });
  };

  // Product Status preview calculation (respects manual inline edits)
  const statusPreviewItems = products.map((product) => {
    const currentStatus = product.status.toUpperCase();
    const hasManualOverride = Object.prototype.hasOwnProperty.call(
      manualStatusOverrides,
      product.id,
    );
    const newStatus = hasManualOverride
      ? manualStatusOverrides[product.id]
      : targetStatus;
    const isChanged = currentStatus !== newStatus;

    return {
      productId: product.id,
      productTitle: product.title,
      productImage: product.featuredImage?.url || null,
      currentStatus,
      newStatus,
      isChanged,
      isCustom: hasManualOverride,
    };
  });

  const handleConfirmStatusUpdate = () => {
    const updates = statusPreviewItems
      .filter((item) => item.isChanged)
      .map((item) => ({
        productId: item.productId,
        status: item.newStatus,
      }));

    if (updates.length === 0) {
      setIsStatusModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("actionType", "status");
    formData.append("strategyLabel", `Set ${targetStatus}`);
    formData.append("productCount", String(updates.length));
    formData.append("statusUpdates", JSON.stringify(updates));
    submit(formData, { method: "post" });
  };

  // Tag Management parsing & preview calculation (respects manual inline edits)
  const parsedInputTags = tagInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const tagPreviewItems = products.map((product) => {
    const currentTags = product.tags;
    const hasManualOverride = Object.prototype.hasOwnProperty.call(
      manualTagInputs,
      product.id,
    );

    let newTags: string[] = [];
    if (hasManualOverride) {
      newTags = (manualTagInputs[product.id] || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      if (tagAction === "add") {
        const combined = new Set([...currentTags, ...parsedInputTags]);
        newTags = Array.from(combined);
      } else if (tagAction === "remove") {
        const toRemoveLower = new Set(parsedInputTags.map((t) => t.toLowerCase()));
        newTags = currentTags.filter((t) => !toRemoveLower.has(t.toLowerCase()));
      } else if (tagAction === "replace") {
        newTags = [...parsedInputTags];
      }
    }

    const addedTags = newTags.filter((t) => !currentTags.includes(t));
    const removedTags = currentTags.filter((t) => !newTags.includes(t));
    const isChanged =
      addedTags.length > 0 ||
      removedTags.length > 0 ||
      (currentTags.length === 0 && newTags.length === 0 && hasManualOverride);

    return {
      productId: product.id,
      productTitle: product.title,
      productImage: product.featuredImage?.url || null,
      currentTags,
      newTags,
      addedTags,
      removedTags,
      isChanged,
      isCustom: hasManualOverride,
    };
  });

  const handleConfirmTagUpdate = () => {
    const updates = tagPreviewItems
      .filter((item) => item.isChanged)
      .map((item) => ({
        productId: item.productId,
        tags: item.newTags,
      }));

    if (updates.length === 0) {
      setIsTagModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    const strategyLabel =
      tagAction === "add"
        ? `Add: ${parsedInputTags.join(", ")}`
        : tagAction === "remove"
          ? `Remove: ${parsedInputTags.join(", ")}`
          : `Replace with: ${parsedInputTags.join(", ")}`;

    const formData = new FormData();
    formData.append("actionType", "tags");
    formData.append("strategyLabel", strategyLabel);
    formData.append("productCount", String(updates.length));
    formData.append("tagUpdates", JSON.stringify(updates));
    submit(formData, { method: "post" });
  };

  // Collections Management options & calculations
  const collectionActionOptions = [
    { label: "Add to Collections (+)", value: "add" },
    { label: "Remove from Collections (-)", value: "remove" },
    { label: "Replace Collection Assignments (⇄)", value: "replace" },
  ];

  const currentCollectionActionLabel =
    collectionActionOptions.find((o) => o.value === collectionAction)?.label ||
    collectionAction;

  // Build a deduplicated map of manual collections
  const manualCollectionsMap = new Map<string, string>();
  for (const c of storeCollections) {
    if (!c.isAutomated) {
      manualCollectionsMap.set(c.id, c.title);
    }
  }
  for (const p of products) {
    for (const c of p.collections) {
      if (!c.isAutomated && !manualCollectionsMap.has(c.id)) {
        manualCollectionsMap.set(c.id, c.title);
      }
    }
  }

  const availableManualCollections = Array.from(manualCollectionsMap.entries())
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const collectionPreviewItems = products.map((product) => {
    const currentManualCols = product.collections.filter((c) => !c.isAutomated);
    const automatedCols = product.collections.filter((c) => c.isAutomated);

    let resultingManualCols: Array<{ id: string; title: string }> = [];

    if (collectionAction === "add") {
      const existingIds = new Set(currentManualCols.map((c) => c.id));
      const newlyAdded = selectedCollectionIds
        .filter((id) => !existingIds.has(id))
        .map((id) => ({ id, title: manualCollectionsMap.get(id) || id }));
      resultingManualCols = [...currentManualCols, ...newlyAdded];
    } else if (collectionAction === "remove") {
      const toRemoveIds = new Set(selectedCollectionIds);
      resultingManualCols = currentManualCols.filter(
        (c) => !toRemoveIds.has(c.id),
      );
    } else if (collectionAction === "replace") {
      resultingManualCols = selectedCollectionIds.map((id) => ({
        id,
        title: manualCollectionsMap.get(id) || id,
      }));
    }

    const currentIds = new Set(currentManualCols.map((c) => c.id));
    const resultingIds = new Set(resultingManualCols.map((c) => c.id));

    const addedCols = resultingManualCols.filter((c) => !currentIds.has(c.id));
    const removedCols = currentManualCols.filter((c) => !resultingIds.has(c.id));
    const isChanged = addedCols.length > 0 || removedCols.length > 0;

    return {
      productId: product.id,
      productTitle: product.title,
      productImage: product.featuredImage?.url || null,
      currentManualCols,
      automatedCols,
      resultingManualCols,
      addedCols,
      removedCols,
      isChanged,
    };
  });

  const handleConfirmCollectionUpdate = () => {
    const changedItems = collectionPreviewItems.filter((i) => i.isChanged);
    if (changedItems.length === 0) {
      setIsCollectionModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("actionType", "collections");
    formData.append("collectionAction", collectionAction);
    formData.append("strategyLabel", currentCollectionActionLabel);
    formData.append("productCount", String(changedItems.length));
    formData.append("targetCollectionIds", JSON.stringify(selectedCollectionIds));
    formData.append("productIds", JSON.stringify(products.map((p) => p.id)));

    if (collectionAction === "replace") {
      const replaceItems = collectionPreviewItems.map((item) => ({
        productId: item.productId,
        additions: item.addedCols.map((c) => c.id),
        removals: item.removedCols.map((c) => c.id),
      }));
      formData.append("replacePayload", JSON.stringify(replaceItems));
    }

    submit(formData, { method: "post" });
  };

  // Compare-at Price options & calculations
  const compareAtStrategyOptions = [
    { label: "Set exact compare-at price ($)", value: "set_exact" },
    { label: "Increase compare-at price ($)", value: "increase_fixed" },
    { label: "Decrease compare-at price ($)", value: "decrease_fixed" },
    { label: "Percentage increase (%)", value: "increase_percent" },
    { label: "Percentage decrease (%)", value: "decrease_percent" },
    { label: "Clear compare-at price", value: "clear" },
  ];

  const currentCompareAtStrategyLabel =
    compareAtStrategyOptions.find((o) => o.value === compareAtStrategy)?.label ||
    compareAtStrategy;

  const isCompareAtInputValid =
    compareAtStrategy === "clear" ||
    (compareAtValue.trim() !== "" &&
      !isNaN(parseFloat(compareAtValue)) &&
      parseFloat(compareAtValue) >= 0);

  const numericCompareAtValue = isCompareAtInputValid
    ? parseFloat(compareAtValue) || 0
    : 0;

  const compareAtPreviewItems = products.flatMap((product) =>
    product.variants.map((variant) => {
      const currentPriceNum = parseFloat(variant.price) || 0;
      const currentCompareAtNum =
        variant.compareAtPrice !== null && variant.compareAtPrice !== ""
          ? parseFloat(variant.compareAtPrice)
          : null;
      const hasManualOverride = Object.prototype.hasOwnProperty.call(
        manualCompareAtOverrides,
        variant.id,
      );

      let newCompareAtNum: number | null = null;
      if (hasManualOverride) {
        const manualStr = manualCompareAtOverrides[variant.id]?.trim();
        if (manualStr === "" || manualStr === undefined) {
          newCompareAtNum = null;
        } else {
          const parsed = parseFloat(manualStr);
          newCompareAtNum = isNaN(parsed) ? currentCompareAtNum : Math.max(0, Number(parsed.toFixed(2)));
        }
      } else if (isCompareAtInputValid) {
        newCompareAtNum = computeNewCompareAt(
          currentCompareAtNum,
          currentPriceNum,
          compareAtStrategy,
          numericCompareAtValue,
        );
      } else {
        newCompareAtNum = currentCompareAtNum;
      }

      const isCleared = newCompareAtNum === null && currentCompareAtNum !== null;
      const currentFormatted =
        currentCompareAtNum !== null ? `$${currentCompareAtNum.toFixed(2)}` : "None";
      const newFormatted =
        newCompareAtNum !== null ? `$${newCompareAtNum.toFixed(2)}` : "None (Cleared)";

      const diff =
        newCompareAtNum !== null && currentCompareAtNum !== null
          ? Number((newCompareAtNum - currentCompareAtNum).toFixed(2))
          : null;

      const isWarning =
        newCompareAtNum !== null && newCompareAtNum <= currentPriceNum;

      const isChanged =
        (currentCompareAtNum === null && newCompareAtNum !== null) ||
        (currentCompareAtNum !== null && newCompareAtNum === null) ||
        (currentCompareAtNum !== null &&
          newCompareAtNum !== null &&
          Math.abs(currentCompareAtNum - newCompareAtNum) > 0.001);

      return {
        productId: product.id,
        productTitle: product.title,
        productImage: product.featuredImage?.url || null,
        variantId: variant.id,
        variantTitle: variant.title,
        currentPrice: currentPriceNum.toFixed(2),
        currentCompareAt: currentFormatted,
        currentCompareAtNum,
        newCompareAt: newFormatted,
        newCompareAtNum,
        diff,
        isCleared,
        isWarning,
        isChanged,
        isCustom: hasManualOverride,
      };
    }),
  );

  const handleConfirmCompareAtUpdate = () => {
    const updatesMap = new Map<
      string,
      Array<{ id: string; compareAtPrice: string | null }>
    >();

    for (const item of compareAtPreviewItems) {
      if (!item.isChanged) continue;
      if (!updatesMap.has(item.productId)) {
        updatesMap.set(item.productId, []);
      }
      updatesMap.get(item.productId)!.push({
        id: item.variantId,
        compareAtPrice:
          item.newCompareAtNum !== null ? item.newCompareAtNum.toFixed(2) : null,
      });
    }

    if (updatesMap.size === 0) {
      setIsCompareAtModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    const updates = Array.from(updatesMap.entries()).map(
      ([productId, variants]) => ({
        productId,
        variants,
      }),
    );

    const formData = new FormData();
    formData.append("actionType", "compare_at");
    formData.append("strategyLabel", isCompareAtInputValid ? currentCompareAtStrategyLabel : "Manual Compare-at Edits");
    formData.append("productCount", String(updates.length));
    formData.append("compareAtUpdates", JSON.stringify(updates));
    submit(formData, { method: "post" });
  };

  // Vendor and Product Type options & calculations
  const orgStrategyOptions = [
    { label: "Set Vendor & Product Type", value: "both" },
    { label: "Set Vendor Only", value: "vendor_only" },
    { label: "Set Product Type Only", value: "type_only" },
  ];

  const currentOrgStrategyLabel =
    orgStrategyOptions.find((o) => o.value === orgStrategy)?.label ||
    orgStrategy;

  const existingVendors = Array.from(
    new Set(products.map((p) => p.vendor).filter(Boolean)),
  );
  const existingTypes = Array.from(
    new Set(products.map((p) => p.productType).filter(Boolean)),
  );

  const orgPreviewItems = products.map((product) => {
    const currentVendor = product.vendor || "";
    const currentType = product.productType || "";
    const manual = manualOrgOverrides[product.id];

    let newVendor = currentVendor;
    if (orgStrategy !== "type_only") {
      newVendor =
        manual?.vendor !== undefined ? manual.vendor : targetVendor.trim();
    }

    let newType = currentType;
    if (orgStrategy !== "vendor_only") {
      newType =
        manual?.productType !== undefined
          ? manual.productType
          : targetProductType.trim();
    }

    const isVendorChanged =
      orgStrategy !== "type_only" && newVendor !== currentVendor;
    const isTypeChanged =
      orgStrategy !== "vendor_only" && newType !== currentType;
    const isChanged = isVendorChanged || isTypeChanged;
    const isCustom = Boolean(manual);

    return {
      productId: product.id,
      productTitle: product.title,
      productImage: product.featuredImage?.url || null,
      currentVendor: currentVendor || "—",
      newVendor: newVendor || "—",
      currentType: currentType || "—",
      newType: newType || "—",
      rawNewVendor: newVendor,
      rawNewType: newType,
      isVendorChanged,
      isTypeChanged,
      isChanged,
      isCustom,
    };
  });

  const handleConfirmOrgUpdate = () => {
    const updates = orgPreviewItems
      .filter((item) => item.isChanged)
      .map((item) => {
        const updateObj: { productId: string; vendor?: string; productType?: string } = {
          productId: item.productId,
        };
        if (orgStrategy !== "type_only") {
          updateObj.vendor = item.rawNewVendor;
        }
        if (orgStrategy !== "vendor_only") {
          updateObj.productType = item.rawNewType;
        }
        return updateObj;
      });

    if (updates.length === 0) {
      setIsOrgModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("actionType", "organization");
    formData.append("strategyLabel", currentOrgStrategyLabel);
    formData.append("productCount", String(updates.length));
    formData.append("organizationUpdates", JSON.stringify(updates));
    submit(formData, { method: "post" });
  };

  const pricePreviewHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: "Product" },
    { title: "Variant" },
    { title: "Current Price" },
    { title: "New Price" },
    { title: "Difference" },
  ];

  const inventoryPreviewHeadings: [{ title: string }, ...{ title: string }[]] =
    [
      { title: "Product" },
      { title: "Variant" },
      { title: "Location" },
      { title: "Current Stock" },
      { title: "New Stock" },
      { title: "Difference" },
    ];

  const statusPreviewHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: "Product" },
    { title: "Current Status" },
    { title: "New Status" },
    { title: "Change" },
  ];

  const tagPreviewHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: "Product" },
    { title: "Current Tags" },
    { title: "New Tags" },
    { title: "Changes" },
  ];

  const collectionPreviewHeadings: [{ title: string }, ...{ title: string }[]] =
    [
      { title: "Product" },
      { title: "Current Collections" },
      { title: "New Collections" },
      { title: "Changes" },
    ];

  const compareAtPreviewHeadings: [{ title: string }, ...{ title: string }[]] =
    [
      { title: "Product" },
      { title: "Variant" },
      { title: "Selling Price" },
      { title: "Current Compare-at" },
      { title: "New Compare-at" },
      { title: "Difference / Status" },
    ];

  const orgPreviewHeadings: [{ title: string }, ...{ title: string }[]] = [
    { title: "Product" },
    { title: "Current Vendor" },
    { title: "New Vendor" },
    { title: "Current Type" },
    { title: "New Type" },
    { title: "Change" },
  ];

  // Filtered preview items & counts based on previewSearch and filterOnlyChanged
  const searchLower = previewSearch.trim().toLowerCase();

  const priceChangedCount = pricePreviewItems.filter((i) => i.isChanged).length;
  const displayedPriceItems = pricePreviewItems.filter((item) => {
    if (filterOnlyChanged && !item.isChanged) return false;
    if (searchLower) {
      const matchTitle = item.productTitle.toLowerCase().includes(searchLower);
      const matchVariant = item.variantTitle.toLowerCase().includes(searchLower);
      if (!matchTitle && !matchVariant) return false;
    }
    return true;
  });

  const inventoryChangedCount = inventoryPreviewItems.filter((i) => i.isChanged).length;
  const displayedInventoryItems = inventoryPreviewItems.filter((item) => {
    if (filterOnlyChanged && !item.isChanged) return false;
    if (searchLower) {
      const matchTitle = item.productTitle.toLowerCase().includes(searchLower);
      const matchVariant = item.variantTitle.toLowerCase().includes(searchLower);
      const matchLoc = item.locationName.toLowerCase().includes(searchLower);
      if (!matchTitle && !matchVariant && !matchLoc) return false;
    }
    return true;
  });

  const statusChangedCount = statusPreviewItems.filter((i) => i.isChanged).length;
  const displayedStatusItems = statusPreviewItems.filter((item) => {
    if (filterOnlyChanged && !item.isChanged) return false;
    if (searchLower) {
      const matchTitle = item.productTitle.toLowerCase().includes(searchLower);
      if (!matchTitle) return false;
    }
    return true;
  });

  const tagChangedCount = tagPreviewItems.filter((i) => i.isChanged).length;
  const displayedTagItems = tagPreviewItems.filter((item) => {
    if (filterOnlyChanged && !item.isChanged) return false;
    if (searchLower) {
      const matchTitle = item.productTitle.toLowerCase().includes(searchLower);
      const matchTags =
        item.currentTags.some((t) => t.toLowerCase().includes(searchLower)) ||
        item.newTags.some((t) => t.toLowerCase().includes(searchLower));
      if (!matchTitle && !matchTags) return false;
    }
    return true;
  });

  const collectionChangedCount = collectionPreviewItems.filter((i) => i.isChanged).length;
  const displayedCollectionItems = collectionPreviewItems.filter((item) => {
    if (filterOnlyChanged && !item.isChanged) return false;
    if (searchLower) {
      const matchTitle = item.productTitle.toLowerCase().includes(searchLower);
      if (!matchTitle) return false;
    }
    return true;
  });

  const compareAtChangedCount = compareAtPreviewItems.filter((i) => i.isChanged).length;
  const displayedCompareAtItems = compareAtPreviewItems.filter((item) => {
    if (filterOnlyChanged && !item.isChanged) return false;
    if (searchLower) {
      const matchTitle = item.productTitle.toLowerCase().includes(searchLower);
      const matchVariant = item.variantTitle.toLowerCase().includes(searchLower);
      if (!matchTitle && !matchVariant) return false;
    }
    return true;
  });

  const orgChangedCount = orgPreviewItems.filter((i) => i.isChanged).length;
  const displayedOrgItems = orgPreviewItems.filter((item) => {
    if (filterOnlyChanged && !item.isChanged) return false;
    if (searchLower) {
      const matchTitle = item.productTitle.toLowerCase().includes(searchLower);
      const matchVendor =
        item.currentVendor.toLowerCase().includes(searchLower) ||
        item.rawNewVendor.toLowerCase().includes(searchLower);
      const matchType =
        item.currentType.toLowerCase().includes(searchLower) ||
        item.rawNewType.toLowerCase().includes(searchLower);
      if (!matchTitle && !matchVendor && !matchType) return false;
    }
    return true;
  });

  const tabs = [
    {
      id: "price-tab",
      content: "Price Adjustment",
      accessibilityLabel: "Price Adjustment",
      panelID: "price-panel",
    },
    {
      id: "inventory-tab",
      content: "Inventory Adjustment",
      accessibilityLabel: "Inventory Adjustment",
      panelID: "inventory-panel",
    },
    {
      id: "status-tab",
      content: "Product Status",
      accessibilityLabel: "Product Status",
      panelID: "status-panel",
    },
    {
      id: "tags-tab",
      content: "Tags",
      accessibilityLabel: "Tags",
      panelID: "tags-panel",
    },
    {
      id: "collections-tab",
      content: "Collections",
      accessibilityLabel: "Collections",
      panelID: "collections-panel",
    },
    {
      id: "compare-at-tab",
      content: "Compare-at Price",
      accessibilityLabel: "Compare-at Price",
      panelID: "compare-at-panel",
    },
    {
      id: "organization-tab",
      content: "Vendor & Product Type",
      accessibilityLabel: "Vendor & Product Type",
      panelID: "organization-panel",
    },
  ];

  if (products.length === 0) {
    return (
      <Page
        title="Bulk Catalog Editor"
        subtitle="Make bulk changes across prices, inventory, status, tags, collections, compare-at, and organization"
      >
        <Card>
          <EmptyState
            heading="No products selected for editing"
            action={{
              content: "Go to Products",
              onAction: () => navigate("/app/products"),
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2766/files/emptystate-files.png"
          >
            <p>
              Please select one or more products on the Products page using the
              checkboxes, then select an edit action.
            </p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Bulk Catalog Editor"
      subtitle="Make bulk changes across prices, inventory, status, tags, collections, compare-at, and organization"
      backAction={{
        content: "Products",
        onAction: () => navigate("/app/products"),
      }}
    >
      <BlockStack gap="400">
        {actionData?.success === true &&
          actionData.updatedType === "price" && (
            <Banner tone="success" title="Prices successfully updated and saved in Shopify">
              <BlockStack gap="200">
                <p>
                  Successfully updated prices for{" "}
                  <strong>{actionData.updatedVariantsCount} variant(s)</strong> across{" "}
                  <strong>{actionData.updatedProductsCount} product(s)</strong> directly in Shopify.
                </p>

                <Box
                  padding="200"
                  background="bg-surface-secondary"
                  borderRadius="150"
                >
                  <BlockStack gap="150">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Storefront & Verification Guidelines:
                    </Text>
                    <Text as="p" variant="bodySm">
                      • <strong>Storefront CDN Cache Delay:</strong> Shopify caches product pages on its edge CDN for <strong>1 to 3 minutes</strong>. If viewing your website in another tab, your browser may show cached HTML. Press <strong>Ctrl + F5</strong> (Windows) or <strong>Cmd + Shift + R</strong> (Mac), or open an Incognito window to view updated prices immediately.
                    </Text>
                    <Text as="p" variant="bodySm">
                      • <strong>Draft & Archived Products:</strong> Products in <em>Draft</em> or <em>Archived</em> status are hidden from the online store by design. To make them visible to customers, switch their status to <em>Active</em> in the Product Status tab.
                    </Text>
                    <Text as="p" variant="bodySm">
                      • <strong>Compare-at Price (Strike-through MSRP):</strong> If your theme displays a crossed-out original price alongside the selling price, update or clear it in the <em>Compare-at Price</em> tab.
                    </Text>
                  </BlockStack>
                </Box>

                <InlineStack gap="200">
                  {shop && (
                    <Button
                      url={`https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/products`}
                      target="_blank"
                      variant="plain"
                    >
                      Verify in Shopify Admin Products ↗
                    </Button>
                  )}
                  {shop && (
                    <Button
                      url={`https://${shop}?preview_theme_id=1&v=${Date.now()}`}
                      target="_blank"
                      variant="plain"
                    >
                      Preview Storefront (Fresh Cache) ↗
                    </Button>
                  )}
                </InlineStack>
              </BlockStack>
            </Banner>
          )}

        {actionData?.success === true &&
          actionData.updatedType === "inventory" && (
            <Banner tone="success" title="Inventory updated successfully">
              <p>
                Successfully updated inventory for {actionData.updatedCount}{" "}
                items across your selected products.
              </p>
            </Banner>
          )}

        {actionData?.success === true &&
          actionData.updatedType === "status" && (
            <Banner tone="success" title="Product status updated successfully">
              <p>
                Successfully updated status for {actionData.updatedCount} products.
              </p>
            </Banner>
          )}

        {actionData?.success === true &&
          actionData.updatedType === "tags" && (
            <Banner tone="success" title="Product tags updated successfully">
              <p>
                Successfully updated tags for {actionData.updatedCount} products.
              </p>
            </Banner>
          )}

        {actionData?.success === true &&
          actionData.updatedType === "collections" && (
            <Banner tone="success" title="Collections updated successfully">
              <p>
                Successfully updated collections for {actionData.updatedCount} products.
              </p>
            </Banner>
          )}

        {actionData?.success === true &&
          actionData.updatedType === "compare_at" && (
            <Banner tone="success" title="Compare-at prices updated successfully">
              <p>
                Successfully updated compare-at prices for{" "}
                {actionData.updatedProductsCount} products (
                {actionData.updatedVariantsCount} variants).
              </p>
            </Banner>
          )}

        {actionData?.success === true &&
          actionData.updatedType === "organization" && (
            <Banner tone="success" title="Vendor and Product Type updated successfully">
              <p>
                Successfully updated vendor and product type for {actionData.updatedCount} products.
              </p>
            </Banner>
          )}

        {actionData?.success === false && (
          <Banner tone="critical" title="Update failed">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {/* Selected Products Banner */}
        <Box
          background="bg-surface-secondary"
          padding="300"
          borderRadius="200"
        >
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                Selected Products:
              </Text>
              <Badge tone="info">{`${products.length} products`}</Badge>
              <Badge>{`${pricePreviewItems.length} variants`}</Badge>
            </InlineStack>
            <Button onClick={() => navigate("/app/products")}>
              Change selection
            </Button>
          </InlineStack>
        </Box>

        {/* Tab Selection */}
        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
          {selectedTab === 0 ? (
            /* Price Adjustment Tab */
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Price Adjustment
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Apply global price rules or manually adjust specific variant prices in the preview below.
                    </Text>
                  </BlockStack>

                  <InlineStack gap="300" wrap={false} blockAlign="end">
                    <div style={{ width: "240px", flexShrink: 0 }}>
                      <Select
                        label="Adjustment Type"
                        options={priceStrategyOptions}
                        value={priceStrategy}
                        onChange={setPriceStrategy}
                      />
                    </div>

                    <div style={{ width: "180px", flexShrink: 0 }}>
                      <TextField
                        label={
                          priceStrategy.includes("percent")
                            ? "Percentage (%)"
                            : "Amount ($)"
                        }
                        type="number"
                        min={0}
                        step={priceStrategy.includes("percent") ? 1 : 0.01}
                        placeholder={
                          priceStrategy.includes("percent") ? "e.g. 15" : "e.g. 29.99"
                        }
                        value={priceValue}
                        onChange={setPriceValue}
                        autoComplete="off"
                        prefix={
                          priceStrategy.includes("percent") ? undefined : "$"
                        }
                        suffix={
                          priceStrategy.includes("percent") ? "%" : undefined
                        }
                      />
                    </div>

                    <div>
                      <Button
                        variant="primary"
                        onClick={() => setIsPriceModalOpen(true)}
                        disabled={priceChangedCount === 0 || isSubmitting}
                      >
                        Review & Apply Prices
                      </Button>
                    </div>
                  </InlineStack>

                  {!isPriceInputValid && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Enter an amount above to preview price adjustments across all variants, or edit individual prices directly below.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              {/* Price Preview Screen */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Price Preview
                        </Text>
                        <Badge tone={priceChangedCount > 0 ? "attention" : undefined}>
                          {priceChangedCount > 0
                            ? `${priceChangedCount} of ${pricePreviewItems.length} changing`
                            : "No pending changes"}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Calculated from rules above or adjust individual variant prices directly
                      </Text>
                    </BlockStack>
                    {Object.keys(manualPriceOverrides).length > 0 && (
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone="info">{`${Object.keys(manualPriceOverrides).length} manual overrides`}</Badge>
                        <Button
                          size="slim"
                          variant="plain"
                          onClick={() => setManualPriceOverrides({})}
                        >
                          Reset manual overrides
                        </Button>
                      </InlineStack>
                    )}
                  </InlineStack>

                  <PreviewToolbar
                    search={previewSearch}
                    onSearchChange={setPreviewSearch}
                    filterOnlyChanged={filterOnlyChanged}
                    onFilterOnlyChangedChange={setFilterOnlyChanged}
                    totalCount={pricePreviewItems.length}
                    changedCount={priceChangedCount}
                    itemLabel="variants"
                  />

                  {displayedPriceItems.length === 0 ? (
                    <PreviewEmptyFilter
                      onClear={() => {
                        setPreviewSearch("");
                        setFilterOnlyChanged(false);
                      }}
                    />
                  ) : (
                    <IndexTable
                      resourceName={{ singular: "variant", plural: "variants" }}
                      itemCount={displayedPriceItems.length}
                      headings={pricePreviewHeadings}
                      selectable={false}
                    >
                      {displayedPriceItems.map((item, index) => {
                        const isIncrease = item.diff > 0;
                        const isDecrease = item.diff < 0;
                        const badgeTone = isIncrease
                          ? "success"
                          : isDecrease
                            ? "attention"
                            : undefined;

                        const diffFormatted =
                          item.diff === 0
                            ? "No change"
                            : `${isIncrease ? "+" : ""}$${item.diff.toFixed(2)} (${isIncrease ? "+" : ""}${item.percentDiff.toFixed(1)}%)`;

                        const isSameProduct =
                          index > 0 &&
                          displayedPriceItems[index - 1].productId ===
                            item.productId;

                        return (
                          <IndexTable.Row
                            id={item.variantId}
                            key={item.variantId}
                            position={index}
                          >
                            <IndexTable.Cell>
                              {isSameProduct ? (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    paddingLeft: "32px",
                                  }}
                                >
                                  <Text
                                    variant="bodySm"
                                    tone="subdued"
                                    as="span"
                                  >
                                    ↳ (same product)
                                  </Text>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    minWidth: "220px",
                                    flexWrap: "nowrap",
                                  }}
                                >
                                  <div style={{ flexShrink: 0 }}>
                                    <Thumbnail
                                      source={item.productImage || ImageIcon}
                                      alt={item.productTitle}
                                      size="small"
                                    />
                                  </div>
                                  <BlockStack gap="050">
                                    <Text
                                      variant="bodyMd"
                                      fontWeight="semibold"
                                      as="span"
                                    >
                                      {item.productTitle}
                                    </Text>
                                    <InlineStack gap="100" blockAlign="center" wrap>
                                      <Badge
                                        tone={
                                          item.productStatus === "ACTIVE"
                                            ? "success"
                                            : item.productStatus === "DRAFT"
                                              ? "warning"
                                              : "subdued"
                                        }
                                      >
                                        {item.productStatus === "ACTIVE"
                                          ? "Active"
                                          : item.productStatus === "DRAFT"
                                            ? "Draft (Hidden)"
                                            : "Archived"}
                                      </Badge>
                                      {shop && (
                                        <Link
                                          url={`https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/products/${item.productId.split("/").pop()}`}
                                          target="_blank"
                                          removeUnderline
                                        >
                                          <Text as="span" variant="bodyXs" tone="subdued">
                                            Admin ↗
                                          </Text>
                                        </Link>
                                      )}
                                      {item.productStatus === "ACTIVE" && (item.onlineStorePreviewUrl || (item.productHandle && shop)) && (() => {
                                        const rawUrl = item.onlineStorePreviewUrl || `https://${shop}/products/${item.productHandle}`;
                                        const freshUrl = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
                                        return (
                                          <Link
                                            url={freshUrl}
                                            target="_blank"
                                            removeUnderline
                                          >
                                            <Text as="span" variant="bodyXs" tone="subdued">
                                              Store ↗
                                            </Text>
                                          </Link>
                                        );
                                      })()}
                                    </InlineStack>
                                  </BlockStack>
                                </div>
                              )}
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd">
                                {item.variantTitle === "Default Title"
                                  ? "Single variant"
                                  : item.variantTitle}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <BlockStack gap="050">
                                <Text as="span" variant="bodyMd" fontWeight="semibold">
                                  ${item.currentPrice}
                                </Text>
                                {item.compareAtPrice && (
                                  <Text as="span" variant="bodyXs" tone="subdued">
                                    MSRP: ${item.compareAtPrice}
                                  </Text>
                                )}
                              </BlockStack>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Box width="130px">
                                <TextField
                                  label="New Price"
                                  labelHidden
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  prefix="$"
                                  value={
                                    Object.prototype.hasOwnProperty.call(
                                      manualPriceOverrides,
                                      item.variantId,
                                    )
                                      ? manualPriceOverrides[item.variantId]
                                      : item.newPrice
                                  }
                                  onChange={(val) => {
                                    setManualPriceOverrides((prev) => ({
                                      ...prev,
                                      [item.variantId]: val,
                                    }));
                                  }}
                                  autoComplete="off"
                                />
                              </Box>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <InlineStack gap="100" blockAlign="center">
                                {!item.isChanged ? (
                                  <Text as="span" variant="bodyMd" tone="subdued">
                                    —
                                  </Text>
                                ) : (
                                  <Badge tone={badgeTone}>{diffFormatted}</Badge>
                                )}
                                {item.isCustom && item.isChanged && (
                                  <Badge tone="info">Custom</Badge>
                                )}
                              </InlineStack>
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        );
                      })}
                    </IndexTable>
                  )}

                  <PreviewFooterBar
                    showingCount={displayedPriceItems.length}
                    totalCount={pricePreviewItems.length}
                    changedCount={priceChangedCount}
                    itemLabel="variants"
                    actionLabel="Review & Apply Prices"
                    onAction={() => setIsPriceModalOpen(true)}
                    disabled={priceChangedCount === 0 || isSubmitting}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          ) : selectedTab === 1 ? (
            /* Inventory Adjustment Tab */
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Inventory Adjustment
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Negative inventory is automatically prevented (minimum quantity will remain 0).
                    </Text>
                  </BlockStack>

                  <InlineStack gap="300" wrap={false} blockAlign="end">
                    <div style={{ width: "240px", flexShrink: 0 }}>
                      <Select
                        label="Adjustment Type"
                        options={inventoryStrategyOptions}
                        value={inventoryStrategy}
                        onChange={setInventoryStrategy}
                      />
                    </div>

                    <div style={{ width: "180px", flexShrink: 0 }}>
                      <TextField
                        label="Quantity"
                        type="number"
                        min={0}
                        step={1}
                        placeholder="e.g. 10"
                        value={inventoryValue}
                        onChange={setInventoryValue}
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <Button
                        variant="primary"
                        onClick={() => setIsInventoryModalOpen(true)}
                        disabled={inventoryChangedCount === 0 || isSubmitting}
                      >
                        Review & Apply Inventory
                      </Button>
                    </div>
                  </InlineStack>

                  {!isInventoryInputValid && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Enter a quantity above to preview inventory changes, or edit stock directly below.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              {/* Inventory Preview Screen */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Inventory Preview
                        </Text>
                        <Badge tone={inventoryChangedCount > 0 ? "attention" : undefined}>
                          {inventoryChangedCount > 0
                            ? `${inventoryChangedCount} of ${inventoryPreviewItems.length} changing`
                            : "No pending changes"}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Calculated from rules above or adjust individual stock levels directly
                      </Text>
                    </BlockStack>
                    {Object.keys(manualInventoryOverrides).length > 0 && (
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone="info">{`${Object.keys(manualInventoryOverrides).length} manual overrides`}</Badge>
                        <Button
                          size="slim"
                          variant="plain"
                          onClick={() => setManualInventoryOverrides({})}
                        >
                          Reset manual overrides
                        </Button>
                      </InlineStack>
                    )}
                  </InlineStack>

                  <PreviewToolbar
                    search={previewSearch}
                    onSearchChange={setPreviewSearch}
                    filterOnlyChanged={filterOnlyChanged}
                    onFilterOnlyChangedChange={setFilterOnlyChanged}
                    totalCount={inventoryPreviewItems.length}
                    changedCount={inventoryChangedCount}
                    itemLabel="stock levels"
                  />

                  {displayedInventoryItems.length === 0 ? (
                    <PreviewEmptyFilter
                      onClear={() => {
                        setPreviewSearch("");
                        setFilterOnlyChanged(false);
                      }}
                    />
                  ) : (
                    <IndexTable
                      resourceName={{ singular: "level", plural: "levels" }}
                      itemCount={displayedInventoryItems.length}
                      headings={inventoryPreviewHeadings}
                      selectable={false}
                    >
                      {displayedInventoryItems.map((item, index) => {
                        const isIncrease = item.diff > 0;
                        const isDecrease = item.diff < 0;
                        const badgeTone = isIncrease
                          ? "success"
                          : isDecrease
                            ? "attention"
                            : undefined;

                        const diffFormatted =
                          item.diff === 0
                            ? "No change"
                            : `${isIncrease ? "+" : ""}${item.diff}`;

                        return (
                          <IndexTable.Row
                            id={`${item.variantId}-${item.locationId}`}
                            key={`${item.variantId}-${item.locationId}`}
                            position={index}
                          >
                            <IndexTable.Cell>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  minWidth: "200px",
                                  flexWrap: "nowrap",
                                }}
                              >
                                <div style={{ flexShrink: 0 }}>
                                  <Thumbnail
                                    source={item.productImage || ImageIcon}
                                    alt={item.productTitle}
                                    size="small"
                                  />
                                </div>
                                <Text
                                  variant="bodyMd"
                                  fontWeight="semibold"
                                  as="span"
                                >
                                  {item.productTitle}
                                </Text>
                              </div>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd">
                                {item.variantTitle === "Default Title"
                                  ? "Single variant"
                                  : item.variantTitle}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd">
                                {item.locationName}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd">
                                {item.currentQty} in stock
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Box width="130px">
                                <TextField
                                  label="New Stock"
                                  labelHidden
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={
                                    Object.prototype.hasOwnProperty.call(
                                      manualInventoryOverrides,
                                      item.levelKey,
                                    )
                                      ? manualInventoryOverrides[item.levelKey]
                                      : String(item.newQty)
                                  }
                                  onChange={(val) => {
                                    setManualInventoryOverrides((prev) => ({
                                      ...prev,
                                      [item.levelKey]: val,
                                    }));
                                  }}
                                  autoComplete="off"
                                />
                              </Box>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <InlineStack gap="100" blockAlign="center">
                                {!item.isChanged ? (
                                  <Text as="span" variant="bodyMd" tone="subdued">
                                    —
                                  </Text>
                                ) : (
                                  <Badge tone={badgeTone}>{diffFormatted}</Badge>
                                )}
                                {item.isCustom && item.isChanged && (
                                  <Badge tone="info">Custom</Badge>
                                )}
                              </InlineStack>
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        );
                      })}
                    </IndexTable>
                  )}

                  <PreviewFooterBar
                    showingCount={displayedInventoryItems.length}
                    totalCount={inventoryPreviewItems.length}
                    changedCount={inventoryChangedCount}
                    itemLabel="stock levels"
                    actionLabel="Review & Apply Inventory Changes"
                    onAction={() => setIsInventoryModalOpen(true)}
                    disabled={inventoryChangedCount === 0 || isSubmitting}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          ) : selectedTab === 2 ? (
            /* Product Status Tab */
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Product Status
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Update the publication status across all selected products.
                    </Text>
                  </BlockStack>

                  <InlineStack gap="300" wrap={false} blockAlign="end">
                    <Box minWidth="240px">
                      <Select
                        label="Set Status To"
                        options={[
                          { label: "Active", value: "ACTIVE" },
                          { label: "Draft", value: "DRAFT" },
                          { label: "Archived", value: "ARCHIVED" },
                        ]}
                        value={targetStatus}
                        onChange={(val) => setTargetStatus(val as "ACTIVE" | "DRAFT" | "ARCHIVED")}
                      />
                    </Box>

                    <Button
                      variant="primary"
                      onClick={() => setIsStatusModalOpen(true)}
                    >
                      Review & Apply Status
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* Status Preview Screen */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Status Preview
                        </Text>
                        <Badge tone={statusChangedCount > 0 ? "attention" : undefined}>
                          {`${statusChangedCount} of ${statusPreviewItems.length} changing`}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Review target status for all selected products or change individual statuses below
                      </Text>
                    </BlockStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info">{`${products.length} products affected`}</Badge>
                      {Object.keys(manualStatusOverrides).length > 0 && (
                        <>
                          <Badge tone="attention">{`${Object.keys(manualStatusOverrides).length} custom overrides`}</Badge>
                          <Button
                            size="slim"
                            variant="plain"
                            onClick={() => setManualStatusOverrides({})}
                          >
                            Reset overrides
                          </Button>
                        </>
                      )}
                    </InlineStack>
                  </InlineStack>

                  <PreviewToolbar
                    search={previewSearch}
                    onSearchChange={setPreviewSearch}
                    filterOnlyChanged={filterOnlyChanged}
                    onFilterOnlyChangedChange={setFilterOnlyChanged}
                    totalCount={statusPreviewItems.length}
                    changedCount={statusChangedCount}
                    itemLabel="products"
                  />

                  {displayedStatusItems.length === 0 ? (
                    <PreviewEmptyFilter
                      onClear={() => {
                        setPreviewSearch("");
                        setFilterOnlyChanged(false);
                      }}
                    />
                  ) : (
                    <IndexTable
                      resourceName={{ singular: "product", plural: "products" }}
                      itemCount={displayedStatusItems.length}
                      headings={statusPreviewHeadings}
                      selectable={false}
                    >
                      {displayedStatusItems.map((item, index) => {
                        const getStatusTone = (st: string): "success" | "info" | "attention" =>
                          st === "ACTIVE" ? "success" : st === "DRAFT" ? "info" : "attention";

                        return (
                          <IndexTable.Row
                            id={item.productId}
                            key={item.productId}
                            position={index}
                          >
                            <IndexTable.Cell>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "200px", flexWrap: "nowrap" }}>
                                <div style={{ flexShrink: 0 }}>
                                  <Thumbnail
                                    source={item.productImage || ImageIcon}
                                    alt={item.productTitle}
                                    size="small"
                                  />
                                </div>
                                <Text variant="bodyMd" fontWeight="semibold" as="span">
                                  {item.productTitle}
                                </Text>
                              </div>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Badge tone={getStatusTone(item.currentStatus)}>
                                {item.currentStatus}
                              </Badge>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <div style={{ width: "130px" }}>
                                <Select
                                  label="Status"
                                  labelHidden
                                  options={[
                                    { label: "Active", value: "ACTIVE" },
                                    { label: "Draft", value: "DRAFT" },
                                    { label: "Archived", value: "ARCHIVED" },
                                  ]}
                                  value={item.newStatus}
                                  onChange={(val) =>
                                    setManualStatusOverrides((prev) => ({
                                      ...prev,
                                      [item.productId]: val as "ACTIVE" | "DRAFT" | "ARCHIVED",
                                    }))
                                  }
                                />
                              </div>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <InlineStack gap="100" blockAlign="center">
                                {item.isChanged ? (
                                  <Badge tone="attention">Will Update</Badge>
                                ) : (
                                  <Text as="span" variant="bodyMd" tone="subdued">
                                    —
                                  </Text>
                                )}
                                {item.isCustom && <Badge tone="info">Custom</Badge>}
                              </InlineStack>
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        );
                      })}
                    </IndexTable>
                  )}

                  <PreviewFooterBar
                    showingCount={displayedStatusItems.length}
                    totalCount={statusPreviewItems.length}
                    changedCount={statusChangedCount}
                    itemLabel="products"
                    actionLabel="Apply Status Changes"
                    onAction={handleConfirmStatusUpdate}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          ) : selectedTab === 3 ? (
            /* Tags Management Tab */
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Tag Management
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Enter multiple tags separated by commas (e.g. Summer, Sale, clearance).
                    </Text>
                  </BlockStack>

                  <InlineStack gap="300" wrap={false} blockAlign="end">
                    <Box minWidth="200px">
                      <Select
                        label="Tag Action"
                        options={[
                          { label: "Add Tags", value: "add" },
                          { label: "Remove Tags", value: "remove" },
                          { label: "Replace Tags", value: "replace" },
                        ]}
                        value={tagAction}
                        onChange={(val) => setTagAction(val as "add" | "remove" | "replace")}
                      />
                    </Box>

                    <Box minWidth="300px">
                      <TextField
                        label={
                          tagAction === "add"
                            ? "Tags to Add"
                            : tagAction === "remove"
                              ? "Tags to Remove"
                              : "New Replacement Tags"
                        }
                        value={tagInput}
                        onChange={setTagInput}
                        placeholder="e.g. Summer, Sale, clearance"
                        autoComplete="off"
                      />
                    </Box>

                    <Button
                      variant="primary"
                      onClick={() => setIsTagModalOpen(true)}
                      disabled={parsedInputTags.length === 0 && tagAction !== "replace"}
                    >
                      Review & Apply Tags
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* Tag Preview Screen */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Tag Preview
                        </Text>
                        <Badge tone={tagChangedCount > 0 ? "attention" : undefined}>
                          {`${tagChangedCount} of ${tagPreviewItems.length} changing`}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Live preview of resulting tags for all selected products or edit individual tags directly
                      </Text>
                    </BlockStack>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="info">{`${products.length} products affected`}</Badge>
                      {Object.keys(manualTagInputs).length > 0 && (
                        <>
                          <Badge tone="attention">{`${Object.keys(manualTagInputs).length} custom overrides`}</Badge>
                          <Button
                            size="slim"
                            variant="plain"
                            onClick={() => setManualTagInputs({})}
                          >
                            Reset overrides
                          </Button>
                        </>
                      )}
                    </InlineStack>
                  </InlineStack>

                  <PreviewToolbar
                    search={previewSearch}
                    onSearchChange={setPreviewSearch}
                    filterOnlyChanged={filterOnlyChanged}
                    onFilterOnlyChangedChange={setFilterOnlyChanged}
                    totalCount={tagPreviewItems.length}
                    changedCount={tagChangedCount}
                    itemLabel="products"
                  />

                  {displayedTagItems.length === 0 ? (
                    <PreviewEmptyFilter
                      onClear={() => {
                        setPreviewSearch("");
                        setFilterOnlyChanged(false);
                      }}
                    />
                  ) : (
                    <IndexTable
                      resourceName={{ singular: "product", plural: "products" }}
                      itemCount={displayedTagItems.length}
                      headings={tagPreviewHeadings}
                      selectable={false}
                    >
                      {displayedTagItems.map((item, index) => (
                        <IndexTable.Row
                          id={item.productId}
                          key={item.productId}
                          position={index}
                        >
                          <IndexTable.Cell>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "200px", flexWrap: "nowrap" }}>
                              <div style={{ flexShrink: 0 }}>
                                <Thumbnail
                                  source={item.productImage || ImageIcon}
                                  alt={item.productTitle}
                                  size="small"
                                />
                              </div>
                              <Text variant="bodyMd" fontWeight="semibold" as="span">
                                {item.productTitle}
                              </Text>
                            </div>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            {item.currentTags.length > 0 ? (
                              <InlineStack gap="100" blockAlign="center" wrap>
                                {item.currentTags.slice(0, 4).map((tag, i) => (
                                  <Badge key={i}>{tag}</Badge>
                                ))}
                                {item.currentTags.length > 4 && (
                                  <Badge tone="info">{`+${item.currentTags.length - 4} more`}</Badge>
                                )}
                              </InlineStack>
                            ) : (
                              <Text as="span" variant="bodyMd" tone="subdued">
                                —
                              </Text>
                            )}
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Box width="260px">
                              <TextField
                                label="Edit tags"
                                labelHidden
                                value={
                                  Object.prototype.hasOwnProperty.call(
                                    manualTagInputs,
                                    item.productId,
                                  )
                                    ? manualTagInputs[item.productId]
                                    : item.newTags.join(", ")
                                }
                                onChange={(val) => {
                                  setManualTagInputs((prev) => ({
                                    ...prev,
                                    [item.productId]: val,
                                  }));
                                }}
                                placeholder="Comma-separated tags"
                                autoComplete="off"
                              />
                            </Box>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <InlineStack gap="100" blockAlign="center" wrap>
                              {item.addedTags.length > 0 && (
                                <Badge tone="success">{`+${item.addedTags.length} added`}</Badge>
                              )}
                              {item.removedTags.length > 0 && (
                                <Badge tone="attention">{`-${item.removedTags.length} removed`}</Badge>
                              )}
                              {item.isCustom && <Badge tone="info">Custom</Badge>}
                              {!item.isChanged && !item.isCustom && (
                                <Text as="span" variant="bodyMd" tone="subdued">
                                  —
                                </Text>
                              )}
                            </InlineStack>
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  )}

                  <PreviewFooterBar
                    showingCount={displayedTagItems.length}
                    totalCount={tagPreviewItems.length}
                    changedCount={tagChangedCount}
                    itemLabel="products"
                    actionLabel="Apply Tag Changes"
                    onAction={() => setIsTagModalOpen(true)}
                    disabled={parsedInputTags.length === 0 && tagAction !== "replace" && Object.keys(manualTagInputs).length === 0}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          ) : selectedTab === 4 ? (
            /* Collections Management Tab */
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Collections Management
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Add, remove, or replace manual collection assignments across selected products.
                    </Text>
                  </BlockStack>

                  <InlineStack gap="300" wrap blockAlign="end">
                    <Box minWidth="240px">
                      <Select
                        label="Collection Action"
                        options={collectionActionOptions}
                        value={collectionAction}
                        onChange={(val) =>
                          setCollectionAction(val as "add" | "remove" | "replace")
                        }
                      />
                    </Box>

                    {availableManualCollections.length > 0 ? (
                      <Box minWidth="280px">
                        <Select
                          label={
                            collectionAction === "add"
                              ? "Select Collection to Add"
                              : collectionAction === "remove"
                                ? "Select Collection to Remove"
                                : "Select Collection to Assign"
                          }
                          options={[
                            {
                              label: "Choose a collection to add to list...",
                              value: "",
                            },
                            ...availableManualCollections
                              .filter((c) => !selectedCollectionIds.includes(c.id))
                              .map((c) => ({
                                label: c.title,
                                value: c.id,
                              })),
                          ]}
                          value=""
                          onChange={(selectedId) => {
                            if (selectedId && !selectedCollectionIds.includes(selectedId)) {
                              setSelectedCollectionIds((prev) => [...prev, selectedId]);
                            }
                          }}
                        />
                      </Box>
                    ) : (
                      <Text as="span" variant="bodySm" tone="subdued">
                        No manual collections found in store.
                      </Text>
                    )}

                    <Button
                      variant="primary"
                      onClick={() => setIsCollectionModalOpen(true)}
                      disabled={
                        selectedCollectionIds.length === 0 &&
                        collectionAction !== "replace"
                      }
                    >
                      Review & Apply Collections
                    </Button>
                  </InlineStack>

                  {/* Selected Collections Tags */}
                  <BlockStack gap="150">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Target Collections ({selectedCollectionIds.length} selected):
                    </Text>
                    {selectedCollectionIds.length > 0 ? (
                      <InlineStack gap="150" wrap blockAlign="center">
                        {selectedCollectionIds.map((colId) => {
                          const colTitle = manualCollectionsMap.get(colId) || colId;
                          return (
                            <Tag
                              key={colId}
                              onRemove={() =>
                                setSelectedCollectionIds((prev) =>
                                  prev.filter((id) => id !== colId),
                                )
                              }
                            >
                              {colTitle}
                            </Tag>
                          );
                        })}
                        <Button
                          size="slim"
                          variant="plain"
                          tone="critical"
                          onClick={() => setSelectedCollectionIds([])}
                        >
                          Clear all
                        </Button>
                      </InlineStack>
                    ) : (
                      <Text as="p" variant="bodySm" tone="subdued">
                        {collectionAction === "replace"
                          ? "No collections selected. Applying will clear all manual collection assignments from selected products."
                          : "No collections selected. Pick one or more collections above to proceed."}
                      </Text>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Collections Preview Screen */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Collections Preview
                        </Text>
                        <Badge tone={collectionChangedCount > 0 ? "attention" : undefined}>
                          {`${collectionChangedCount} of ${collectionPreviewItems.length} changing`}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Live preview of resulting collection assignments for all selected products
                      </Text>
                    </BlockStack>
                    <Badge tone="info">{`${products.length} products affected`}</Badge>
                  </InlineStack>

                  <PreviewToolbar
                    search={previewSearch}
                    onSearchChange={setPreviewSearch}
                    filterOnlyChanged={filterOnlyChanged}
                    onFilterOnlyChangedChange={setFilterOnlyChanged}
                    totalCount={collectionPreviewItems.length}
                    changedCount={collectionChangedCount}
                    itemLabel="products"
                  />

                  {displayedCollectionItems.length === 0 ? (
                    <PreviewEmptyFilter
                      onClear={() => {
                        setPreviewSearch("");
                        setFilterOnlyChanged(false);
                      }}
                    />
                  ) : (
                    <IndexTable
                      resourceName={{ singular: "product", plural: "products" }}
                      itemCount={displayedCollectionItems.length}
                      headings={collectionPreviewHeadings}
                      selectable={false}
                    >
                      {displayedCollectionItems.map((item, index) => (
                        <IndexTable.Row
                          id={item.productId}
                          key={item.productId}
                          position={index}
                        >
                          <IndexTable.Cell>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "200px", flexWrap: "nowrap" }}>
                              <div style={{ flexShrink: 0 }}>
                                <Thumbnail
                                  source={item.productImage || ImageIcon}
                                  alt={item.productTitle}
                                  size="small"
                                />
                              </div>
                              <Text variant="bodyMd" fontWeight="semibold" as="span">
                                {item.productTitle}
                              </Text>
                            </div>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            {item.currentManualCols.length > 0 || item.automatedCols.length > 0 ? (
                              <InlineStack gap="100" blockAlign="center" wrap>
                                {item.currentManualCols.map((c) => (
                                  <Badge key={c.id}>{c.title}</Badge>
                                ))}
                                {item.automatedCols.length > 0 && (
                                  <Badge tone="info">{`${item.automatedCols.length} automated`}</Badge>
                                )}
                              </InlineStack>
                            ) : (
                              <Text as="span" variant="bodyMd" tone="subdued">
                                —
                              </Text>
                            )}
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            {item.resultingManualCols.length > 0 || item.automatedCols.length > 0 ? (
                              <InlineStack gap="100" blockAlign="center" wrap>
                                {item.resultingManualCols.map((c) => {
                                  const isAdded = item.addedCols.some((ac) => ac.id === c.id);
                                  return (
                                    <Badge key={c.id} tone={isAdded ? "success" : undefined}>
                                      {c.title}
                                    </Badge>
                                  );
                                })}
                                {item.automatedCols.length > 0 && (
                                  <Badge tone="info">{`${item.automatedCols.length} automated`}</Badge>
                                )}
                              </InlineStack>
                            ) : (
                              <Text as="span" variant="bodyMd" tone="subdued">
                                (None)
                              </Text>
                            )}
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <InlineStack gap="100" blockAlign="center" wrap>
                              {item.addedCols.length > 0 && (
                                <Badge tone="success">{`+${item.addedCols.length} added`}</Badge>
                              )}
                              {item.removedCols.length > 0 && (
                                <Badge tone="attention">{`-${item.removedCols.length} removed`}</Badge>
                              )}
                              {!item.isChanged && (
                                <Text as="span" variant="bodyMd" tone="subdued">
                                  —
                                </Text>
                              )}
                            </InlineStack>
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  )}

                  <PreviewFooterBar
                    showingCount={displayedCollectionItems.length}
                    totalCount={collectionPreviewItems.length}
                    changedCount={collectionChangedCount}
                    itemLabel="products"
                    actionLabel="Apply Collection Changes"
                    onAction={() => setIsCollectionModalOpen(true)}
                    disabled={
                      selectedCollectionIds.length === 0 &&
                      collectionAction !== "replace"
                    }
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          ) : selectedTab === 5 ? (
            /* Compare-at Price Management Tab */
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Compare-at Price Management
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Set, increase, or decrease compare-at original prices to display sale strike-through discounts on your storefront.
                    </Text>
                  </BlockStack>

                  <InlineStack gap="300" wrap={false} blockAlign="end">
                    <div style={{ width: "240px", flexShrink: 0 }}>
                      <Select
                        label="Adjustment Type"
                        options={compareAtStrategyOptions}
                        value={compareAtStrategy}
                        onChange={setCompareAtStrategy}
                      />
                    </div>

                    {compareAtStrategy !== "clear" && (
                      <div style={{ width: "180px", flexShrink: 0 }}>
                        <TextField
                          label={
                            compareAtStrategy.includes("percent")
                              ? "Percentage (%)"
                              : "Amount ($)"
                          }
                          type="number"
                          min={0}
                          step={compareAtStrategy.includes("percent") ? 1 : 0.01}
                          placeholder={
                            compareAtStrategy.includes("percent") ? "e.g. 20" : "e.g. 39.99"
                          }
                          value={compareAtValue}
                          onChange={setCompareAtValue}
                          autoComplete="off"
                          prefix={
                            compareAtStrategy.includes("percent")
                              ? undefined
                              : "$"
                          }
                          suffix={
                            compareAtStrategy.includes("percent")
                              ? "%"
                              : undefined
                          }
                        />
                      </div>
                    )}

                    <div>
                      <Button
                        variant="primary"
                        onClick={() => setIsCompareAtModalOpen(true)}
                        disabled={compareAtChangedCount === 0 || isSubmitting}
                      >
                        Review & Apply Compare-at Prices
                      </Button>
                    </div>
                  </InlineStack>

                  {compareAtStrategy !== "clear" && !isCompareAtInputValid && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Enter an amount above to preview compare-at price changes, or edit individual prices directly below.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              {/* Compare-at Price Preview Screen */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Compare-at Price Preview
                        </Text>
                        <Badge tone={compareAtChangedCount > 0 ? "attention" : undefined}>
                          {compareAtChangedCount > 0
                            ? `${compareAtChangedCount} of ${compareAtPreviewItems.length} changing`
                            : "No pending changes"}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Calculated from rules above or adjust individual variant compare-at prices directly
                      </Text>
                    </BlockStack>
                    {Object.keys(manualCompareAtOverrides).length > 0 && (
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone="info">{`${Object.keys(manualCompareAtOverrides).length} manual overrides`}</Badge>
                        <Button
                          size="slim"
                          variant="plain"
                          onClick={() => setManualCompareAtOverrides({})}
                        >
                          Reset manual overrides
                        </Button>
                      </InlineStack>
                    )}
                  </InlineStack>

                  <PreviewToolbar
                    search={previewSearch}
                    onSearchChange={setPreviewSearch}
                    filterOnlyChanged={filterOnlyChanged}
                    onFilterOnlyChangedChange={setFilterOnlyChanged}
                    totalCount={compareAtPreviewItems.length}
                    changedCount={compareAtChangedCount}
                    itemLabel="variants"
                  />

                  {displayedCompareAtItems.length === 0 ? (
                    <PreviewEmptyFilter
                      onClear={() => {
                        setPreviewSearch("");
                        setFilterOnlyChanged(false);
                      }}
                    />
                  ) : (
                    <IndexTable
                      resourceName={{ singular: "variant", plural: "variants" }}
                      itemCount={displayedCompareAtItems.length}
                      headings={compareAtPreviewHeadings}
                      selectable={false}
                    >
                      {displayedCompareAtItems.map((item, index) => {
                        const badgeTone = item.isCleared
                          ? undefined
                          : item.diff !== null && item.diff > 0
                            ? "success"
                            : item.diff !== null && item.diff < 0
                              ? "attention"
                              : undefined;

                        const diffFormatted = item.isCleared
                          ? "Cleared"
                          : item.diff === null
                            ? "Set"
                            : item.diff === 0
                              ? "No change"
                              : `${item.diff > 0 ? "+" : ""}$${item.diff.toFixed(2)}`;

                        return (
                          <IndexTable.Row
                            id={item.variantId}
                            key={item.variantId}
                            position={index}
                          >
                            <IndexTable.Cell>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  minWidth: "200px",
                                  flexWrap: "nowrap",
                                }}
                              >
                                <div style={{ flexShrink: 0 }}>
                                  <Thumbnail
                                    source={item.productImage || ImageIcon}
                                    alt={item.productTitle}
                                    size="small"
                                  />
                                </div>
                                <Text
                                  variant="bodyMd"
                                  fontWeight="semibold"
                                  as="span"
                                >
                                  {item.productTitle}
                                </Text>
                              </div>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd">
                                {item.variantTitle === "Default Title"
                                  ? "Single variant"
                                  : item.variantTitle}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd">
                                ${item.currentPrice}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd">
                                {item.currentCompareAt}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Box width="130px">
                                <TextField
                                  label="New Compare-at Price"
                                  labelHidden
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  prefix="$"
                                  placeholder="Clear"
                                  value={
                                    Object.prototype.hasOwnProperty.call(
                                      manualCompareAtOverrides,
                                      item.variantId,
                                    )
                                      ? manualCompareAtOverrides[item.variantId]
                                      : item.newCompareAtNum !== null
                                        ? String(item.newCompareAtNum.toFixed(2))
                                        : ""
                                  }
                                  onChange={(val) => {
                                    setManualCompareAtOverrides((prev) => ({
                                      ...prev,
                                      [item.variantId]: val,
                                    }));
                                  }}
                                  autoComplete="off"
                                />
                              </Box>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <InlineStack gap="100" blockAlign="center" wrap>
                                {!item.isChanged ? (
                                  <Text as="span" variant="bodyMd" tone="subdued">
                                    —
                                  </Text>
                                ) : (
                                  <Badge tone={badgeTone}>{diffFormatted}</Badge>
                                )}
                                {item.isWarning && (
                                  <Badge tone="warning">≤ Price</Badge>
                                )}
                                {item.isCustom && item.isChanged && (
                                  <Badge tone="info">Manual</Badge>
                                )}
                              </InlineStack>
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        );
                      })}
                    </IndexTable>
                  )}

                  <PreviewFooterBar
                    showingCount={displayedCompareAtItems.length}
                    totalCount={compareAtPreviewItems.length}
                    changedCount={compareAtChangedCount}
                    itemLabel="variants"
                    actionLabel="Review & Apply Compare-at Prices"
                    onAction={() => setIsCompareAtModalOpen(true)}
                    disabled={compareAtChangedCount === 0 || isSubmitting}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          ) : (
            /* Vendor & Product Type Management Tab (selectedTab === 6) */
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Vendor & Product Type Management
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Bulk assign brand vendors and categorization product types across all selected products.
                    </Text>
                  </BlockStack>

                  <InlineStack gap="300" wrap={false} blockAlign="end">
                    <Box minWidth="240px">
                      <Select
                        label="Adjustment Scope"
                        options={orgStrategyOptions}
                        value={orgStrategy}
                        onChange={(val) =>
                          setOrgStrategy(
                            val as "both" | "vendor_only" | "type_only",
                          )
                        }
                      />
                    </Box>

                    {orgStrategy !== "type_only" && (
                      <Box minWidth="220px">
                        <TextField
                          label="Target Vendor"
                          value={targetVendor}
                          onChange={setTargetVendor}
                          placeholder="e.g. Acme Corp"
                          autoComplete="off"
                        />
                      </Box>
                    )}

                    {orgStrategy !== "vendor_only" && (
                      <Box minWidth="220px">
                        <TextField
                          label="Target Product Type"
                          value={targetProductType}
                          onChange={setTargetProductType}
                          placeholder="e.g. Apparel, Accessories"
                          autoComplete="off"
                        />
                      </Box>
                    )}

                    <Button
                      variant="primary"
                      onClick={() => setIsOrgModalOpen(true)}
                      disabled={
                        orgStrategy === "both"
                          ? targetVendor.trim().length === 0 &&
                            targetProductType.trim().length === 0
                          : orgStrategy === "vendor_only"
                            ? targetVendor.trim().length === 0
                            : targetProductType.trim().length === 0
                      }
                    >
                      Review & Apply Organization
                    </Button>
                  </InlineStack>

                  {/* Suggestion Chips */}
                  {(existingVendors.length > 0 || existingTypes.length > 0) && (
                    <BlockStack gap="150">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Quick suggestions from selected products:
                      </Text>
                      <InlineStack gap="150" wrap blockAlign="center">
                        {existingVendors.slice(0, 4).map((v) => (
                          <Button
                            key={`vendor-${v}`}
                            size="micro"
                            onClick={() => setTargetVendor(v)}
                          >
                            {`Vendor: ${v}`}
                          </Button>
                        ))}
                        {existingTypes.slice(0, 4).map((t) => (
                          <Button
                            key={`type-${t}`}
                            size="micro"
                            onClick={() => setTargetProductType(t)}
                          >
                            {`Type: ${t}`}
                          </Button>
                        ))}
                      </InlineStack>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              {/* Organization Preview Screen */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">
                          Organization Preview
                        </Text>
                        <Badge tone={orgChangedCount > 0 ? "attention" : undefined}>
                          {`${orgChangedCount} of ${orgPreviewItems.length} changing`}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Review vendor brand and product type category updates across selected products
                      </Text>
                    </BlockStack>
                    <Badge tone="info">{`${products.length} products affected`}</Badge>
                  </InlineStack>

                  <PreviewToolbar
                    search={previewSearch}
                    onSearchChange={setPreviewSearch}
                    filterOnlyChanged={filterOnlyChanged}
                    onFilterOnlyChangedChange={setFilterOnlyChanged}
                    totalCount={orgPreviewItems.length}
                    changedCount={orgChangedCount}
                    itemLabel="products"
                  />

                  {displayedOrgItems.length === 0 ? (
                    <PreviewEmptyFilter
                      onClear={() => {
                        setPreviewSearch("");
                        setFilterOnlyChanged(false);
                      }}
                    />
                  ) : (
                    <IndexTable
                      resourceName={{ singular: "product", plural: "products" }}
                      itemCount={displayedOrgItems.length}
                      headings={orgPreviewHeadings}
                      selectable={false}
                    >
                      {displayedOrgItems.map((item, index) => (
                        <IndexTable.Row
                          id={item.productId}
                          key={item.productId}
                          position={index}
                        >
                          <IndexTable.Cell>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "200px", flexWrap: "nowrap" }}>
                              <div style={{ flexShrink: 0 }}>
                                <Thumbnail
                                  source={item.productImage || ImageIcon}
                                  alt={item.productTitle}
                                  size="small"
                                />
                              </div>
                              <Text variant="bodyMd" fontWeight="semibold" as="span">
                                {item.productTitle}
                              </Text>
                            </div>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd">
                              {item.currentVendor}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            {orgStrategy !== "type_only" ? (
                              <Box width="130px">
                                <TextField
                                  label="New Vendor"
                                  labelHidden
                                  value={item.rawNewVendor}
                                  onChange={(val) => {
                                    setManualOrgOverrides((prev) => ({
                                      ...prev,
                                      [item.productId]: {
                                        ...prev[item.productId],
                                        vendor: val,
                                      },
                                    }));
                                  }}
                                  autoComplete="off"
                                />
                              </Box>
                            ) : (
                              <Text as="span" variant="bodyMd" tone="subdued">
                                (Unchanged)
                              </Text>
                            )}
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd">
                              {item.currentType}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            {orgStrategy !== "vendor_only" ? (
                              <Box width="130px">
                                <TextField
                                  label="New Product Type"
                                  labelHidden
                                  value={item.rawNewType}
                                  onChange={(val) => {
                                    setManualOrgOverrides((prev) => ({
                                      ...prev,
                                      [item.productId]: {
                                        ...prev[item.productId],
                                        productType: val,
                                      },
                                    }));
                                  }}
                                  autoComplete="off"
                                />
                              </Box>
                            ) : (
                              <Text as="span" variant="bodyMd" tone="subdued">
                                (Unchanged)
                              </Text>
                            )}
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <InlineStack gap="100" blockAlign="center">
                              {item.isChanged ? (
                                <Badge tone="attention">Will Update</Badge>
                              ) : (
                                <Text as="span" variant="bodyMd" tone="subdued">
                                  —
                                </Text>
                              )}
                              {item.isCustom && <Badge tone="info">Custom</Badge>}
                            </InlineStack>
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  )}

                  <PreviewFooterBar
                    showingCount={displayedOrgItems.length}
                    totalCount={orgPreviewItems.length}
                    changedCount={orgChangedCount}
                    itemLabel="products"
                    actionLabel="Apply Organization Changes"
                    onAction={handleConfirmOrgUpdate}
                    disabled={
                      (orgStrategy === "both" &&
                        targetVendor.trim() === "" &&
                        targetProductType.trim() === "") ||
                      (orgStrategy === "vendor_only" && targetVendor.trim() === "") ||
                      (orgStrategy === "type_only" && targetProductType.trim() === "")
                    }
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          )}
        </Tabs>

        {/* Price Confirmation Modal */}
        <Modal
          open={isPriceModalOpen}
          onClose={() => setIsPriceModalOpen(false)}
          title="Confirm Price Changes"
          primaryAction={{
            content: "Confirm & Update Prices",
            onAction: handleConfirmPriceUpdate,
            loading: isSubmitting,
            disabled: priceChangedCount === 0 || isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsPriceModalOpen(false),
              disabled: isSubmitting,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                You are about to update prices for{" "}
                <strong>
                  {
                    products.filter((p) =>
                      pricePreviewItems.some(
                        (i) => i.productId === p.id && i.isChanged,
                      ),
                    ).length
                  }{" "}
                  products
                </strong>{" "}
                (<strong>{priceChangedCount} of {pricePreviewItems.length} variants</strong> changing).
              </Text>

              <Box
                background="bg-surface-secondary"
                padding="300"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    <strong>Adjustment Rule:</strong>{" "}
                    {isPriceInputValid
                      ? currentPriceStrategyLabel
                      : "None (manual variant edits only)"}
                  </Text>
                  {isPriceInputValid && (
                    <Text as="p" variant="bodyMd">
                      <strong>Rule Value:</strong>{" "}
                      {priceStrategy.includes("percent")
                        ? `${priceValue}%`
                        : `$${numericPriceValue.toFixed(2)}`}
                    </Text>
                  )}
                  {Object.keys(manualPriceOverrides).length > 0 && (
                    <Text as="p" variant="bodyMd">
                      <strong>Manual Overrides:</strong>{" "}
                      {Object.keys(manualPriceOverrides).length} variant(s) have custom set prices
                    </Text>
                  )}
                  <Text as="p" variant="bodyMd">
                    <strong>Total Variants Changing:</strong>{" "}
                    <Badge tone="attention">{`${priceChangedCount} variant(s)`}</Badge>
                  </Text>
                </BlockStack>
              </Box>

              <Banner tone="warning">
                This change will directly and immediately update product prices
                in your Shopify store and storefront.
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Inventory Confirmation Modal */}
        <Modal
          open={isInventoryModalOpen}
          onClose={() => setIsInventoryModalOpen(false)}
          title="Confirm Inventory Changes"
          primaryAction={{
            content: "Confirm & Update Inventory",
            onAction: handleConfirmInventoryUpdate,
            loading: isSubmitting,
            disabled: inventoryChangedCount === 0 || isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsInventoryModalOpen(false),
              disabled: isSubmitting,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                You are about to update inventory for{" "}
                <strong>
                  {
                    products.filter((p) =>
                      inventoryPreviewItems.some(
                        (i) => i.productId === p.id && i.isChanged,
                      ),
                    ).length
                  }{" "}
                  products
                </strong>{" "}
                (<strong>{inventoryChangedCount} of {inventoryPreviewItems.length} stock levels</strong> changing).
              </Text>

              <Box
                background="bg-surface-secondary"
                padding="300"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    <strong>Adjustment:</strong>{" "}
                    {isInventoryInputValid
                      ? currentInventoryStrategyLabel
                      : "None (manual edits only)"}
                  </Text>
                  {isInventoryInputValid && (
                    <Text as="p" variant="bodyMd">
                      <strong>Quantity:</strong> {numericInventoryValue} units
                    </Text>
                  )}
                  {Object.keys(manualInventoryOverrides).length > 0 && (
                    <Text as="p" variant="bodyMd">
                      <strong>Manual Overrides:</strong>{" "}
                      {Object.keys(manualInventoryOverrides).length} level(s) have custom set quantities
                    </Text>
                  )}
                  <Text as="p" variant="bodyMd">
                    <strong>Stock Levels Changing:</strong>{" "}
                    <Badge tone="attention">{`${inventoryChangedCount} level(s)`}</Badge>
                  </Text>
                </BlockStack>
              </Box>

              <Banner tone="info">
                Inventory cannot drop below 0. Updates will directly adjust your
                Shopify store stock levels.
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Status Confirmation Modal */}
        <Modal
          open={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          title="Confirm Status Changes"
          primaryAction={{
            content: "Confirm & Update Status",
            onAction: handleConfirmStatusUpdate,
            loading: isSubmitting,
            disabled: statusChangedCount === 0 || isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsStatusModalOpen(false),
              disabled: isSubmitting,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                You are about to update the status of{" "}
                <strong>{products.length} products</strong> to{" "}
                <strong>{targetStatus}</strong>.
              </Text>

              <Box
                background="bg-surface-secondary"
                padding="300"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    <strong>New Status:</strong> {targetStatus}
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Products Affected:</strong> {products.length} products
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Products Changing:</strong>{" "}
                    {statusPreviewItems.filter((i) => i.isChanged).length} products
                  </Text>
                  {Object.keys(manualStatusOverrides).length > 0 && (
                    <Text as="p" variant="bodyMd">
                      <strong>Custom Overrides:</strong>{" "}
                      {Object.keys(manualStatusOverrides).length} product(s) have custom selected status
                    </Text>
                  )}
                </BlockStack>
              </Box>

              <Banner tone="warning">
                Updating product status changes product visibility in your Shopify store.
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Tags Confirmation Modal */}
        <Modal
          open={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          title="Confirm Tag Changes"
          primaryAction={{
            content: "Confirm & Update Tags",
            onAction: handleConfirmTagUpdate,
            loading: isSubmitting,
            disabled: tagChangedCount === 0 || isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsTagModalOpen(false),
              disabled: isSubmitting,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                You are about to update tags for{" "}
                <strong>{products.length} products</strong>.
              </Text>

              <Box
                background="bg-surface-secondary"
                padding="300"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    <strong>Action:</strong>{" "}
                    {tagAction === "add"
                      ? "Add Tags"
                      : tagAction === "remove"
                        ? "Remove Tags"
                        : "Replace Tags"}
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Tags:</strong>{" "}
                    {parsedInputTags.length > 0
                      ? parsedInputTags.join(", ")
                      : "(None - clearing all tags)"}
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Products Affected:</strong> {products.length} products
                  </Text>
                  {Object.keys(manualTagInputs).length > 0 && (
                    <Text as="p" variant="bodyMd">
                      <strong>Custom Overrides:</strong>{" "}
                      {Object.keys(manualTagInputs).length} product(s) have custom edited tags
                    </Text>
                  )}
                </BlockStack>
              </Box>

              <Banner tone="info">
                Product tags are used for collections, search, and catalog filtering.
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Collections Confirmation Modal */}
        <Modal
          open={isCollectionModalOpen}
          onClose={() => setIsCollectionModalOpen(false)}
          title="Confirm Collection Changes"
          primaryAction={{
            content: "Confirm & Update Collections",
            onAction: handleConfirmCollectionUpdate,
            loading: isSubmitting,
            disabled: collectionChangedCount === 0 || isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsCollectionModalOpen(false),
              disabled: isSubmitting,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                You are about to update collections for{" "}
                <strong>{products.length} products</strong>.
              </Text>

              <Box
                background="bg-surface-secondary"
                padding="300"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    <strong>Action:</strong> {currentCollectionActionLabel}
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Target Collections:</strong>{" "}
                    {selectedCollectionIds.length > 0
                      ? selectedCollectionIds
                          .map((id) => manualCollectionsMap.get(id) || id)
                          .join(", ")
                      : "(None - clearing all manual collections)"}
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Products Affected:</strong> {products.length} products
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <strong>Products Changing:</strong>{" "}
                    {collectionPreviewItems.filter((i) => i.isChanged).length} products
                  </Text>
                </BlockStack>
              </Box>

              <Banner tone="info">
                This change updates collection memberships for selected products in your Shopify store.
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Compare-at Price Confirmation Modal */}
        <Modal
          open={isCompareAtModalOpen}
          onClose={() => setIsCompareAtModalOpen(false)}
          title="Confirm Compare-at Price Changes"
          primaryAction={{
            content: "Confirm & Update Compare-at Prices",
            onAction: handleConfirmCompareAtUpdate,
            loading: isSubmitting,
            disabled: compareAtChangedCount === 0 || isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsCompareAtModalOpen(false),
              disabled: isSubmitting,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                You are about to update compare-at prices for{" "}
                <strong>
                  {
                    products.filter((p) =>
                      compareAtPreviewItems.some(
                        (i) => i.productId === p.id && i.isChanged,
                      ),
                    ).length
                  }{" "}
                  products
                </strong>{" "}
                (<strong>{compareAtChangedCount} of {compareAtPreviewItems.length} variants</strong> changing).
              </Text>

              <Box
                background="bg-surface-secondary"
                padding="300"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    <strong>Adjustment Rule:</strong>{" "}
                    {isCompareAtInputValid
                      ? currentCompareAtStrategyLabel
                      : "None (manual edits only)"}
                  </Text>
                  {isCompareAtInputValid && (
                    <Text as="p" variant="bodyMd">
                      <strong>Rule Value:</strong>{" "}
                      {compareAtStrategy === "clear"
                        ? "Clear compare-at price"
                        : compareAtStrategy.includes("percent")
                          ? `${compareAtValue}%`
                          : `$${numericCompareAtValue.toFixed(2)}`}
                    </Text>
                  )}
                  {Object.keys(manualCompareAtOverrides).length > 0 && (
                    <Text as="p" variant="bodyMd">
                      <strong>Manual Overrides:</strong>{" "}
                      {Object.keys(manualCompareAtOverrides).length} variant(s) have custom set compare-at prices
                    </Text>
                  )}
                  <Text as="p" variant="bodyMd">
                    <strong>Variants Changing:</strong>{" "}
                    <Badge tone="attention">{`${compareAtChangedCount} variant(s)`}</Badge>
                  </Text>
                </BlockStack>
              </Box>

              <Banner tone="warning">
                This change will directly update compare-at prices in your Shopify store. Compare-at prices greater than selling prices will show strike-through sale prices on your storefront.
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Organization Confirmation Modal */}
        <Modal
          open={isOrgModalOpen}
          onClose={() => setIsOrgModalOpen(false)}
          title="Confirm Vendor & Product Type Changes"
          primaryAction={{
            content: "Confirm & Update Organization",
            onAction: handleConfirmOrgUpdate,
            loading: isSubmitting,
            disabled: orgChangedCount === 0 || isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsOrgModalOpen(false),
              disabled: isSubmitting,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                You are about to update vendor brand and product type categorization for{" "}
                <strong>{products.length} products</strong>.
              </Text>

              <Box
                background="bg-surface-secondary"
                padding="300"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">
                    <strong>Scope:</strong> {currentOrgStrategyLabel}
                  </Text>
                  {orgStrategy !== "type_only" && (
                    <Text as="p" variant="bodyMd">
                      <strong>New Vendor:</strong> {targetVendor.trim() || "(None)"}
                    </Text>
                  )}
                  {orgStrategy !== "vendor_only" && (
                    <Text as="p" variant="bodyMd">
                      <strong>New Product Type:</strong> {targetProductType.trim() || "(None)"}
                    </Text>
                  )}
                  {Object.keys(manualOrgOverrides).length > 0 && (
                    <Text as="p" variant="bodyMd">
                      <strong>Custom Overrides:</strong>{" "}
                      {Object.keys(manualOrgOverrides).length} product(s) have custom set values
                    </Text>
                  )}
                  <Text as="p" variant="bodyMd">
                    <strong>Products Changing:</strong>{" "}
                    {orgPreviewItems.filter((i) => i.isChanged).length} products
                  </Text>
                </BlockStack>
              </Box>

              <Banner tone="warning">
                Updating vendor and product type directly updates store categorization and automated smart collections.
              </Banner>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}
