export type ActorRole = "owner" | "admin" | "operator" | "viewer";

export type ProtectedAction =
  | "review_candidate"
  | "approve_mutation"
  | "execute_mutation"
  | "view_dashboard";

const permissions: Record<ActorRole, readonly ProtectedAction[]> = {
  owner: [
    "review_candidate",
    "approve_mutation",
    "execute_mutation",
    "view_dashboard",
  ],
  admin: [
    "review_candidate",
    "approve_mutation",
    "execute_mutation",
    "view_dashboard",
  ],
  operator: ["review_candidate", "view_dashboard"],
  viewer: ["view_dashboard"],
};

export function canPerformAction(input: {
  role: ActorRole;
  action: ProtectedAction;
}): boolean {
  return permissions[input.role].includes(input.action);
}
