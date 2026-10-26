"use client";

import { useEffect, useState } from "react";

/**
 * A polite screen-reader status that speaks `text` only once it stops
 * changing, so dragging a slider doesn't read every intermediate state over
 * the slider's own value. Always mounted, so the change is announced.
 */
export function SettledStatus({ text, delay = 750 }: { text: string; delay?: number }) {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay);
    return () => clearTimeout(timer);
  }, [text, delay]);
  return (
    <p role="status" className="sr-only">
      {settled}
    </p>
  );
}
