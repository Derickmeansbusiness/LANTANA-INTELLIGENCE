import type { Role } from "@/server/session";

export type ShellUser = {
  id: string;
  fullName: string;
  title: string | null;
  email: string;
  role: Role;
  isPrincipal: boolean;
  mfaPending: boolean;
};
