export async function hashBytes(bytes: BufferSource): Promise<`0x${string}`> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `0x${hex}`;
}

export async function hashFile(file: File): Promise<`0x${string}`> {
  return hashBytes(await file.arrayBuffer());
}

export async function hashText(value: string): Promise<`0x${string}`> {
  return hashBytes(new TextEncoder().encode(value));
}
