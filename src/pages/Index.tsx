import { useState, useMemo } from "react";
import { Search, Download, MessageCircle, Users, Car } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { malentachiApi } from "@/integrations/malentachi/client";
import { Interesse } from "@/types/interesse";
import { Header } from "@/components/dashboard/Header";
import { Footer } from "@/components/dashboard/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean);
}

function scoreMatch(carroInteresse: string, query: string): number {
  if (!query.trim()) return 0;
  const interesse = normalize(carroInteresse);
  const interesseTokens = interesse.split(/\s+/).filter(Boolean);
  const queryNorm = normalize(query);
  const tokens = tokenize(query);

  let score = 0;

  // Exact full match
  if (interesse === queryNorm) score += 1000;

  // Full query as substring
  if (interesse.includes(queryNorm)) score += 200;

  for (const t of tokens) {
    if (!t) continue;
    // Exact token match (whole word) — Fox === Fox
    if (interesseTokens.includes(t)) score += 100;
    // Starts with token — "Fox Prime"
    else if (interesseTokens.some((it) => it.startsWith(t))) score += 60;
    // Substring — "Crossfox" contains "fox"
    else if (interesse.includes(t)) score += 30;
  }

  // Small boost when shorter strings match (more specific)
  if (score > 0) score += Math.max(0, 20 - interesse.length);

  return score;
}

const PAGE_SIZE = 25;
const MAX_BATCH = 50;
const INTERVAL_SECONDS = 30;
const SENDER_NUMBER = "551534174657";
const DEFAULT_MESSAGE =
  "Olá, você entrou em contato conosco recentemente atrás {carro}, chegou outro mais novo ainda, gostaria de ver?";
// Endpoint de disparo individual (será preenchido pelo backend do CRM AIOS).
// Cada cliente é enviado de forma espaçada para evitar bloqueios do WhatsApp.
const SEND_ENDPOINT = (import.meta.env.VITE_SEND_ENDPOINT as string | undefined) ?? "";

const Index = () => {
  const [query, setQuery] = useState("");
  const [carFilter, setCarFilter] = useState<string>("__all__");
  const [refine, setRefine] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msgOpen, setMsgOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sendMode, setSendMode] = useState<"selected" | "all">("selected");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { data: interesses = [], isLoading } = useQuery({
    queryKey: ["interesses"],
    queryFn: () => malentachiApi.list(),
  });

  const baseResults = useMemo(() => {
    if (!query.trim()) return [];
    return interesses
      .map((i) => ({ item: i, score: scoreMatch(i.carro_interesse, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }, [interesses, query]);

  const carOptions = useMemo(() => {
    const map = new Map<string, number>();
    baseResults.forEach((r) => map.set(r.carro_interesse, (map.get(r.carro_interesse) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [baseResults]);

  const results = useMemo(() => {
    let r = baseResults;
    if (carFilter !== "__all__") r = r.filter((x) => x.carro_interesse === carFilter);
    if (refine.trim()) {
      const n = normalize(refine);
      r = r.filter((x) =>
        normalize(x.nome).includes(n) ||
        normalize(x.carro_interesse).includes(n) ||
        normalize(x.numero).includes(n) ||
        normalize(x.nota_interna ?? "").includes(n)
      );
    }
    return r;
  }, [baseResults, carFilter, refine]);

  const visibleResults = useMemo(() => results.slice(0, visible), [results, visible]);

  const allSelected = results.length > 0 && results.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const exportCSV = () => {
    const rows = results.length > 0 ? results : [];
    if (rows.length === 0) {
      toast({ title: "Nada para exportar", description: "Faça uma busca primeiro." });
      return;
    }
    const header = ["Nome", "Numero", "Carro de Interesse", "Nota Interna"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [r.nome, r.numero, r.carro_interesse, r.nota_interna ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `busca-${query}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const targets = useMemo(
    () => (sendMode === "all" ? results : results.filter((r) => selected.has(r.id))),
    [results, selected, sendMode]
  );

  const overLimit = targets.length > MAX_BATCH;
  const estimatedMinutes = Math.ceil((targets.length * INTERVAL_SECONDS) / 60);

  const openMsgSelected = () => {
    if (selected.size === 0) {
      toast({ title: "Selecione clientes", description: "Marque ao menos um cliente para enviar mensagem.", variant: "destructive" });
      return;
    }
    setSendMode("selected");
    setMsgOpen(true);
  };

  const openMsgAll = () => {
    if (results.length === 0) {
      toast({ title: "Sem resultados", description: "Faça uma busca primeiro.", variant: "destructive" });
      return;
    }
    setSendMode("all");
    setMsgOpen(true);
  };

  const openConfirm = () => {
    if (!message.trim()) {
      toast({ title: "Mensagem vazia", variant: "destructive" });
      return;
    }
    if (overLimit) {
      toast({
        title: "Limite excedido",
        description: `Disparo em lote limitado a ${MAX_BATCH} clientes. Para volumes maiores, use Campanhas no CRM AIOS.`,
        variant: "destructive",
      });
      return;
    }
    setConfirmOpen(true);
  };

  const sendMessages = async () => {
    if (targets.length === 0 || !message.trim()) return;
    setSending(true);

    const sendOne = async (t: Interesse) => {
      const phone = t.numero.replace(/\D/g, "");
      try {
        const { data, error } = await supabase.functions.invoke("send-whatsapp", {
          // Envio por template aprovado no WTS: só o nome do carro é dinâmico.
          body: { to: phone, carro: t.carro_interesse },
        });
        const ok = !error && !(data && (data as { success?: boolean }).success === false);
        if (!ok) console.error("Falha no disparo para", phone, error ?? data);
        return ok;
      } catch (e) {
        console.error("Falha no disparo para", phone, e);
        return false;
      }
    };

    // 1º envio: aguardar para validar endpoint/credencial e dar feedback real
    const firstOk = await sendOne(targets[0]);
    if (!firstOk) {
      setSending(false);
      toast({
        title: "Falha ao disparar",
        description: "Não foi possível enviar a primeira mensagem. Verifique a API key e o endpoint.",
        variant: "destructive",
      });
      return;
    }

    // Demais: agendar espaçados de 30s
    let okCount = 1;
    let failCount = 0;
    targets.slice(1).forEach((t, idx) => {
      setTimeout(async () => {
        const ok = await sendOne(t);
        if (ok) okCount++; else failCount++;
        if (okCount + failCount === targets.length) {
          toast({
            title: "Disparo concluído",
            description: `${okCount} enviada(s), ${failCount} falha(s).`,
          });
        }
      }, (idx + 1) * INTERVAL_SECONDS * 1000);
    });

    const { error: logErr } = await supabase.from("envios").insert({
      mensagem: message,
      total: targets.length,
      busca: query,
      clientes: targets.map((t) => ({
        id: t.id,
        nome: t.nome,
        numero: t.numero,
        carro_interesse: t.carro_interesse,
      })),
    });
    if (logErr) console.error("Falha ao registrar envio:", logErr);

    setSending(false);
    setConfirmOpen(false);
    setMsgOpen(false);
    toast({
      title: "Disparo iniciado",
      description:
        targets.length === 1
          ? "1 mensagem enviada com sucesso."
          : `1ª enviada. Restantes ${targets.length - 1} serão disparadas a cada ${INTERVAL_SECONDS}s (~${estimatedMinutes} min).`,
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container mx-auto flex-1 space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Buscar interessados por veículo</h1>
              <p className="text-sm text-muted-foreground">
                Digite o modelo (ex.: Fox) para encontrar clientes com interesse correspondente.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar carro... (ex.: Fox)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(new Set());
                  setCarFilter("__all__");
                  setRefine("");
                  setVisible(PAGE_SIZE);
                }}
                className="pl-9 h-11"
              />
            </div>
            <Button onClick={exportCSV} variant="outline" className="gap-2 h-11">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <Button onClick={openMsgSelected} variant="outline" className="gap-2 h-11">
              <MessageCircle className="h-4 w-4" />
              Selecionados ({selected.size})
            </Button>
            <Button onClick={openMsgAll} className="gap-2 h-11 bg-gradient-primary">
              <MessageCircle className="h-4 w-4" />
              Enviar para todos ({results.length})
            </Button>
          </div>

          {query.trim() && carOptions.length > 0 && (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Select
                value={carFilter}
                onValueChange={(v) => {
                  setCarFilter(v);
                  setSelected(new Set());
                  setVisible(PAGE_SIZE);
                }}
              >
                <SelectTrigger className="h-10 sm:w-72">
                  <SelectValue placeholder="Filtrar por carro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os carros ({baseResults.length})</SelectItem>
                  {carOptions.map(([car, count]) => (
                    <SelectItem key={car} value={car}>{car} ({count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Refinar (nome, número, nota...)"
                value={refine}
                onChange={(e) => {
                  setRefine(e.target.value);
                  setSelected(new Set());
                  setVisible(PAGE_SIZE);
                }}
                className="h-10 flex-1"
              />
              {(carFilter !== "__all__" || refine) && (
                <Button
                  variant="ghost"
                  className="h-10"
                  onClick={() => { setCarFilter("__all__"); setRefine(""); }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Resultados</h2>
              <Badge variant="secondary">{results.length}</Badge>
            </div>
            {!query.trim() && (
              <span className="text-xs text-muted-foreground">Comece digitando um modelo acima</span>
            )}
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando base...</div>
          ) : !query.trim() ? (
            <div className="p-12 text-center text-muted-foreground">
              Faça uma busca para ver os clientes correspondentes.
            </div>
          ) : results.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum cliente encontrado para "{query}".
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Carro de Interesse</TableHead>
                  <TableHead>Nota Interna</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleResults.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => toggleOne(r.id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.numero}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.carro_interesse}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.nota_interna || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {query.trim() && visible < results.length && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3 text-sm">
              <span className="text-muted-foreground">
                Mostrando {visibleResults.length} de {results.length}
              </span>
              <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Carregar mais
              </Button>
            </div>
          )}
        </section>
      </main>

      <Footer lastUpdate={new Date()} />

      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensagem ({targets.length} cliente(s){sendMode === "all" ? " — todos os resultados" : ""})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use <code className="rounded bg-muted px-1">{"{nome}"}</code> e{" "}
              <code className="rounded bg-muted px-1">{"{carro}"}</code> para personalizar.
            </p>
            <Textarea
              rows={6}
              placeholder="Olá {nome}, temos um {carro} novo no estoque..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p>• Disparo espaçado de <strong>{INTERVAL_SECONDS}s</strong> entre cada cliente.</p>
              <p>• Limite de <strong>{MAX_BATCH} clientes</strong> por lote neste módulo.</p>
              <p>• Para volumes maiores, utilize <strong>Campanhas</strong> no CRM AIOS.</p>
              {overLimit && (
                <p className="text-destructive font-medium">
                  Você selecionou {targets.length}. Reduza para no máximo {MAX_BATCH}.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(false)}>Cancelar</Button>
            <Button onClick={openConfirm} disabled={overLimit} className="bg-gradient-primary gap-2">
              <MessageCircle className="h-4 w-4" /> Revisar e disparar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar disparo em lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold text-foreground">{targets.length}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Duração estimada</p>
                <p className="text-2xl font-bold text-foreground">~{estimatedMinutes} min</p>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Busca</p>
              <Badge variant="outline">{query || "—"}</Badge>
            </div>
            <div className="rounded-lg border border-border p-3 max-h-40 overflow-auto">
              <p className="text-xs text-muted-foreground mb-2">Prévia da mensagem</p>
              <p className="whitespace-pre-wrap text-foreground">
                {targets[0]
                  ? message
                      .replace(/\{nome\}/gi, targets[0].nome)
                      .replace(/\{carro\}/gi, targets[0].carro_interesse)
                  : message}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Os envios serão feitos um a cada <strong>{INTERVAL_SECONDS} segundos</strong>. Mantenha esta aba aberta durante o processo.
              Para disparos acima de {MAX_BATCH} contatos, utilize <strong>Campanhas</strong> no CRM AIOS.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Voltar
            </Button>
            <Button onClick={sendMessages} disabled={sending} className="bg-gradient-primary gap-2">
              <MessageCircle className="h-4 w-4" />
              {sending ? "Iniciando..." : `Confirmar disparo (${targets.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
