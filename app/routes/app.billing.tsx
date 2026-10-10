import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  Icon,
  InlineStack,
  Layout,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { CheckCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getMerchantPlan } from "../billing.server";
import { PLAN_MONTHLY, PLANS } from "../billing-plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const planInfo = await getMerchantPlan(billing);

  return json({
    activePlan: planInfo.activePlan,
    subscription: planInfo.subscription,
    plan: PLANS[PLAN_MONTHLY],
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string | null;

  if (intent === "cancel") {
    const planInfo = await getMerchantPlan(billing);
    if (planInfo.subscription?.id) {
      try {
        await billing.cancel({
          subscriptionId: planInfo.subscription.id,
          isTest: true,
          prorate: true,
        });
        return json({ success: true, message: "Subscription cancelled successfully." });
      } catch (err: any) {
        return json({ success: false, error: err.message || "Failed to cancel subscription." }, { status: 400 });
      }
    }
    return json({ success: true, message: "No active subscription to cancel." });
  }

  if (intent === "subscribe") {
    const shopHost = session.shop.replace(".myshopify.com", "");
    const apiKey = process.env.SHOPIFY_API_KEY || "b0daba369e048eda0508646744da6d6f";
    const returnUrl = `https://admin.shopify.com/store/${shopHost}/apps/${apiKey}/app/billing`;

    return await billing.request({
      plan: PLAN_MONTHLY,
      isTest: true,
      returnUrl,
    });
  }

  return json({ success: false, error: "Invalid request." }, { status: 400 });
};

export default function BillingRoute() {
  const { activePlan, subscription, plan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const isSubscribed = activePlan === PLAN_MONTHLY;

  const handleSubscribe = () => {
    submit({ intent: "subscribe" }, { method: "post" });
  };

  const handleCancel = () => {
    if (window.confirm("Are you sure you want to cancel your monthly subscription?")) {
      submit({ intent: "cancel" }, { method: "post" });
    }
  };

  return (
    <Page
      title="App Subscription"
      subtitle="Flat-rate pricing of $9.99/month for unlimited catalog management tools."
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <BlockStack gap="500">
        {actionData && "error" in actionData && actionData.error && (
          <Banner title="Billing Error" tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {actionData && "message" in actionData && actionData.message && (
          <Banner title="Subscription Updated" tone="success">
            <p>{actionData.message}</p>
          </Banner>
        )}

        {/* Current Subscription Status */}
        <Card>
          <InlineStack align="space-between" blockAlign="center" gap="400" wrap>
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                Current Subscription Status
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {isSubscribed ? (
                  <>
                    Your store is on the active{" "}
                    <Text as="span" fontWeight="bold">
                      Full Access ($9.99/mo)
                    </Text>{" "}
                    plan.
                    {subscription?.test ? " (Test Subscription Active)" : ""}
                  </>
                ) : (
                  "You currently do not have an active subscription. Subscribe below to unlock all bulk editing features."
                )}
              </Text>
            </BlockStack>
            <InlineStack gap="200" blockAlign="center">
              <Badge tone={isSubscribed ? "success" : "attention"}>
                {isSubscribed ? "Active ($9.99/mo)" : "Inactive"}
              </Badge>
              {isSubscribed && (
                <Button
                  tone="critical"
                  variant="secondary"
                  loading={isSubmitting}
                  onClick={handleCancel}
                >
                  Cancel Subscription
                </Button>
              )}
            </InlineStack>
          </InlineStack>
        </Card>

        {/* Flat Pricing Plan Card */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingLg">
                      Full Access Plan
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {plan.description}
                    </Text>
                  </BlockStack>
                  <Badge tone="info">All Features Included</Badge>
                </InlineStack>

                <BlockStack gap="100">
                  <InlineStack gap="100" blockAlign="baseline" align="start">
                    <Text as="span" variant="heading2xl">
                      {plan.price}
                    </Text>
                    <Text as="span" tone="subdued" variant="bodyMd">
                      / {plan.period}
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Flat rate. No tiers, no hidden usage fees, no per-item charges.
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <Text as="h4" variant="headingSm">
                    Everything included in your subscription:
                  </Text>
                  <BlockStack gap="250">
                    {plan.features.map((feature, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          width: "100%",
                        }}
                      >
                        <div
                          style={{
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon source={CheckCircleIcon} tone="success" />
                        </div>
                        <Text as="span" variant="bodyMd">
                          {feature}
                        </Text>
                      </div>
                    ))}
                  </BlockStack>
                </BlockStack>

                <Box paddingBlockStart="200">
                  {isSubscribed ? (
                    <Button fullWidth size="large" disabled>
                      ✓ Plan is Active on Your Store
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      size="large"
                      variant="primary"
                      loading={isSubmitting}
                      onClick={handleSubscribe}
                    >
                      Subscribe Now for $9.99 / month
                    </Button>
                  )}
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Billing FAQs & Information */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Billing Details
                  </Text>
                  <List type="bullet">
                    <List.Item>
                      <strong>Managed by Shopify:</strong> Charges appear directly on your regular monthly Shopify bill.
                    </List.Item>
                    <List.Item>
                      <strong>30-Day Cycle:</strong> Subscription renews every 30 days automatically.
                    </List.Item>
                    <List.Item>
                      <strong>Cancel Anytime:</strong> Easily cancel whenever you want with no penalty.
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Questions or Support?
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Our team is here to assist with catalog management questions or billing assistance.
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
