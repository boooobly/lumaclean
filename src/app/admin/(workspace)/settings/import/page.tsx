import { requireAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { getImportPreview } from "@/lib/services/legacy-import";
import { ImportWorkspace } from "@/components/admin/import-workspace";
import { CrmHeader } from "@/components/admin/crm-view";
import { entityId } from "@/lib/validation/crm";
import { CrmError } from "@/lib/domain/crm";
export const metadata = { title: "Импорт истории" };
export default async function Import({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const user = await requireAdmin(),
    { batch } = await searchParams;
  let initial,
    error = "";
  if (batch && entityId.safeParse(batch).success) {
    try {
      initial = await getImportPreview(getDatabase(), user.id, batch);
    } catch (e) {
      if (e instanceof CrmError) error = e.message;
      else throw e;
    }
  }
  return (
    <>
      <CrmHeader
        title="Импорт данных"
        subtitle="Parse → preview → apply · история LumaClean"
        back="/admin/settings"
      />
      {error && <p role="alert">{error}</p>}
      <ImportWorkspace initial={initial} />
    </>
  );
}
