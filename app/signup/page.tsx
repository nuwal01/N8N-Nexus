import { redirect } from "next/navigation";
import AuthForm from "../auth/AuthForm";
import { getUser } from "../../lib/session";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getUser()) redirect("/dashboard");
  return <AuthForm mode="signup" />;
}
