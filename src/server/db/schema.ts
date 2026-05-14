import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const actorRoleEnum = pgEnum("actor_role", [
  "owner",
  "admin",
  "operator",
  "viewer",
]);

export const uploadStatusEnum = pgEnum("upload_status", [
  "uploaded",
  "parsing",
  "parsed",
  "failed",
  "retained",
  "expired",
]);

export const approvalStateEnum = pgEnum("approval_state", [
  "candidate",
  "pending_approval",
  "approved",
  "executing",
  "succeeded",
  "failed",
  "reverted",
  "expired",
  "rejected",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "leased",
  "running",
  "succeeded",
  "failed",
  "retrying",
  "dead_lettered",
  "cancelled",
]);

export const alertSeverityEnum = pgEnum("alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const actors = pgTable(
  "actors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: actorRoleEnum("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("actors_email_unique").on(table.email)],
);

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    status: uploadStatusEnum("status").notNull().default("uploaded"),
    blobUrl: text("blob_url").notNull(),
    blobKey: text("blob_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type"),
    byteSize: integer("byte_size").notNull(),
    checksum: text("checksum").notNull(),
    uploadedByActorId: uuid("uploaded_by_actor_id").references(() => actors.id),
    retentionDeadline: timestamp("retention_deadline", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uploads_checksum_unique").on(table.checksum),
    index("uploads_status_idx").on(table.status),
  ],
);

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploadId: uuid("upload_id")
      .notNull()
      .references(() => uploads.id),
    status: text("status").notNull().default("queued"),
    processedRows: integer("processed_rows").notNull().default(0),
    totalRows: integer("total_rows"),
    checkpoint: jsonb("checkpoint").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("import_batches_status_idx").on(table.status)],
);

export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id),
    rowNumber: integer("row_number").notNull(),
    normalized: jsonb("normalized").notNull(),
    rawPayloadRef: text("raw_payload_ref"),
    validationErrors: jsonb("validation_errors").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("import_rows_batch_row_unique").on(
      table.batchId,
      table.rowNumber,
    ),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerProductId: text("seller_product_id").notNull(),
    vendorItemId: text("vendor_item_id").notNull(),
    externalVendorSku: text("external_vendor_sku"),
    ownerclanProductCode: text("ownerclan_product_code"),
    ownerclanOptionCode: text("ownerclan_option_code"),
    productName: text("product_name").notNull(),
    status: text("status").notNull().default("unknown"),
    nonWinnerCount: integer("non_winner_count").notNull().default(0),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    hasOpenClaim: boolean("has_open_claim").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("products_vendor_item_unique").on(table.vendorItemId),
    index("products_seller_product_idx").on(table.sellerProductId),
    index("products_external_sku_idx").on(table.externalVendorSku),
  ],
);

export const nonWinnerCandidates = pgTable(
  "non_winner_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id),
    productId: uuid("product_id").references(() => products.id),
    vendorId: text("vendor_id").notNull(),
    sellerProductId: text("seller_product_id").notNull(),
    vendorItemId: text("vendor_item_id").notNull(),
    actionType: text("action_type").notNull().default("sales_stop"),
    status: text("status").notNull().default("pending_approval"),
    reason: text("reason").notNull(),
    riskFlags: jsonb("risk_flags").notNull().default([]),
    approvalHash: text("approval_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("non_winner_candidates_approval_hash_unique").on(
      table.approvalHash,
    ),
    index("non_winner_candidates_status_idx").on(table.status),
    index("non_winner_candidates_vendor_item_idx").on(table.vendorItemId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: text("order_id").notNull(),
    shipmentBoxId: text("shipment_box_id"),
    vendorItemId: text("vendor_item_id"),
    ownerclanProductCode: text("ownerclan_product_code"),
    orderStatus: text("order_status").notNull(),
    buyerNameMasked: text("buyer_name_masked"),
    receiverInfoEncrypted: text("receiver_info_encrypted"),
    shippingAddressHash: text("shipping_address_hash"),
    isCancelRequested: boolean("is_cancel_requested").notNull().default(false),
    isReturnRequested: boolean("is_return_requested").notNull().default(false),
    fulfillmentStatus: text("fulfillment_status").notNull().default("pending"),
    rawPayloadRef: text("raw_payload_ref"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_id_unique").on(table.orderId),
    index("orders_status_idx").on(table.orderStatus),
    index("orders_fulfillment_status_idx").on(table.fulfillmentStatus),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id),
    coupangOrderId: text("coupang_order_id").notNull(),
    ownerclanOrderId: text("ownerclan_order_id"),
    shipmentBoxId: text("shipment_box_id"),
    courierCode: text("courier_code"),
    trackingNumberMasked: text("tracking_number_masked"),
    uploadedToCoupang: boolean("uploaded_to_coupang").notNull().default(false),
    uploadError: text("upload_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shipments_coupang_order_idx").on(table.coupangOrderId),
    index("shipments_uploaded_idx").on(table.uploadedToCoupang),
  ],
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    state: approvalStateEnum("state").notNull().default("candidate"),
    actionType: text("action_type").notNull(),
    vendorId: text("vendor_id").notNull(),
    targetIds: jsonb("target_ids").notNull(),
    payload: jsonb("payload").notNull(),
    approvalHash: text("approval_hash").notNull(),
    requestedByActorId: uuid("requested_by_actor_id").references(
      () => actors.id,
    ),
    approvedByActorId: uuid("approved_by_actor_id").references(() => actors.id),
    reason: text("reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("approvals_hash_unique").on(table.approvalHash),
    index("approvals_state_idx").on(table.state),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    payloadRef: text("payload_ref"),
    idempotencyKey: text("idempotency_key").notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    checkpoint: jsonb("checkpoint").notNull().default({}),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("jobs_idempotency_unique").on(table.idempotencyKey),
    index("jobs_lease_idx").on(table.status, table.scheduledFor),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    status: jobStatusEnum("status").notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    checkpoint: jsonb("checkpoint").notNull().default({}),
    processedCount: integer("processed_count").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("job_runs_status_idx").on(table.status)],
);

export const apiRequestLogs = pgTable(
  "api_request_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    requestHash: text("request_hash").notNull(),
    statusCode: integer("status_code"),
    durationMs: integer("duration_ms"),
    rateLimitBucket: text("rate_limit_bucket"),
    redactedRequest: jsonb("redacted_request"),
    redactedResponse: jsonb("redacted_response"),
    redactedError: text("redacted_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("api_request_logs_hash_unique").on(table.requestHash),
    index("api_request_logs_provider_status_idx").on(
      table.provider,
      table.statusCode,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(),
    actorId: uuid("actor_id").references(() => actors.id),
    approvalId: uuid("approval_id").references(() => approvals.id),
    previousState: text("previous_state"),
    nextState: text("next_state"),
    requestHash: text("request_hash"),
    reason: text("reason"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("audit_logs_event_type_idx").on(table.eventType)],
);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  severity: alertSeverityEnum("severity").notNull().default("info"),
  message: text("message").notNull(),
  relatedOrderId: text("related_order_id"),
  relatedProductId: text("related_product_id"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  target: text("target"),
  severity: alertSeverityEnum("severity").notNull().default("info"),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const integrationAccounts = pgTable(
  "integration_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("not_configured"),
    credentialRef: text("credential_ref"),
    lastSmokeTestAt: timestamp("last_smoke_test_at", { withTimezone: true }),
    lastSmokeTestStatus: text("last_smoke_test_status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("integration_provider_unique").on(table.provider)],
);

export const deadLetters = pgTable("dead_letters", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceJobRunId: uuid("source_job_run_id").references(() => jobRuns.id),
  reason: text("reason").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
