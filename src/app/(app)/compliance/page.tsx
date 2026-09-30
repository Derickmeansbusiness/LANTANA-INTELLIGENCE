import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Compliance" };

export default function Page() {
  return <ModulePage href="/compliance" />;
}
