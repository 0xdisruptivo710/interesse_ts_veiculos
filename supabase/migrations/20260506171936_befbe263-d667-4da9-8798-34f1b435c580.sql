CREATE TABLE public.envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mensagem TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  clientes JSONB NOT NULL DEFAULT '[]'::jsonb,
  busca TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read envios" ON public.envios FOR SELECT USING (true);
CREATE POLICY "Public insert envios" ON public.envios FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete envios" ON public.envios FOR DELETE USING (true);

CREATE INDEX idx_envios_created_at ON public.envios(created_at DESC);