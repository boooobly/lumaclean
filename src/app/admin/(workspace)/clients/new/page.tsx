import { getLead } from "@/lib/services/crm-queries";
import { CrmHeader } from "@/components/admin/crm-view";
import { CrmForm } from "@/components/admin/crm-form";
import { ClientFields } from "@/components/admin/crm-fields";
export const metadata = { title: "Новый клиент" };
export default async function NewClient({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams,
    lead = leadId ? await getLead(leadId) : null;
  return (
    <>
      <CrmHeader
        title="Новый клиент"
        back="/admin/clients"
        subtitle={
          lead
            ? `Из заявки ${lead.reference}`
            : "Заполните контакты. Остальные поля можно дополнить позже."
        }
      />
      <CrmForm
        command="client-create"
        leadId={lead?.id}
        button="Создать клиента"
        redirectTo="/admin/clients/[id]"
      >
        <ClientFields
          value={lead ? { name: lead.name, phone: lead.phone } : undefined}
        />
      </CrmForm>
    </>
  );
}
