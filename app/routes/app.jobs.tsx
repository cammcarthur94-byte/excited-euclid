import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

interface BulkJobRecord {
  id: string;
  action: string;
  status: string;
  productsAffected: number;
  details: string | null;
  createdAt: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const rawJobs = await db.bulkJob.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const jobs: BulkJobRecord[] = rawJobs.map((job) => ({
    id: job.id,
    action: job.action,
    status: job.status,
    productsAffected: job.productsAffected,
    details: job.details,
    createdAt: job.createdAt.toISOString(),
  }));

  return { jobs };
};

export default function JobsPage() {
  const { jobs } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const headings: [{ title: string }, ...{ title: string }[]] = [
    { title: "Date" },
    { title: "Action" },
    { title: "Status" },
    { title: "Products Affected" },
    { title: "Details" },
  ];

  return (
    <Page
      title="Job History"
      subtitle="Track and audit completed bulk updates and catalog modifications"
    >
      <BlockStack gap="400">
        <Card>
          {jobs.length === 0 ? (
            <EmptyState
              heading="No job history yet"
              action={{
                content: "Go to Products",
                onAction: () => navigate("/app/products"),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2766/files/emptystate-files.png"
            >
              <p>
                When you run bulk price or inventory updates on your products,
                they will appear here in your job history.
              </p>
            </EmptyState>
          ) : (
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Bulk Operation Records
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Recent price, inventory, and status modifications applied to your store
                  </Text>
                </BlockStack>
                <Badge tone="info">{`${jobs.length} total operations`}</Badge>
              </InlineStack>

              <IndexTable
              resourceName={{ singular: "job", plural: "jobs" }}
              itemCount={jobs.length}
              headings={headings}
              selectable={false}
            >
              {jobs.map((job, index) => {
                const dateFormatted = new Date(job.createdAt).toLocaleString(
                  undefined,
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  },
                );

                const statusTone =
                  job.status === "COMPLETED"
                    ? "success"
                    : job.status === "FAILED"
                      ? "critical"
                      : "info";

                return (
                  <IndexTable.Row id={job.id} key={job.id} position={index}>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {dateFormatted}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd">
                        {job.action}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={statusTone}>{job.status}</Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd">
                        {job.productsAffected}{" "}
                        {job.productsAffected === 1 ? "product" : "products"}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd" tone="subdued">
                        {job.details || "—"}
                      </Text>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          </BlockStack>
        )}
      </Card>
      </BlockStack>
    </Page>
  );
}
