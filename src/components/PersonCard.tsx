import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, User, Phone, Calendar } from "lucide-react";
import { getWhatsAppUrl } from "@/lib/whatsapp";

interface PersonCardProps {
  name: string;
  phone: string;
  gender: string;
  lastAttendanceDate: string | null;
}

export default function PersonCard({ name, phone, gender, lastAttendanceDate }: PersonCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg text-foreground">{name}</h3>
          <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">
            {gender}
          </span>
        </div>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            <span>{phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>{lastAttendanceDate ? `Last seen: ${lastAttendanceDate}` : "No attendance recorded"}</span>
          </div>
        </div>
        <Button
          className="w-full bg-[hsl(var(--whatsapp))] hover:bg-[hsl(var(--whatsapp))]/90 text-[hsl(var(--whatsapp-foreground))]"
          onClick={() => window.open(getWhatsAppUrl(phone), "_blank")}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </Button>
      </CardContent>
    </Card>
  );
}
