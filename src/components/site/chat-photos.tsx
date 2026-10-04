"use client";
import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import "./website-chat.css";
export type ChatPhoto = { id: string; width: number; height: number };
export function photoUrl(id: string, thumb = false) {
  return `/api/chat/attachments/${encodeURIComponent(id)}${thumb ? "?thumb=1" : ""}`;
}
export async function prepareChatPhoto(file: File) {
  if (file.size > 8 * 1024 * 1024) throw Error("IMAGE_SIZE");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer()),
    ascii = String.fromCharCode(...bytes);
  const allowed =
    (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
    (bytes[0] === 137 && ascii.slice(1, 4) === "PNG") ||
    (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP");
  if (!allowed)
    throw Error(
      /heic|heif/i.test(file.type) ||
        ascii.includes("heic") ||
        ascii.includes("heix")
        ? "HEIC_UNSUPPORTED"
        : "IMAGE_FORMAT",
    );
  const image = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    if (image.width * image.height > 40_000_000)
      throw Error("IMAGE_DIMENSIONS");
    const scale = Math.min(1, 2200 / Math.max(image.width, image.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw Error("IMAGE_DECODE");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.82, 0.65, 0.45]) {
      blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/jpeg", quality),
      );
      if (blob && blob.size <= 3 * 1024 * 1024) return blob;
    }
    throw Error("IMAGE_SIZE");
  } finally {
    image.close();
  }
}
export function ChatPhotos({
  photos,
  label = "Photo",
  locale = "ru",
}: {
  photos: ChatPhoto[];
  label?: string;
  locale?: string;
}) {
  const words = locale === "en" ? ["Close", "Previous photo", "Next photo"] : locale === "sr-Latn" ? ["Zatvori", "Prethodna fotografija", "Sledeća fotografija"] : locale === "sr-Cyrl" ? ["Затвори", "Претходна фотографија", "Следећа фотографија"] : ["Закрыть", "Предыдущее фото", "Следующее фото"];
  const [selected, setSelected] = useState<number | null>(null),
    close = useRef<HTMLButtonElement>(null),
    restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (selected === null) return;
    restore.current = document.activeElement as HTMLElement;
    close.current?.focus();
    return () => restore.current?.focus();
  }, [selected]);
  return (
    <>
      <div className="chat-photo-grid">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-label={`${label} ${i + 1}`}
            onClick={() => setSelected(i)}
          >
            <img
              loading="lazy"
              src={photoUrl(p.id, true)}
              width={p.width}
              height={p.height}
              alt={`${label} ${i + 1}`}
            />
          </button>
        ))}
      </div>
      {selected !== null && (
        <div
          className="chat-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={() => setSelected(null)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") setSelected(null);
            if (e.key === "ArrowRight")
              setSelected((selected + 1) % photos.length);
            if (e.key === "ArrowLeft")
              setSelected((selected + photos.length - 1) % photos.length);
            if (e.key === "Tab") {
              e.preventDefault();
              close.current?.focus();
            }
          }}
        >
          <button
            ref={close}
            type="button"
            className="chat-lightbox-close"
            aria-label={words[0]}
            onClick={() => setSelected(null)}
          >
            <X />
          </button>
          {photos.length > 1 && (
            <button
              type="button"
              aria-label={words[1]}
              onClick={(e) => {
                e.stopPropagation();
                setSelected((selected + photos.length - 1) % photos.length);
              }}
            >
              <ChevronLeft />
            </button>
          )}
          <img
            src={photoUrl(photos[selected].id)}
            alt={`${label} ${selected + 1}`}
            onClick={(e) => e.stopPropagation()}
          />
          {photos.length > 1 && (
            <button
              type="button"
              aria-label={words[2]}
              onClick={(e) => {
                e.stopPropagation();
                setSelected((selected + 1) % photos.length);
              }}
            >
              <ChevronRight />
            </button>
          )}
        </div>
      )}
    </>
  );
}
