"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_MS = 2600;

/** One toast at a time, bottom-centre, gone after 2.6 s. */
export function useToast() {
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string) => {
    clearTimeout(timer.current);
    setToast(text);
    timer.current = setTimeout(() => setToast(""), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = toast ? (
    <div role="status" className="toast">
      {toast}
    </div>
  ) : null;
  return { show, node };
}
