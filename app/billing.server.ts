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
  try {
    // 1. Check for real active paid subscription (production)
    const checkProd = await billingContext.check({
      plans: [PLAN_MONTHLY],
      isTest: false,
    });

    if (checkProd.hasActivePayment && checkProd.appSubscriptions.length > 0) {
      return {
        hasActivePayment: true,
        subscription: checkProd.appSubscriptions[0],
        details: PLANS[PLAN_MONTHLY],
      };
    }

    // 2. Also check for test subscriptions (allows test stores and review testing)
    const checkTest = await billingContext.check({
      plans: [PLAN_MONTHLY],
      isTest: true,
    });

    if (checkTest.hasActivePayment && checkTest.appSubscriptions.length > 0) {
      return {
        hasActivePayment: true,
        subscription: checkTest.appSubscriptions[0],
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
