import { redirect } from "next/navigation";
import { getConnection, getUser } from "../../lib/session";
import DashboardClient, { type DashboardSection } from "./DashboardClient";

export const metadata = { title: "Dashboard", description: "Monitor and manage your connected n8n instance." };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const active = await getConnection();
  const saved = active || await getConnection(undefined, true);
  const requested = (await searchParams).section;
  const initialSection: DashboardSection = requested && ["overview", "workflows", "executions", "ai", "account"].includes(requested)
    ? requested as DashboardSection
    : "overview";
  return <DashboardClient initialSection={initialSection} initialConnection={{ connected: Boolean(active), saved: Boolean(saved), mode: active?.mode || null, baseUrl: saved?.baseUrl || null, user: { name: user.name, email: user.email } }} />;
}
