import { redirect } from "next/navigation";
import AuthForm from "../auth/AuthForm";
import { getUser } from "../../lib/session";

export const metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUser()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
