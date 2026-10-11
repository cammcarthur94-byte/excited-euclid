export const PLAN_MONTHLY = "Pro" as const;
export const PLAN_PRO = PLAN_MONTHLY;

export type PlanName = typeof PLAN_MONTHLY;
export type PaidPlanName = typeof PLAN_MONTHLY;

export interface PlanDetails {
  name: PlanName;
  price: string;
  amount: number;
  period: string;
  description: string;
  features: string[];
}

export const PLANS: Record<PlanName, PlanDetails> = {
  [PLAN_MONTHLY]: {
    name: PLAN_MONTHLY,
    price: "$9.99",
    amount: 9.99,
    period: "month",
    description: "Flat monthly subscription with complete, unlimited access to all bulk editing and catalog management tools.",
    features: [
      "Unlimited products per bulk edit batch",
      "Bulk price & compare-at price editing",
      "Bulk inventory adjustments with stock protection",
      "Collections management (Add, Remove, Replace)",
      "Vendor and Product Type management",
      "Tag management & synchronization",
      "Full CSV spreadsheet import & catalog synchronization",
      "Complete job audit trail and reporting",
    ],
  },
};
