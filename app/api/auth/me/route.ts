import { getUser } from "../../../../lib/session";
import { apiError } from "../../../../lib/n8n";

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    return user ? Response.json({ user }) : Response.json({ error: "Not authenticated.", code: "AUTH_REQUIRED" }, { status: 401 });
  } catch (error) {
    return apiError(error);
  }
}
