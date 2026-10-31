import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { loadShellData } from "@/components/shell/shell-data";

// Guard rule 5 (02_AppFlow §2): a non-member of the organization gets 404, never 403.
export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const data = await loadShellData(orgSlug);
  if (!data || !data.currentOrg) notFound();
  return <AppShell data={data}>{children}</AppShell>;
}
