const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Envio via template aprovado no WTS Chat.
const ENDPOINT = "https://api.wts.chat/chat/v1/send/template";
const FROM = "551534174657";
const TEMPLATE_ID = "a96cb1b9-bd5b-4943-b212-0d39f29d5336";

// Normaliza número brasileiro: mantém só dígitos e garante o código do país (55).
function normalizePhone(value: string): string {
  const digits = String(value).replace(/\D/g, "");
  // 10 (fixo) ou 11 (celular) dígitos = DDD + número, sem país → prefixa 55.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("WTS_API_KEY");
    if (!apiKey) throw new Error("WTS_API_KEY not configured");

    const { to, carro } = await req.json();
    if (!to || !carro) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'carro'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      to: normalizePhone(to),
      from: FROM,
      templateId: TEMPLATE_ID,
      parameters: { carro: String(carro) },
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // WTS espera o token cru no header Authorization (sem "Bearer").
        "Authorization": apiKey,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    let data: unknown;
    try { data = JSON.parse(responseText); } catch { data = responseText; }

    if (!res.ok) {
      console.error("WTS error", res.status, data);
      return new Response(JSON.stringify({ success: false, status: res.status, data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-whatsapp error", e);
    return new Response(JSON.stringify({ success: false, error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
