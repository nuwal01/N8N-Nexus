import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getConnection, getUser } from "../../lib/session";
import DashboardClient from "./DashboardClient";

export const metadata = { title: "Dashboard", description: "Monitor and manage your connected n8n instance." };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const requestHeaders = await headers();
  const request = new Request("http://nexus.local/dashboard", { headers: requestHeaders });
  const user = await getUser(request);
  if (!user) redirect("/login");
  const active = await getConnection(request);
  const saved = active || await getConnection(request, true);
  return <DashboardClient initialConnection={{ connected: Boolean(active), saved: Boolean(saved), mode: active?.mode || null, baseUrl: saved?.baseUrl || null, user: { name: user.name, email: user.email } }} />;
}
