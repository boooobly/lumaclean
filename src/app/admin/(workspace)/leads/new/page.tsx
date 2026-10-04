import { CrmHeader } from "@/components/admin/crm-view";
import { CrmForm, Field } from "@/components/admin/crm-form";
import { Options } from "@/components/admin/crm-fields";
import { channelLabels, serviceLabels } from "@/lib/domain/crm-types";
export const metadata = { title: "Новая заявка" };
export default function NewLead() {
  return (
    <>
      <CrmHeader
        title="Добавить заявку"
        back="/admin/leads"
        subtitle="Для обращений по телефону, в мессенджерах и лично."
      />
      <CrmForm
        command="lead-create"
        button="Создать заявку"
        redirectTo="/admin/leads/[id]"
      >
        <div className="crm-fields-grid">
          <Field name="name" label="Имя" required />
          <Field name="phone" label="Телефон" type="tel" required />
          <Field name="service" label="Услуга" value="regular">
            <Options labels={serviceLabels} />
          </Field>
          <Field
            name="area"
            label="Площадь, м²"
            type="number"
            min={1}
            step={0.01}
          />
          <Field name="locale" label="Язык" value="ru">
            <Options
              labels={{ ru: "Русский", sr: "Сербский", en: "Английский" }}
            />
          </Field>
          <Field name="channel" label="Канал" value="MANUAL">
            <Options labels={channelLabels} />
          </Field>
          <Field name="comment" label="Комментарий клиента" type="textarea" />
          <Field
            name="internalNote"
            label="Внутренняя заметка"
            type="textarea"
          />
        </div>
      </CrmForm>
    </>
  );
}
