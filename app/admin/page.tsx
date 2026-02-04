import { requireAdmin } from "@/lib/auth";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div>
      <h1>Admin</h1>
      <p>Only admins should see this.</p>
    </div>
  );
}
