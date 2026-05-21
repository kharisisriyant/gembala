import { db } from "@/db";
import { auditLogs } from "@/db/schema";

interface AuditParams {
  churchId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  diff?: Record<string, unknown>;
}

export async function logAudit(params: AuditParams) {
  await db.insert(auditLogs).values({
    churchId: params.churchId,
    actorUserId: params.actorUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    diffJson: params.diff ? JSON.stringify(params.diff) : null,
  });
}
