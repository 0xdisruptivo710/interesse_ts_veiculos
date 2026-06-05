const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENDPOINT = "https://api.wts.chat/chat/v1/message/send";
const FROM = "5515991280217";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("WTS_API_KEY");
    if (!apiKey) throw new Error("WTS_API_KEY not configured");

    const { to, text } = await req.json();
    if (!to || !text) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'text'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      body: { text },
      to: String(to).replace(/\D/g, ""),
      from: FROM,
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
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
