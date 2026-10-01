"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="admin-error">
      <span className="admin-eyebrow">Рабочее пространство</span>
      <h1>Не удалось загрузить данные.</h1>
      <p>
        Повторите попытку. Если проблема сохраняется, проверьте подключение
        рабочего пространства.
      </p>
      <button className="admin-primary" onClick={reset}>
        Повторить <span aria-hidden="true">↗</span>
      </button>
    </main>
  );
}
