# PEPS - Rede Guerra de Postos - TODO

## Funcionalidades Principais

- [x] Dashboard com métricas de vendas, estoque e faturamento em tempo real
- [x] Sistema de gestão de estoque por tanque com cálculo PEPS (FIFO) automático
- [x] Módulo de lançamento de compras (lotes) com registro de NF, fornecedor e custos
- [x] Registro de medições físicas dos tanques com cálculo automático de diferenças
- [x] Análise de vendas com filtros por posto, combustível e período
- [x] Relatórios exportáveis (vendas por posto, por combustível, medições, lotes ativos)
- [x] Integração automatizada com banco de dados ACS via ETL para sincronização de vendas
- [x] Sistema de alertas para estoque baixo e diferenças nas medições
- [x] Painel de configurações para gerenciar parâmetros do sistema
- [x] Autenticação de usuários com controle de acesso por perfil

## Infraestrutura

- [x] Schema do banco de dados (postos, tanques, produtos, lotes, vendas, medições, alertas)
- [x] API tRPC com procedures para todas as operações
- [x] Layout do dashboard com sidebar de navegação
- [x] Integração com banco ACS externo

## Dados Iniciais

- [x] Cadastro dos 6 postos da Rede Guerra
- [x] Cadastro dos tanques por posto
- [x] Cadastro dos produtos (combustíveis)

## Bugs

- [x] Corrigir erro React "removeChild" na renderização dos gráficos

## Melhorias

- [x] Sincronizar postos automaticamente do banco ACS
- [x] Sincronizar tanques automaticamente do banco ACS
- [x] Sincronizar vendas automaticamente do banco ACS
- [x] Sincronizar produtos automaticamente do banco ACS

## Novas Funcionalidades - Medições e NFs

- [x] Sincronizar medições físicas (LMC) automaticamente do ACS
- [x] Gerar alertas de medições faltantes por posto/data
- [x] Sincronizar notas fiscais de compra do ACS
- [x] CRUD completo para notas fiscais (incluir, editar, excluir)
- [x] CRUD completo para medições físicas (incluir, editar, excluir)
- [x] Manter histórico de alterações em NFs e medições

## Correções Solicitadas

- [x] Sincronizar histórico de compras/NFes do banco ACS
- [x] Filtro de data com seleção específica (hoje, ontem, dia X)
- [x] Formato de data brasileiro dd/mm/aaaa em todas as telas
- [ ] Campo para ordenar lotes por ordem de consumo PEPS

## Bugs Críticos

- [x] Corrigir erro removeChild definitivamente - substituir Recharts por CSS puro

## Bugs Reportados - Correção Urgente

- [x] Erro removeChild corrigido - substituiu DashboardLayout por versão sem Sidebar problemático
- [x] Formato de data dd/mm/aaaa em todas as telas
- [x] Valores de vendas sincronizados corretamente do ACS
- [x] Preço unitário corrigido para usar custo_comenc (custo de compra)

## Dashboard de Estoque - Correções Prioritárias

- [x] Corrigir estoque para usar medição física como base (não valores acima da capacidade)
- [x] Sincronizar medições da tabela "aberturas" do ACS (1.961 medições importadas)
- [x] Estoque deve diminuir automaticamente conforme vendas do dia
- [x] Medições editáveis manualmente após sincronização

## Módulo DRE (Demonstrativo de Resultados) - PRIORITÁRIO

- [x] Criar página DRE com filtros por dia/período/posto
- [x] Cálculo PEPS com memória de cálculo detalhada (quais lotes consumidos)
- [x] Exibir receita bruta, CMV, lucro bruto e margem
- [x] Mostrar ordem de consumo dos lotes

## Melhorias Sistema PEPS - Fase 2

### Schema do Banco de Dados
- [x] Adicionar campo postoId na tabela users (FK para postos)
- [x] Criar tabela inicializacaoMensalLotes
- [x] Alterar enum role para ["user", "admin_geral", "visualizacao"]
- [x] Gerar e executar migrations

### Backend - Funções db.ts
- [x] Funções de gestão de usuários (CRUD)
- [x] Funções de inicialização mensal de lotes
- [x] Função calcularCMVPEPS (cálculo no backend com persistência)
- [x] Função getMemoriaCalculoCMV
- [x] Função calcularDRE (DRE com PEPS do backend)

### Backend - Routers tRPC
- [x] Router usuarios (list, getById, create, update, delete)
- [x] Router inicializacaoMensal (inicializar, listar, verificarExistente)
- [x] Router dre (calcular, calcularCMVVenda, memoriaCalculo)

### ETL - Cálculo Automático
- [x] Modificar sincronizarVendasACS para calcular CMV após inserir venda

### Frontend - Novos Componentes
- [x] Criar GestaoUsuarios.tsx (CRUD de usuários)
- [x] Criar InicializacaoMensal.tsx (definir saldos iniciais de lotes)

### Frontend - Modificações
- [x] Modificar DRE.tsx para usar cálculo do backend
- [x] Adicionar rotas /usuarios e /inicializacao-mensal
- [x] Adicionar links no menu com controle de permissões (admin_geral only)

### Validações e Regras
- [x] Cronologia PEPS (ordem de consumo) - implementado via ordemConsumo
- [x] Saldo nunca negativo - implementado no calcularCMVPEPS
- [x] Alerta quando lotes insuficientes

### Testes Realizados
- [x] Dashboard carregando corretamente
- [x] Gestão de Usuários funcionando
- [x] Inicialização Mensal funcionando
- [x] DRE usando cálculo do backend
- [ ] CMV das vendas existentes precisa ser recalculado
- [ ] Inicialização mensal única
- [ ] Permissões por role
- [ ] Auditoria de ações críticas

## Correção Erro React "removeChild" - URGENTE

- [x] Corrigir DRE.tsx - keys duplicadas em .map() e renderização condicional (Fragment + keys únicas)
- [x] Corrigir demais componentes com .map() usando index como key (Relatorios.tsx, Home.tsx, InicializacaoMensal.tsx)
- [x] Adicionar cleanup em useEffect com async (Map.tsx - isMounted pattern)
- [x] Testar navegação entre páginas e filtros - SEM ERROS NO CONSOLE

## Recálculo Retroativo de CMV - CRÍTICO

- [x] Criar função recalcularCMVRetroativo em server/db.ts
- [x] Modificar createLote para recalcular CMV após inserção de lote
- [x] Modificar router inicializacaoMensal para recalcular CMV
- [x] Adicionar router cmv com procedures de recálculo manual
- [x] Criar componente RecalcularCMV.tsx no frontend
- [x] Adicionar rota /recalcular-cmv e link no menu (admin_geral only)
- [x] Testar cenários de recálculo retroativo - Página funcionando, 11.832 vendas pendentes identificadas

## Correção Sistema Inicialização Mensal - CRÍTICO

### Backend - server/db.ts
- [x] Adicionar função getInicializacaoById
- [x] Adicionar função updateInicializacaoMensal (com recálculo CMV)
- [x] Adicionar função deleteInicializacaoMensal
- [x] Corrigir dataInicializacao para primeiro dia do mês de referência

### Backend - server/routers.ts
- [x] Adicionar endpoint getById
- [x] Adicionar endpoint update (com recálculo CMV)
- [x] Adicionar endpoint delete

### Frontend - InicializacaoMensal.tsx
- [x] Filtrar lotes: apenas dataEntrada <= mês de referência
- [x] Mostrar quantidadeDisponivel ao invés de quantidadeOriginal
- [x] Adicionar coluna "Saldo Atual Banco" (somente leitura)
- [x] Adicionar coluna "Saldo Inicial Mês" (editável)
- [x] Adicionar botão "Zerar Lote" em cada linha
- [x] Mostrar TOTAL no rodapé da tabela
- [x] Adicionar campo "Medição Física do Dia 01" para referência
- [x] Comparar total vs medição física, mostrar diferença
- [x] Adicionar botões Editar/Excluir no histórico
- [x] Modal de visualização de detalhes

### Validações
- [x] Ordem PEPS sem duplicatas
- [x] Saldo inicial <= quantidade original
- [x] Saldo inicial >= 0
- [x] Data de inicialização = primeiro dia do mês
- [x] Aviso de recálculo CMV ao editar
- [x] Confirmação ao excluir

## Melhorias Aba Compras - Solicitado pelo Usuário (CONCLUÍDO)

- [x] Adicionar filtro por data inicial e data final
- [x] Adicionar opção de excluir compras (notas desnecessárias para DRE) - incluindo ACS
- [x] Adicionar opção de editar compras
- [x] Confirmação antes de excluir (dialog com justificativa)
- [x] Seleção múltipla com exclusão em lote
- [x] Atalhos de período (7d, 15d, 30d, 60d, 90d, Mês Atual, Mês Anterior)
- [x] Totais no rodapé dos filtros (registros, litros, valor)
- [x] Backend já existia: função deleteLote e updateLote

## Postos Ativo/Inativo + Data de Corte ACS - Solicitado pelo Usuário (CONCLUÍDO)

### Schema e Banco
- [x] Campo `ativo` já existia na tabela postos
- [x] Sem necessidade de migration

### Backend
- [x] Filtrar postos inativos no dashboard (métricas, vendas, tanques)
- [x] Filtrar postos inativos nos alertas pendentes
- [x] Adicionar endpoint toggleAtivo e listAll no router postos
- [x] Filtrar postos inativos na sincronização ACS

### ETL - Data de Corte
- [x] Definir DATA_CORTE = "2025-12-01" na sincronização ACS
- [x] Sincronizar apenas vendas >= 01/12/2025
- [x] Sincronizar apenas medições >= 01/12/2025
- [x] Sincronizar apenas lotes/NFs >= 01/12/2025

### Frontend - Aba Postos
- [x] Adicionar toggle ativo/inativo na listagem de postos (admin_geral only)
- [x] Mostrar badge de status (Ativo/Inativo) verde/vermelho
- [x] Postos inativos com visual diferenciado (opacity-50)
- [x] Toggle "Mostrar inativos" no header
- [x] Card informativo sobre postos ativos/inativos e data de corte

### Limpeza de Dados Antigos
- [x] Excluir vendas anteriores a 01/12/2025
- [x] Excluir medições anteriores a 01/12/2025
- [x] Excluir lotes anteriores a 01/12/2025
- [x] 7 postos desativados: Aracati, Guararapes VIP, São João do Jaguaribe, Horizonte, Leite, Potiretama, SG Petroleo

### Verificação
- [x] Dashboard mostra 6 postos ativos e 17 tanques
- [x] Alertas filtram postos inativos
- [x] Sem erros no console
