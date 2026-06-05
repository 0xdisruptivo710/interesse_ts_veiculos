import { useState } from "react";
import { History, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/dashboard/Header";
import { Footer } from "@/components/dashboard/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface ClienteEnvio {
  id: string;
  nome: string;
  numero: string;
  carro_interesse: string;
}

interface Envio {
  id: string;
  mensagem: string;
  total: number;
  clientes: ClienteEnvio[];
  busca: string | null;
  created_at: string;
}

const Historico = () => {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: envios = [], isLoading } = useQuery({
    queryKey: ["envios"],
    queryFn: async (): Promise<Envio[]> => {
      const { data, error } = await supabase
        .from("envios")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        ...e,
        clientes: Array.isArray(e.clientes) ? e.clientes : [],
      }));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("envios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["envios"] });
      toast({ title: "Registro removido" });
    },
  });

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container mx-auto flex-1 space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Histórico de envios</h1>
              <p className="text-sm text-muted-foreground">
                {envios.length} disparo(s) registrado(s)
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {isLoading ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-card">
              Carregando...
            </div>
          ) : envios.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground shadow-card">
              Nenhum envio registrado ainda.
            </div>
          ) : (
            envios.map((e) => {
              const isOpen = expanded.has(e.id);
              return (
                <div key={e.id} className="rounded-2xl border border-border bg-card shadow-card">
                  <div className="flex items-start justify-between gap-3 p-4">
                    <button
                      onClick={() => toggle(e.id)}
                      className="flex flex-1 items-start gap-3 text-left"
                    >
                      <div className="mt-1">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{formatDate(e.created_at)}</span>
                          <Badge variant="secondary">{e.total} cliente(s)</Badge>
                          {e.busca && <Badge variant="outline">busca: {e.busca}</Badge>}
                        </div>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{e.mensagem}</p>
                      </div>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover este registro?")) remove.mutate(e.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="space-y-3 border-t border-border p-4">
                      <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Mensagem</h3>
                        <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{e.mensagem}</p>
                      </div>
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                          Clientes ({e.clientes.length})
                        </h3>
                        <div className="space-y-1">
                          {e.clientes.map((c, i) => (
                            <div
                              key={i}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                            >
                              <span className="font-medium">{c.nome}</span>
                              <span className="text-muted-foreground">{c.numero}</span>
                              <Badge variant="outline">{c.carro_interesse}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </main>
      <Footer lastUpdate={new Date()} />
    </div>
  );
};

export default Historico;
