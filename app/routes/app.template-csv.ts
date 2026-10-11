import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const rows = [
    "Handle,Title,SKU,Price,Compare At Price,Inventory,Tags,Vendor,Product Type",
    `classic-cotton-t-shirt,Classic Cotton T-Shirt,TSHIRT-BLK-M,29.99,39.99,50,"apparel, summer, cotton",Acme Apparel,Clothing`,
    `all-mountain-snowboard,All-Mountain Snowboard,BOARD-158,299.99,349.99,15,"winter, sports, outdoor",Apex Gear,Snowboards`,
    `merino-wool-beanie,Merino Wool Beanie,BEANIE-GRY,18.50,24.00,40,"accessories, winter, warm",Nordic Knits,Accessories`,
    `low-top-canvas-sneakers,Low-Top Canvas Sneakers,SHOE-WHT-10,54.00,65.00,25,"footwear, casual, shoes",Urban Stride,Shoes`,
    `stainless-steel-water-bottle,Stainless Steel Water Bottle,BOTTLE-32OZ,24.95,34.95,80,"hydration, eco, accessories",HydroPeak,Accessories`,
    `trail-running-backpack,Trail Running Backpack,PACK-20L-BLU,79.00,95.00,30,"outdoor, hiking, packs",Apex Gear,Bags`,
  ];

  // Include UTF-8 BOM (\uFEFF) and CRLF for Excel and spreadsheet viewers
  const csvContent = "\uFEFF" + rows.join("\r\n") + "\r\n";

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="catalog_update_template.csv"',
    },
  });
};
