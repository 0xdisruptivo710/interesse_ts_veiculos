import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock } from "lucide-react";

interface FooterProps {
  lastUpdate: Date;
}

export function Footer({ lastUpdate }: FooterProps) {
  return (
    <footer className="border-t border-border bg-card py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              Última atualização:{" "}
              {format(lastUpdate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>TS Veículos</span>
            <span className="text-primary">•</span>
            <span>Busca por Interesse</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
