
CREATE TABLE public.interesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  numero TEXT NOT NULL,
  carro_interesse TEXT NOT NULL,
  nota_interna TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.interesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.interesses FOR SELECT USING (true);
CREATE POLICY "Public insert" ON public.interesses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON public.interesses FOR UPDATE USING (true);
CREATE POLICY "Public delete" ON public.interesses FOR DELETE USING (true);

CREATE INDEX idx_interesses_carro ON public.interesses (carro_interesse);
