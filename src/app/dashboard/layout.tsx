import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { loadShellData } from "@/components/shell/shell-data";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const data = await loadShellData(null);
  if (!data) notFound(); // middleware already redirects guests
  return <AppShell data={data}>{children}</AppShell>;
}
