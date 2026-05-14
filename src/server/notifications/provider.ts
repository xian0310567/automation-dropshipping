export type NotificationSeverity = "info" | "warning" | "critical";

export type NotificationRequest = {
  severity: NotificationSeverity;
  title: string;
  detail: string;
};

export interface NotificationProvider {
  send(request: NotificationRequest): Promise<{ ok: boolean; id?: string }>;
}

export function buildNotificationMessage(request: NotificationRequest): string {
  return `[${request.severity}] ${request.title} - ${request.detail}`;
}
