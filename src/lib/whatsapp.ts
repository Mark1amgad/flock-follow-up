export function formatEgyptianPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "20" + cleaned.slice(1);
  }
  if (!cleaned.startsWith("20")) {
    cleaned = "20" + cleaned;
  }
  return cleaned;
}

export function getWhatsAppUrl(phone: string): string {
  return `https://wa.me/${formatEgyptianPhone(phone)}`;
}
