"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="bg-warning fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-black"
      role="status"
    >
      <WifiOff aria-hidden="true" className="size-4" />
      You are offline. Changes may not be saved.
    </div>
  );
}
