import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const csvContent = [
    "Handle,Title,SKU,Price,Compare At Price,Inventory,Tags,Vendor,Product Type",
    `classic-tee,Classic Cotton T-Shirt,TSHIRT-BLK-M,29.99,39.99,50,"apparel, summer, cotton",Acme Apparel,Clothing`,
    `snowboard,All-Mountain Snowboard,BOARD-158,299.99,349.99,15,"winter, sports, outdoor",Apex Gear,Snowboards`,
    `wool-beanie,Merino Wool Beanie,BEANIE-GRY,18.50,24.00,40,"accessories, winter, warm",Nordic Knits,Accessories`,
    `canvas-sneakers,Low-Top Canvas Sneakers,SHOE-WHT-10,54.00,65.00,25,"footwear, casual, shoes",Urban Stride,Shoes`,
    `insulated-water-bottle,Stainless Steel Water Bottle,BOTTLE-32OZ,24.95,,80,"hydration, eco, accessories",HydroPeak,Accessories`,
  ].join("\n");

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="catalog_update_template.csv"',
    },
  });
};
