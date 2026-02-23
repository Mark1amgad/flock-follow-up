export function validatePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return "Phone number is required.";

  // International format
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 10) return "International number must have at least 10 digits after +.";
    return null;
  }

  // Egyptian format
  const digits = trimmed.replace(/\D/g, "");
  if (digits !== trimmed) return "Only digits allowed (or start with + for international).";
  if (!digits.startsWith("01")) return "Egyptian number must start with 01.";
  if (digits.length !== 11) return "Egyptian mobile number must be exactly 11 digits.";
  return null;
}

export function capitalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
