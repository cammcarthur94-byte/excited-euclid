import {
  PLAN_MONTHLY,
  PLAN_PRO,
  PLANS,
  type PlanName,
  type PaidPlanName,
  type PlanDetails,
} from "./billing-plans";

export { PLAN_MONTHLY, PLAN_PRO, PLANS };
export type { PlanName, PaidPlanName, PlanDetails };

export interface MerchantBillingStatus {
  hasActivePayment: boolean;
  subscription?: { name: string; id: string; test: boolean };
  details: PlanDetails;
}

/**
 * Checks if the merchant has an active $9.99/mo subscription using Shopify Managed Billing.
 * Catalog Commander has no free plan; it is exclusively a $9.99/month subscription app.
 */
export async function getMerchantPlan(billingContext: {
  check: (options?: { plans?: PaidPlanName[]; isTest?: boolean }) => Promise<{
    hasActivePayment: boolean;
    appSubscriptions: Array<{ name: string; id: string; test: boolean }>;
  }>;
}): Promise<MerchantBillingStatus> {
  const isTestMode =
    process.env.NODE_ENV !== "production" ||
    process.env.SHOPIFY_BILLING_TEST === "true";

  try {
    const check = await billingContext.check({
      plans: [PLAN_MONTHLY],
      isTest: isTestMode,
    });

    if (check.hasActivePayment && check.appSubscriptions.length > 0) {
      return {
        hasActivePayment: true,
        subscription: check.appSubscriptions[0],
        details: PLANS[PLAN_MONTHLY],
      };
    }
  } catch (error) {
    console.error("[Billing] Error checking active subscription:", error);
  }

  // Merchant does not have an active paid subscription ($9.99/month required)
  return {
    hasActivePayment: false,
    details: PLANS[PLAN_MONTHLY],
  };
}
