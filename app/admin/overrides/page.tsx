import { requireAdmin } from "@/lib/auth";

export default async function AdminOverridesPage() {
  await requireAdmin();

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">Overrides</h1>
      <p className="mt-2 text-gray-600">
        This page will handle controlled overrides and recovery actions.
      </p>
    </div>
  );
}
