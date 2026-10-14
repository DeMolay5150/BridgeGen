/** "Hartwell Family Holdings" + "red-team" → "hartwell-family-holdings-red-team-2026-10-14.pdf" */
export function exportFileName(company: string, kind: string, extension: string, date: Date): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bridgegen";
  return `${slug}-${kind}-${date.toISOString().slice(0, 10)}.${extension}`;
}

/** Saves a generated file through the browser's normal download flow. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Give the browser time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
