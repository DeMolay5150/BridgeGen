import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import type { Severity } from "../../lib/simulator/types";

/** The app's "Quiet Luxury" tokens (app/globals.css), as the same oklch values. */
export const C = {
  background: "oklch(12.9% 0.042 264.695)", // slate-950
  card: "oklch(20.8% 0.042 265.755)", // slate-900
  muted: "oklch(27.9% 0.041 260.031)",
  border: "oklch(27.9% 0.041 260.031 / 80%)", // slate-800/80
  foreground: "oklch(98.4% 0.003 247.858)",
  mutedForeground: "oklch(70.4% 0.04 256.788)", // slate-400
  positive: "oklch(76.5% 0.177 163.223)", // emerald-400
  caution: "oklch(82.8% 0.189 84.429)", // amber-400
  metric: "oklch(78.9% 0.154 211.53)", // cyan-400
  critical: "oklch(71.2% 0.194 13.428)", // rose-400
} as const;

export const TONE: Record<Severity, string> = { positive: C.positive, caution: C.caution, critical: C.critical };

/** Translucent wash of a signal colour, like `bg-critical/10`. */
export const wash = (color: string, alpha = 0.12) => color.replace(")", ` / ${alpha * 100}%)`);

export const SANS = loadGeist("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const MONO = loadGeistMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
