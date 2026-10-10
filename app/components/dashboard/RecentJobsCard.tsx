import {
  Badge,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Text,
} from "@shopify/polaris";

export interface BulkJobSummary {
  id: string;
  action: string;
  status: string;
  productsAffected: number;
  details: string | null;
  createdAt: string;
}

interface RecentJobsCardProps {
  jobs: BulkJobSummary[];
  onViewAllJobs: () => void;
  onNewJob: () => void;
}

export function RecentJobsCard({
  jobs,
  onViewAllJobs,
  onNewJob,
}: RecentJobsCardProps) {
  const getStatusTone = (
    status: string,
  ): "success" | "info" | "attention" | "critical" | undefined => {
    switch (status.toUpperCase()) {
      case "COMPLETED":
        return "success";
      case "RUNNING":
      case "PROCESSING":
        return "info";
      case "FAILED":
        return "critical";
      case "CANCELLED":
        return "attention";
      default:
        return undefined;
    }
  };

  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const headings: [{ title: string }, ...{ title: string }[]] = [
    { title: "Timestamp" },
    { title: "Operation" },
    { title: "Status" },
    { title: "Products Affected" },
    { title: "Details" },
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Recent Bulk Operations
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Audit log of catalog modifications, price updates, and CSV imports.
            </Text>
          </BlockStack>
          <InlineStack gap="200" blockAlign="center">
            {jobs.length > 0 && (
              <Button variant="plain" onClick={onViewAllJobs}>
                View all jobs →
              </Button>
            )}
          </InlineStack>
        </InlineStack>

        {jobs.length === 0 ? (
          <EmptyState
            heading="No catalog operations executed yet"
            action={{
              content: "Start Bulk Edit",
              onAction: onNewJob,
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              When you edit prices, adjust inventory, or run CSV imports, your
              operation history and affected products will be logged here.
            </p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "job", plural: "jobs" }}
            itemCount={jobs.length}
            headings={headings}
            selectable={false}
          >
            {jobs.map((job, index) => (
              <IndexTable.Row id={job.id} key={job.id} position={index}>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {formatDate(job.createdAt)}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {job.action}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={getStatusTone(job.status)}>
                    {job.status}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodyMd">
                    {job.productsAffected} product
                    {job.productsAffected === 1 ? "" : "s"}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {job.details || "—"}
                  </Text>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </BlockStack>
    </Card>
  );
}
