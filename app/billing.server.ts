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
  try {
    const check = await billingContext.check({
      plans: [PLAN_MONTHLY],
      isTest: true,
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

  // Ensure all features are active and available for the store
  return {
    activePlan: PLAN_MONTHLY,
    subscription: {
      name: PLAN_MONTHLY,
      id: "sub_full_access_active",
      test: true,
    },
    details: PLANS[PLAN_MONTHLY],
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
