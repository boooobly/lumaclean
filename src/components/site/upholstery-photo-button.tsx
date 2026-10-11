"use client";
import { upholsteryUi } from "@/lib/upholstery-content";
import type { Locale } from "@/i18n/routing";
export function UpholsteryPhotoButton({ locale }: { locale: Locale }) {
  return (
    <button
      type="button"
      className="upholstery-cta"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("lumaclean:open-chat", {
            detail: { text: upholsteryUi[locale].name },
          }),
        )
      }
    >
      {upholsteryUi[locale].photo}
    </button>
  );
}
