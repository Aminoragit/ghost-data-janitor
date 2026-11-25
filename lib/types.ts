export interface DataRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  last_login: string; // ISO date (YYYY-MM-DD) or ""
  status: string; // active | inactive | dormant | ...
  created_at: string; // ISO date
  login_count: number;
}

export type Category = "DUPLICATE" | "GHOST" | "ANOMALY" | "HEALTHY";
export type Action = "DELETE" | "MERGE" | "ARCHIVE" | "KEEP";
export type Risk = "HIGH" | "MEDIUM" | "LOW";
export type Decision = "pending" | "approved" | "rejected";

export interface Finding {
  recordId: string;
  category: Category;
  action: Action;
  reason: string;
  risk: Risk;
  /** duplicate group key, when category === DUPLICATE */
  groupId?: string;
  /** id of the primary record that survives a merge */
  primaryId?: string;
}

export interface AuditEntry {
  at: string; // ISO timestamp
  actor: "engine" | "human" | "system";
  event: string;
  detail: string;
}
