import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    // throw new Error("Unauthorized");
    redirect("/sign-in");
  }

  const user = await (await clerkClient()).users.getUser(userId);
  return user;
}
