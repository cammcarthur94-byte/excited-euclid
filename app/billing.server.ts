import {
  PLAN_FREE,
  PLAN_MONTHLY,
  PLAN_PRO,
  PLANS,
  type PlanName,
  type PaidPlanName,
  type PlanDetails,
} from "./billing-plans";

export { PLAN_FREE, PLAN_MONTHLY, PLAN_PRO, PLANS };
export type { PlanName, PaidPlanName, PlanDetails };

/**
 * Checks the merchant's active plan using Shopify Managed Billing.
 * Falls back to Free tier if no paid subscription is active.
 */
export async function getMerchantPlan(billingContext: {
  check: (options?: { plans?: PaidPlanName[]; isTest?: boolean }) => Promise<{
    hasActivePayment: boolean;
    appSubscriptions: Array<{ name: string; id: string; test: boolean }>;
  }>;
}): Promise<{
  activePlan: PlanName;
  subscription?: { name: string; id: string; test: boolean };
  details: PlanDetails;
}> {
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
        activePlan: PLAN_MONTHLY,
        subscription: check.appSubscriptions[0],
        details: PLANS[PLAN_MONTHLY],
      };
    }
  } catch (error) {
    console.error("[Billing] Error checking active subscription, defaulting to Free:", error);
  }

  // Merchant does not have an active paid subscription; return Free plan
  return {
    activePlan: PLAN_FREE,
    details: PLANS[PLAN_FREE],
  };
}

/**
 * Gate helper to verify if the merchant's plan satisfies a required feature/plan.
 * Returns true for all features to ensure all catalog tools are active.
 */
export function hasFeatureAccess(
  _activePlan: PlanName,
  _feature: keyof PlanDetails["limits"],
  _requiredValue?: number
): boolean {
  return true;
}
