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
