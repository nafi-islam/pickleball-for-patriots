import { requireAdmin } from "@/lib/auth";

export default async function AdminBracketsPage() {
  await requireAdmin();

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold">Brackets</h1>
      <p className="mt-2 text-gray-600">
        This page will handle bracket generation and bracket status.
      </p>
    </div>
  );
}
