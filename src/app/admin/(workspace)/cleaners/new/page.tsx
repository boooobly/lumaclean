import { requireAdmin } from "@/lib/auth/session";
import { CrmHeader } from "@/components/admin/crm-view";
import { CleanerForm } from "@/components/admin/scheduling-forms";
export const metadata = { title: "Новый клинер" };
export default async function NewCleaner() {
  await requireAdmin();
  return (
    <>
      <CrmHeader
        title="Новый клинер"
        back="/admin/cleaners"
        subtitle="Контакты и условия команды. Рабочий график можно заполнить после создания."
      />
      <CleanerForm />
    </>
  );
}
