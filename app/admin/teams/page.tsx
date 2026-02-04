import { requireAdmin } from "@/lib/auth";

export default async function AdminTeamsPage() {
  await requireAdmin();

  return (
    <div>
      <h1>Admin Teams</h1>
      <p>Only admins should see this.</p>
    </div>
  );
}
