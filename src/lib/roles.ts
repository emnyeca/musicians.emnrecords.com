import catalog from "../../server/role-catalog.json";
export const ROLE_GROUPS = catalog.groups;
export const ROLE_OPTIONS: string[] = Object.values(ROLE_GROUPS).flat();
export function canonicalRole(role: string): string {
  const key = role.trim().toLowerCase();
  return ROLE_OPTIONS.find((r) => r.toLowerCase() === key) ?? (catalog.aliases as Record<string, string>)[key] ?? role.trim();
}
export function roleTags(roles: string[]): string[] {
  return [...new Set(roles.map((r) => ROLE_OPTIONS.includes(canonicalRole(r)) ? canonicalRole(r) : "Other"))];
}
