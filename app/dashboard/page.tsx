import { headers } from "next/headers";
import { getConnectionFromCookieHeader } from "../../lib/session";
import DashboardClient from "./DashboardClient";

export const metadata = { title: "Dashboard", description: "Monitor and manage your connected n8n instance." };

export default async function DashboardPage() {
  const requestHeaders = await headers();
  const connection = await getConnectionFromCookieHeader(requestHeaders.get("cookie"));
  const initialConnection = {
    connected: Boolean(connection),
    mode: connection?.mode || null,
    baseUrl: connection?.baseUrl || null,
  };

  return <DashboardClient initialConnection={initialConnection} />;
}
