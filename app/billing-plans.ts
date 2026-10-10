export const PLAN_FREE = "Free" as const;
export const PLAN_MONTHLY = "Pro" as const;
// Kept for backward-compatibility aliases
export const PLAN_PRO = PLAN_MONTHLY;

export type PlanName = typeof PLAN_FREE | typeof PLAN_MONTHLY;
export type PaidPlanName = typeof PLAN_MONTHLY;

export interface PlanDetails {
  name: PlanName;
  price: string;
  period: string;
  description: string;
  features: string[];
  limits: {
    maxBulkEditProducts: number;
    allowCsvImport: boolean;
    allowInventoryBulkEdit: boolean;
    allowPriceBulkEdit: boolean;
    allowTagEditing: boolean;
    prioritySupport: boolean;
  };
}

export const PLANS: Record<PlanName, PlanDetails> = {
  [PLAN_FREE]: {
    name: PLAN_FREE,
    price: "$0",
    period: "forever",
    description: "Basic catalog viewing and job history.",
    features: [
      "Browse and search full product catalog",
      "View catalog health and metrics",
      "View job history logs",
      "Subscribe to unlock all bulk editing features",
    ],
    limits: {
      maxBulkEditProducts: Infinity,
      allowCsvImport: true,
      allowInventoryBulkEdit: true,
      allowPriceBulkEdit: true,
      allowTagEditing: true,
      prioritySupport: true,
    },
  },
  [PLAN_MONTHLY]: {
    name: PLAN_MONTHLY,
    price: "$9.99",
    period: "month",
    description: "Flat monthly pricing with complete, unlimited access to all bulk editing tools.",
    features: [
      "Unlimited products per bulk edit batch",
      "Bulk price & compare-at price editing",
      "Bulk inventory adjustments with stock protection",
      "Collections management (Add, Remove, Replace)",
      "Vendor and Product Type management",
      "Tag management & synchronization",
      "Full CSV spreadsheet import",
      "Complete job audit trail and reporting",
    ],
    limits: {
      maxBulkEditProducts: Infinity,
      allowCsvImport: true,
      allowInventoryBulkEdit: true,
      allowPriceBulkEdit: true,
      allowTagEditing: true,
      prioritySupport: true,
    },
  },
};

