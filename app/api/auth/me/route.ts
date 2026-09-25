import { getUser } from "../../../../lib/session";

export async function GET(request: Request) {
  const user = await getUser(request);
  return user ? Response.json({ user }) : Response.json({ error: "Not authenticated." }, { status: 401 });
}
