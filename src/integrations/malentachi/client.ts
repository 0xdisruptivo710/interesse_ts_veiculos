// Cliente Supabase do banco externo TS Veículos (somente dados de interesses).
// As credenciais abaixo são públicas (anon key) e podem ficar no código.
import { createClient } from "@supabase/supabase-js";
import type { Interesse } from "@/types/interesse";

const URL = "https://ehlpmukjdknnyhkycncb.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobHBtdWtqZGtubnloa3ljbmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5NzQwOTgsImV4cCI6MjA2MjU1MDA5OH0.y3NYzn7hQbuYZ2ZsUm4YGe-dh4GjlFKpTpKyIgrby-E";

export const malentachi = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const TABLE = "Interesse_Ts_Veiculos";

// Mapeamento das colunas externas -> formato interno usado pelo app.
type Row = {
  id?: string | number;
  Nome: string;
  Numero: string;
  Interesse: string;
  ["Anotação"]: string | null;
  created_at?: string;
};

const toInteresse = (r: Row): Interesse => ({
  id: String(r.id ?? `${r.Nome}-${r.Numero}`),
  nome: r.Nome ?? "",
  numero: r.Numero ?? "",
  carro_interesse: r.Interesse ?? "",
  nota_interna: (r["Anotação"] as string | null) ?? null,
  created_at: r.created_at ?? "",
  updated_at: r.created_at ?? "",
});

export const malentachiApi = {
  async list(): Promise<Interesse[]> {
    const { data, error } = await malentachi
      .from(TABLE)
      .select("*")
      .order("id", { ascending: false });
    if (error) throw error;
    return (data as Row[]).map(toInteresse);
  },
  async insert(input: { nome: string; numero: string; carro_interesse: string; nota_interna: string | null }) {
    const { error } = await malentachi.from(TABLE).insert({
      Nome: input.nome,
      Numero: input.numero,
      Interesse: input.carro_interesse,
      ["Anotação"]: input.nota_interna,
    });
    if (error) throw error;
  },
  async update(id: string, input: { nome: string; numero: string; carro_interesse: string; nota_interna: string | null }) {
    const idVal: string | number = /^\d+$/.test(id) ? Number(id) : id;
    const { error } = await malentachi
      .from(TABLE)
      .update({
        Nome: input.nome,
        Numero: input.numero,
        Interesse: input.carro_interesse,
        ["Anotação"]: input.nota_interna,
      })
      .eq("id", idVal);
    if (error) throw error;
  },
  async remove(id: string) {
    const idVal: string | number = /^\d+$/.test(id) ? Number(id) : id;
    const { error } = await malentachi.from(TABLE).delete().eq("id", idVal);
    if (error) throw error;
  },
};
