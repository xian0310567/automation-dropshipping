export type ActorRole = "owner" | "admin" | "operator" | "viewer";

export type ProtectedAction =
  | "manage_workspace"
  | "invite_member"
  | "manage_integration_credentials"
  | "upload_file"
  | "review_candidate"
  | "approve_mutation"
  | "execute_mutation"
  | "view_dashboard"
  | "view_notification";

const permissions: Record<ActorRole, readonly ProtectedAction[]> = {
  owner: [
    "manage_workspace",
    "invite_member",
    "manage_integration_credentials",
    "upload_file",
    "review_candidate",
    "approve_mutation",
    "execute_mutation",
    "view_dashboard",
    "view_notification",
  ],
  admin: [
    "manage_workspace",
    "invite_member",
    "manage_integration_credentials",
    "upload_file",
    "review_candidate",
    "approve_mutation",
    "execute_mutation",
    "view_dashboard",
    "view_notification",
  ],
  operator: [
    "upload_file",
    "review_candidate",
    "view_dashboard",
    "view_notification",
  ],
  viewer: ["view_dashboard", "view_notification"],
};

export function canPerformAction(input: {
  role: ActorRole;
  action: ProtectedAction;
}): boolean {
  return permissions[input.role].includes(input.action);
}
