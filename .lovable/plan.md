

## Cópia Idêntica do Projeto Rastreamento Macaé

Vou replicar todo o código do projeto [Rastreamento Macaé](/projects/415c0088-e206-471d-a4d2-cd50a83f93eb) neste projeto. A cópia incluirá:

### Estrutura da Aplicação
- **Dashboard principal** (`/`) — KPIs (Total de Leads, Agendamentos, Taxa de Conversão, Período), filtros por data/campanha/conjunto, gráfico temporal de evolução, distribuição por campanha, ranking de campanhas e métricas por conjunto
- **Página de Leads** (`/leads`) — Listagem completa com busca, filtros, exportação CSV e tabela detalhada

### Componentes a Copiar
- `Header` — Navegação com logo AIOS e botão atualizar
- `MetricCard` — Cards de KPI com variantes de cor
- `Filters` — Filtros de data, campanha e conjunto
- `TemporalChart` — Gráfico de evolução temporal (Recharts)
- `CampaignDistribution` — Gráfico de barras por campanha
- `CampaignRanking` — Tabela ranking de campanhas
- `ConjuntoMetrics` — Cards de métricas por conjunto com progress bar
- `Footer` — Rodapé com última atualização

### Dados e Integração
- Tipos TypeScript para `RastreamentoRecord`, métricas e filtros
- Hook `useDashboardData` com paginação completa da tabela Supabase
- Cliente Supabase externo apontando para o banco atual (que será alterado depois)

### Assets e Estilos
- Logo AIOS (`aios-logo.png`)
- Design system completo com cores corporativas azuis, shadows, gradientes e animações
- Tailwind config com cores extras (`success`, `warning`, `chart`)

### Dependência Adicional
- `recharts` para os gráficos

