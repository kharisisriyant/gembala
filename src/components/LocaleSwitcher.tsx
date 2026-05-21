"use client";

import { useRouter } from "next/navigation";

export default function LocaleSwitcher({ current }: { current: string }) {
  const router = useRouter();

  function handleChange(locale: string) {
    document.cookie = `locale=${locale};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <div className="flex gap-1">
      {["en", "id"].map((l) => (
        <button
          key={l}
          onClick={() => handleChange(l)}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${
            current === l ? "bg-indigo-100 text-indigo-700" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
