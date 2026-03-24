import { requireAdmin } from "@/lib/auth";

export default async function AdminScoringPage() {
  await requireAdmin();

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">Scoring</h1>
      <p className="mt-2 text-gray-600">
        This page will handle score entry and match advancement.
      </p>
    </div>
  );
}
