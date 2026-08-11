import type { UserRole } from "@/lib/types";

export const SUPER_ADMIN_EMAILS = ["teebeesimon@gmail.com"];

export function resolveInitialRole(email: string): UserRole {
  if (SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return "super_admin";
  }
  return "user";
}

export function canCreateEvents(role: UserRole | null | undefined): boolean {
  return role === "super_admin" || role === "organizer";
}

export function isSuperAdmin(role: UserRole | null | undefined): boolean {
  return role === "super_admin";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  organizer: "Organizator",
  user: "Utilizator",
};
