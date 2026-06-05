import { useState } from "react";
import { Plus, Pencil, Trash2, Database } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { malentachiApi } from "@/integrations/malentachi/client";
import { Interesse } from "@/types/interesse";
import { Header } from "@/components/dashboard/Header";
import { Footer } from "@/components/dashboard/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface FormState {
  nome: string;
  numero: string;
  carro_interesse: string;
  nota_interna: string;
}

const empty: FormState = { nome: "", numero: "", carro_interesse: "", nota_interna: "" };

const Cadastro = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Interesse | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["interesses"],
    queryFn: () => malentachiApi.list(),
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim() || !form.numero.trim() || !form.carro_interesse.trim()) {
        throw new Error("Nome, número e carro são obrigatórios");
      }
      const payload = {
        nome: form.nome.trim(),
        numero: form.numero.trim(),
        carro_interesse: form.carro_interesse.trim(),
        nota_interna: form.nota_interna.trim() || null,
      };
      if (editing) {
        await malentachiApi.update(editing.id, payload);
      } else {
        await malentachiApi.insert(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interesses"] });
      toast({ title: editing ? "Atualizado" : "Cliente adicionado" });
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => malentachiApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interesses"] });
      toast({ title: "Removido" });
    },
  });

  const startNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const startEdit = (i: Interesse) => {
    setEditing(i);
    setForm({
      nome: i.nome,
      numero: i.numero,
      carro_interesse: i.carro_interesse,
      nota_interna: i.nota_interna ?? "",
    });
    setOpen(true);
  };

  const filtered = items.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      i.nome.toLowerCase().includes(q) ||
      i.numero.toLowerCase().includes(q) ||
      i.carro_interesse.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container mx-auto flex-1 space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Base de clientes</h1>
                <p className="text-sm text-muted-foreground">
                  {items.length} cliente(s) cadastrado(s)
                </p>
              </div>
            </div>
            <Button onClick={startNew} className="gap-2 bg-gradient-primary">
              <Plus className="h-4 w-4" /> Novo cliente
            </Button>
          </div>
          <div className="mt-4">
            <Input
              placeholder="Filtrar por nome, número ou carro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-card">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum cliente. Clique em "Novo cliente" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Carro de Interesse</TableHead>
                  <TableHead>Nota Interna</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.nome}</TableCell>
                    <TableCell>{i.numero}</TableCell>
                    <TableCell><Badge variant="outline">{i.carro_interesse}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{i.nota_interna || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover ${i.nome}?`)) remove.mutate(i.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </main>

      <Footer lastUpdate={new Date()} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Número</Label>
              <Input
                placeholder="Ex.: 11999999999"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
            <div>
              <Label>Carro de Interesse</Label>
              <Input
                placeholder="Ex.: Fox, Crossfox, Gol..."
                value={form.carro_interesse}
                onChange={(e) => setForm({ ...form, carro_interesse: e.target.value })}
              />
            </div>
            <div>
              <Label>Nota Interna</Label>
              <Textarea
                rows={3}
                value={form.nota_interna}
                onChange={(e) => setForm({ ...form, nota_interna: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending} className="bg-gradient-primary">
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cadastro;
