import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return <ModulePage href="/documents" />;
}
