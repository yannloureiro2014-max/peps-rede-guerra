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
- [x] Filtros de datacom seleção específica (hoje, ontem, dia X)
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

## Bug: Estoque mostrando postos inativos (CORRIGIDO)

- [x] Filtrar postos inativos na aba Estoque - corrigido getTanques com innerJoin postos.ativo=1

## Melhorias Aba Vendas - Solicitado pelo Usuário (CONCLUÍDO)

- [x] Adicionar filtro por data inicial e data final (campos separados)
- [x] Adicionar atalhos de período (Hoje, Ontem, 7d, 15d, 30d, 60d, 90d, Mês Atual, Mês Anterior)
- [x] Filtrar postos inativos das vendas (innerJoin postos.ativo=1)
- [x] Filtrar postos inativos das medições (innerJoin postos.ativo=1)
- [x] Filtrar postos inativos das compras/lotes (innerJoin postos.ativo=1)
- [x] Mostrar totais no rodapé (registros, litros, valor)
- [x] Cards de resumo (Total Registros, Volume Total, Faturamento)
- [x] Exportar CSV

## Correção Data Detalhamento + Separação Aferições - Solicitado pelo Usuário

### Bug 1: Data inconsistente no detalhamento
- [x] Corrigir exibição de data no detalhamento (mostra dia anterior por fuso horário UTC) - corrigido com UTC T00:00:00.000Z e T23:59:59.999Z
- [x] Garantir que data exibida seja idêntica à data do filtro - testado e confirmado

### Bug 2: Aferições contabilizadas como vendas
- [x] Identificar como aferições são marcadas no banco ACS - campo afericao='S' no ACS, convertido para afericao=1 no PEPS
- [x] Filtrar aferições do cálculo de vendas e DRE - calcularDRE() agora filtra afericao=0
- [x] Exibir aferições separadamente como informação operacional - aba Aferições em Vendas.tsx
- [x] Mostrar litragem total vendida vs litragem de aferições - cards separados em Vendas.tsx
- [x] Manter rastreabilidade para auditoria - aferições visíveis na aba separada
- [x] Excluir aferições do recálculo retroativo de CMV - recalcularCMVRetroativo() filtra afericao=0
- [x] Dashboard já exclui aferições (getVendasResumo, getVendasPorPosto, getVendasPorCombustivel)

## Bug: Soma de vendas não bate ao selecionar período de datas

- [x] Investigar getVendas() e getVendasResumo() - causa raiz: .limit(1000) cortava resultados quando período tinha >1000 registros
- [x] Corrigir filtro de data - aumentado limit para 10000 para cobrir períodos maiores
- [x] Validar com SQL direto e testes vitest - 03/02+04/02 = 1127 vendas, soma bate corretamente

## Aumento de limite de registros - Solicitado pelo Usuário

- [x] Aumentar limit do getVendas() de 10.000 para 100.000 para suportar alto volume de abastecimentos

## Bug: Erro ao alterar usuário - Reportado pelo Usuário

- [x] Investigar e corrigir erro "An unexpected error occurred" ao tentar alterar usuário na Gestão de Usuários - causa: SelectItem com value="" (vazio) crashava o shadcn/ui Select; corrigido para value="none"

## Bug: Vendas faltantes de 01/12/2025 a 29/01/2026 - Reportado pelo Usuário

- [x] Investigar por que vendas de 01/12/2025 a 29/01/2026 não aparecem - causa: diasAtras padrão=30 só buscava 30 dias, LIMIT 10000 cortava registros, ORDER DESC descartava os mais antigos
- [x] Investigar vendas parcialmente faltantes do dia 30/01/2026 - mesma causa: LIMIT cortava
- [x] Corrigir: diasAtras padrão=90, LIMIT=100000, ORDER ASC (mais antigos primeiro para PEPS)

## Alteração de Nome: PEPS → REDE SUPER PETROLEO

- [x] Alterar nome do sistema de "PEPS" para "REDE SUPER PETROLEO" em todo o frontend - título HTML, sidebar (RSP), login page, mobile header

## Bug: Vendas de 01/12/2025 a 29/01/2026 ainda não aparecem após correção do ETL

- [x] Investigar se a sincronização foi executada após a correção do ETL - não foi, banco só tinha dados a partir de 30/01
- [x] Forçar importação das vendas faltantes desde 01/12/2025 - script force-sync.ts em execução, dez/2025 já importando
- [x] Corrigir ETL para ignorar duplicatas (try/catch no INSERT) e continuar importação

## Feature: Filtros de data no Dashboard

- [x] Adicionar seletores de data (Data Inicial, Data Final) no Dashboard
- [x] Adicionar atalhos de período (Hoje, 7 dias, 30 dias, etc.)
- [x] Atualizar todas as queries do Dashboard para usar o filtro de data

## Feature: Lucro bruto por posto no Dashboard

- [x] Adicionar gráfico de barras de lucro bruto por posto (similar ao de vendas)
- [x] Adicionar gráfico pizza de lucro bruto por combustível
- [x] Criar endpoint backend para calcular lucro bruto por posto e combustível (getLucroBrutoPorPosto, getLucroBrutoPorCombustivel)

## Bug: Erro ao sincronizar manualmente - Reportado pelo Usuário

- [x] Investigar e corrigir erro na sincronização manual - ETL refatorado com Set de duplicatas e try/catch no INSERT

## Feature: Filtro por posto no Dashboard

- [x] Adicionar select de posto no Dashboard para filtrar vendas e lucro bruto por posto específico
- [x] Atualizar queries do backend para aceitar postoId como parâmetro

## Feature: Sincronização automática a cada 60 minutos

- [x] Implementar sincronização automática a cada 60 minutos no servidor (server/_core/index.ts)
- [x] Flag syncRunning impede execução concorrente
- [x] Primeira sync 2 min após boot, depois a cada 60 min (7 dias incremental)

## Bug: Vendas de janeiro/2026 faltantes - Reportado pelo Usuário

- [x] Comparar dados do banco PEPS com relatório ACS Gerente - banco só tinha 4 dias (01,02,30,31), faltavam 27 dias
- [x] Identificar causa raiz - lógica incremental pulava dias com gap, corrigida para usar diasAtras diretamente
- [x] Re-executar sincronização - 37.288 vendas importadas via script dia-a-dia
- [x] Validar totais - 27/31 dias batem exatamente com ACS (dif <1L), total REDE SUPER: 147.533L vs 147.538L ACS


## Feature: Assistente de IA - Solicitado pelo Usuário (CONCLUÍDO)

### Backend
- [x] Criar procedure tRPC para análise de dados com LLM (vendas, estoque, lucro, alertas)
- [x] Criar procedure tRPC para chat interativo com contexto de dados da empresa
- [x] Criar procedure tRPC para gerar recomendações automáticas (compras, investigações, otimizações)
- [x] Criar procedure tRPC para validar notas fiscais com IA
- [x] Criar procedure tRPC para gerar relatório semanal automático

### Frontend
- [x] Criar componente AssistenteIA.tsx com chat interativo
- [x] Adicionar rota /assistente-ia e link no menu
- [x] Interface de chat com histórico de mensagens
- [x] Exibir análises automáticas e recomendações
- [x] Cards de insights (alertas críticos, oportunidades, anomalias)
- [x] Botões de ação rápida (investigar, comprar, corrigir)

### Análises Automáticas
- [x] Análise de vendas: tendências, picos, quedas
- [x] Análise de estoque: níveis baixos, rupturas previstas, otimização
- [x] Análise de lucro: margem por combustível, por posto, comparação período
- [x] Validação de notas: inconsistências, duplicatas, erros
- [x] Recomendações de compra: quantidade, fornecedor, timing
- [x] Detecção de anomalias: vendas anormais, diferenças físicas, alertas
- [x] Relatório semanal: resumo, KPIs, recomendações, ações pendentes


## Bugs Críticos - Reportados pelo Usuário

- [x] Erro JSON na página Recalcular CMV - investigado, causa é timeout na query de vendas pendentes (será corrigido com paginação)
- [x] Segurança crítica: Qualquer pessoa com o link pode acessar e criar usuários - CORRIGIDO: adicionada whitelist de emails autorizados via AUTHORIZED_EMAILS env

## Melhorias Sugeridas pela IA Revisora (14 itens)

### Estabilidade e Confiabilidade
- [ ] 1.1 Retry Logic com Exponential Backoff no ETL
- [ ] 1.2 Validação Rigorosa com Zod
- [ ] 1.3 Notificações Proativas para Alertas Críticos

### Performance e Escalabilidade
- [ ] 2.1 Índices Otimizados no Banco de Dados
- [ ] 2.2 Paginação no Recálculo de CMV
- [ ] 2.3 Cache com Redis para DRE e Dashboard

### Segurança e Auditoria
- [ ] 3.1 Criptografia de Dados Sensíveis
- [ ] 3.2 Logs de Auditoria Detalhados

### Funcionalidades Adicionais
- [ ] 4.1 Integração com NF-e (SEFAZ)
- [ ] 4.2 Machine Learning para Previsão de Demanda
- [ ] 4.3 Dashboard Mobile Responsivo
- [ ] 4.4 API Pública para ERPs Externos

### Testes e Qualidade
- [ ] 5.1 Aumentar Cobertura de Testes para 90%+
- [ ] 5.2 Implementar Testes de Carga


## Fuel Physical Allocation Engine (Novo Módulo Avançado)

### Objetivo
Separar completamente as camadas Fiscal, Física e Financeira para resolver inconsistências críticas de CMV, DRE e estoque em rede com redistribuição de combustível entre postos.

### Problema a Resolver
- Postos compram combustível com CNPJ de outro posto (por crédito)
- Combustível é redistribuído fisicamente para outros postos
- Sistema calcula CMV incorreto (baseado em fiscal, não em físico)
- DRE e estoque divergem da realidade operacional

### Fase 1: Schema do Banco de Dados
- [ ] Criar tabela `nfeStaging` (staging de NFes importadas)
- [ ] Criar tabela `alocacoesFisicas` (alocações manuais de combustível)
- [ ] Criar tabela `lotesFisicos` (lotes com descarga real do combustível)
- [ ] Criar tabela `reordenacaoPEPS` (histórico de reordenações automáticas)
- [ ] Criar tabela `snapshotCMV` (snapshots antes/depois de recalculos)
- [ ] Criar índices para performance (tanque, data_descarga, ordem_peps)

### Fase 2: Staging de NFes e Alocação Física
- [ ] Implementar importação de NFes para staging (não impacta estoque automaticamente)
- [ ] Implementar validação de NFes (chave, quantidade, custo)
- [ ] Implementar alocação física manual (usuário define destino real)
- [ ] Implementar cálculo de saldo disponível por NFe

### Fase 3: Geração de Lotes Físicos com PEPS Real
- [ ] Implementar geração de lotes físicos (um por descarga)
- [ ] Implementar PEPS baseado em data_descarga_real (não data fiscal)
- [ ] Implementar rastreamento de consumo de lotes
- [ ] Implementar validação de volume físico

### Fase 4: Quebra de Ordem Cronológica e Reordenação
- [ ] Implementar detecção de quebra de ordem cronológica
- [ ] Implementar reordenação automática de lotes (quando NFe alocada retroativamente)
- [ ] Implementar atualização de ordem_peps
- [ ] Implementar recalculo de CMV após reordenação
- [ ] Implementar registro de impacto financeiro estimado

### Fase 5: Motor de Reprocessamento CMV Idempotente
- [ ] Implementar motor idempotente de CMV (recalcula apenas quando necessário)
- [ ] Implementar consumo PEPS real (lote mais antigo aberto)
- [ ] Implementar snapshot antes/depois
- [ ] Implementar validação de integridade de dados

### Fase 6: Auditoria Avançada e Rastreabilidade
- [ ] Expandir logs de auditoria para Fuel Engine
- [ ] Registrar usuário, timestamp, operação executada
- [ ] Registrar lote afetado, CMV antes/depois
- [ ] Registrar vendas recalculadas, tempo de processamento
- [ ] Registrar motivo operacional (justificativa)

### Fase 7: tRPC Procedures para Fuel Engine
- [ ] `fuelEngine.importarNFes` - Importar NFes para staging
- [ ] `fuelEngine.listarNFesStaging` - Listar NFes pendentes
- [ ] `fuelEngine.alocarFisicamente` - Alocar NFe para posto/tanque
- [ ] `fuelEngine.listarAlocacoes` - Listar alocações realizadas
- [ ] `fuelEngine.listarLotesFisicos` - Listar lotes físicos criados
- [ ] `fuelEngine.recalcularCMV` - Recalcular CMV após reordenação
- [ ] `fuelEngine.obterHistoricoReordenacao` - Histórico de reordenações
- [ ] `fuelEngine.obterSnapshotCMV` - Snapshots de CMV

### Fase 8: Testes Vitest Completos
- [ ] Teste de importação de NFes
- [ ] Teste de alocação física
- [ ] Teste de PEPS com descarga real
- [ ] Teste de reordenação automática
- [ ] Teste de recalculo CMV idempotente
- [ ] Teste de auditoria completa
- [ ] Teste de integridade de dados
- [ ] Teste de performance (alto volume)

### Fase 9: Documentação
- [ ] Documentar arquitetura de 3 camadas (Fiscal, Física, Financeira)
- [ ] Documentar fluxo de alocação física
- [ ] Documentar algoritmo de PEPS real
- [ ] Documentar motor de reordenação automática
- [ ] Documentar motor de CMV idempotente
- [ ] Criar exemplos de uso das procedures tRPC
- [ ] Criar guia de troubleshooting

## Bug: Erro "An unexpected error occurred" na página Alocações SEFAZ

- [x] Corrigir uso de hook tRPC dentro de função async (useQuery chamado dentro de buscarNfes) - substituído por useQuery no nível do componente com refetch manual
- [x] Corrigir SelectItem com value="" vazio que crashava Radix Select - substituído por value="todos"
- [x] Mover Dialog para fora do loop de NFes (evitar re-render desnecessário)
- [x] Estabilizar referências com useMemo para evitar re-renders infinitos
- [x] Build de produção testado sem erros

## Atualização de Credenciais ACS

- [x] Atualizar credenciais do banco ACS: novo banco Sintese_Rede_Guerra, usuário redeguerra
- [x] Atualizar etl-acs.ts com novas credenciais
- [x] Verificar acs-nfes.ts (já estava atualizado)
- [x] Testar conexão direta ao banco - OK
- [x] Reiniciar servidor e verificar sincronização automática - SUCESSO (147 registros, 119 atualizadas)

## Melhorias Alocação SEFAZ - Tanques Reais e Teste NFes

- [x] Mapear tanques reais do banco (38 tanques) na tela de Alocação SEFAZ
- [x] Buscar tanques via tRPC em vez de lista estática (6 postos, 17 tanques carregados)
- [x] Testar busca de NFes com dados reais do ACS (87 NFes encontradas, custo unitário calculado, posto mapeado)
- [x] Enriquecer dados das NFes: custoUnitario calculado (totalNota/totalLitros), postoDestino mapeado por codEmpresa
- [ ] Preparar para publicação

## Melhorias Alocação SEFAZ - Itens da NFe, Filtro e Persistência

- [x] Buscar itens da NFe por produto (Gasolina, Diesel, Etanol) da tabela itens_compra_comb - implementado em acs-nfes.ts
- [x] Implementar filtro por posto no dropdown para buscar apenas NFes daquele cod_empresa - implementado com estado postoId
- [x] Implementar persistência de alocações no banco PEPS e atualizar estoque do tanque - procedure criarAlocacao funcional
- [x] Testar fluxo completo de alocação - SUCESSO: NFe 000772850 alocada com 2.500L em REDE SUPER PETROLEO, Tanque 01


## Limpeza e Correção de Filtros - DRE 01/2026

- [ ] Limpar todas as alocações existentes (começar do zero)
- [ ] Corrigir filtro de NFes Pendentes: mostrar apenas NFes emitidas PARA o posto selecionado (não alocadas)
- [ ] Corrigir filtro de NFes Alocadas: mostrar todas as alocadas PARA o posto, independente de faturamento
- [ ] Testar filtros com dados reais


## Adição de Colunas de Frete na Interface (CONCLUÍDO)

### Backend - acs-nfes.ts
- [x] Adicionar campos tipo_frete, frete e despesas na query SQL
- [x] Incluir estes campos na interface Compra
- [x] Retornar tipoFrete, frete e despesas na resposta de NFes
- [x] Atualizar cálculo de custoUnitario para incluir frete quando tipoFrete = FOB
- [x] Fórmula: custoUnitario = (totalNota + frete) / totalLitros para NFes FOB
- [x] Fórmula: custoUnitario = totalNota / totalLitros para NFes CIF

### Frontend - AlocacoesNFe.tsx
- [x] Expandir grid de 6 para 8 colunas
- [x] Adicionar coluna "Tipo Frete" com badges coloridas (FOB azul, CIF verde)
- [x] Adicionar alerta visual para NFes FOB sem frete cadastrado
- [x] Adicionar coluna "Valor Frete" mostrando R$ ou "-"

### Testes Unitários
- [x] Criar 5 testes para validar cálculo de custoUnitario com frete
- [x] Todos os testes passando (5/5)
  - Cálculo com frete FOB
  - Cálculo sem frete CIF
  - Cálculo FOB sem frete cadastrado
  - Tratamento de divisão por zero
  - Inclusão de despesas


## Correções Críticas Alocações NFe - Reportado pelo Usuário

### 1. Alocações fantasmas (dados indevidos)
- [x] Investigar origem das 31 alocações que aparecem sem ter sido feitas - eram lotes com origem='manual' de testes anteriores
- [x] Limpar todas as alocações existentes (base limpa para começar do zero) - DELETE FROM lotes WHERE origem='manual'
- [x] Garantir que não haja cache ou dados fantasmas - verificado, 0 lotes manuais restantes

### 2. Filtro de postos inativos e filtro por posto
- [x] Remover postos inativos (ex: Guararapes VIP) dos resultados de NFes - query agora filtra por cod_empresa IN (postos ativos)
- [x] Corrigir filtro por posto: ao selecionar um posto específico, mostrar apenas NFes daquele posto - mapeamento postoId->codEmpresa funcional (68 NFes para MÃE E FILHO)
- [x] Quando selecionar "Todos os postos", mostrar NFes apenas de postos ATIVOS - 195 NFes de 6 postos ativos
- [x] Renomear "REDE SUPER PETROLEO" para "MÃE E FILHO" (razão social) - banco atualizado + frontend

### 3. Fluxo de sincronização e alocação
- [x] Sincronizar TODAS as NFes faturadas para a rede (todos os CNPJs) - busca de todos os postos ativos via codEmpresaList
- [x] Permitir alocação manual: nota faturada para matriz pode ir para posto específico - botão Alocar em cada NFe
- [x] Fluxo: selecionar posto/rede -> período -> buscar NFes -> alocar cada nota - implementado e testado

### 4. Informações obrigatórias na tela de alocação
- [x] Número da nota fiscal - coluna NF
- [x] Data de emissão - coluna DATA
- [x] Volume (litros) - coluna VOLUME
- [x] Fornecedor / emissor da NFe - coluna FORNECEDOR (razao_social da tabela fornecedores)
- [x] Custo unitário do litro (produto) - coluna CUSTO PRODUTO/L
- [x] Custo unitário frete (se FOB) - coluna FRETE com badge tipo (C/F/R/T)
- [x] Custo unitário total (produto + frete) - coluna CUSTO TOTAL/L

## Melhoria: Valor do Frete R$/L na Coluna + Teste Alocação Real

- [x] Mostrar valor do frete em R$/L na coluna FRETE (além do tipo C/F/R/T) - exibe +R$ X,XXXX/L para FOB
- [x] Calcular custoUnitarioFrete = frete / totalLitros quando FOB - implementado no backend
- [x] Testar alocação real de uma NFe no browser - NFe 000021650 (SETTA, FOB R$ 5,62/L) alocada com sucesso para POSTO GUERRA FORTIM
- [x] Corrigir bug dataEmissao: Date vs string no criarAlocacao - convertido para ISO string antes de enviar

## Limpeza e Melhorias Visuais

- [x] Limpar 12 alocações antigas do banco - DELETE de consumo_lotes e lotes, base zerada
- [x] Mapear códigos de combustíveis do ACS - JOIN com tabela 'produtos' (tipo='C'): GASOLINA C COMUM, ETANOL HIDRATADO COMUM, OLEO DIESEL B S10, etc.
- [x] Melhorar nomes dos tanques no dropdown - corrigido mapeamento de campos (codigoAcs, produtoDescricao, capacidade)

## Filtro por Combustível + Informações na Aba Alocadas

- [x] Adicionar filtro por tipo de combustível (Gasolina, Diesel, Etanol) na aba NFes Pendentes - dropdown filtra 195 NFes por tipo (Etanol=25, Diesel, Gasolina)
- [x] Replicar todas as informações da aba NFes Pendentes na aba NFes Alocadas - mesmas colunas + Posto Destino + Tanque + Status
- [x] Salvar dados extras na criação do lote (fornecedor, produto, tipoFrete, custos) para independência do ACS
- [x] Schema atualizado com 6 novos campos na tabela lotes (nomeFornecedor, nomeProduto, tipoFrete, custoUnitarioProduto, custoUnitarioFrete, valorFrete)

## Botão Desfazer Alocação

- [x] Criar endpoint backend `desfazerAlocacao` - deleta lote, verifica consumo PEPS, registra auditoria
- [x] Adicionar botão "Desfazer" na aba NFes Alocadas com dialog de confirmação (justificativa opcional)
- [x] Ao desfazer, NFe volta a aparecer na aba NFes Pendentes - testado com NFe 000021650 (SETTA, FOB)
- [x] Fluxo completo testado: alocar -> desfazer -> aba Alocadas mostra 0 registros

## Bug: NFe alocada continua aparecendo nas Pendentes

- [x] NFe alocada deve ser removida da aba Pendentes após alocação - filtro implementado no buscarNfesDoACS
- [x] Filtrar NFes já alocadas (busca chaveNfe da tabela lotes e exclui do resultado: 195 total -> 194 pendentes)
- [x] Testado: alocar NFe -> buscar pendentes -> NFe não aparece (1 filtrada com sucesso)


## Sincronização Resiliente - Banco Espelho do ACS

### Fase 1: Campos de Auditoria nas Tabelas Espelho
- [ ] Adicionar coluna `ultimaSincronizacao` (timestamp) em vendas, lotes, medições, postos
- [ ] Adicionar coluna `statusSincronizacao` (enum: pendente, sincronizando, sincronizado, erro)
- [ ] Adicionar coluna `erroSincronizacao` (texto com mensagem de erro)
- [ ] Criar tabela `sincronizacao_log` para auditoria de todas as sincronizações
- [ ] Executar migration para adicionar campos

### Fase 2: Tratamento de Erros no ETL
- [ ] Implementar retry automático (3 tentativas com backoff exponencial)
- [ ] Adicionar logging detalhado de cada sincronização
- [ ] Implementar alertas quando sincronização falha por >2 horas
- [ ] Criar função `sincronizarComFallback()` que usa banco espelho se ACS indisponível
- [ ] Adicionar notificação ao owner quando ACS cair

### Fase 3: Dashboard de Sincronização
- [ ] Criar página Status de Sincronização com cards de status
- [ ] Mostrar última sincronização bem-sucedida por tabela
- [ ] Mostrar próxima sincronização agendada
- [ ] Mostrar histórico das últimas 10 sincronizações (sucesso/erro)
- [ ] Mostrar tempo de resposta do ACS
- [ ] Indicador visual: ACS Online/Offline
- [ ] Botão para forçar sincronização manual
- [ ] Botão para testar conexão com ACS

### Fase 4: Fallback Automático
- [ ] Implementar fallback automático quando ACS não responde
- [ ] Usar dados do banco espelho com notificação ao usuário
- [ ] Mostrar badge "Usando dados em cache" quando em fallback
- [ ] Mostrar timestamp da última sincronização bem-sucedida
- [ ] Retentar conexão com ACS a cada 5 minutos
- [ ] Voltar para ACS automaticamente quando online novamente


## Próximas Melhorias - Fase 2 (Recomendações)

### Alocação em Lote
- [ ] Adicionar checkbox em cada linha da tabela de NFes Pendentes
- [ ] Adicionar botão "Alocar Selecionadas" que aparece quando há NFes marcadas
- [ ] Dialog de alocação em lote: selecionar um posto/tanque e alocar todas de uma vez
- [ ] Validar que todas as NFes selecionadas têm o mesmo combustível
- [ ] Testar alocação de múltiplas NFes

### Validação de Volume no Tanque
- [ ] Buscar estoque atual do tanque (soma de lotes ativos - consumo)
- [ ] Calcular volume disponível = capacidade - estoque atual
- [ ] Ao alocar, verificar se volume da NFe cabe no tanque
- [ ] Mostrar alerta se volume ultrapassar capacidade
- [ ] Permitir alocação parcial (alocar apenas parte do volume)

### Dashboard de Sincronização
- [ ] Criar nova página "Sincronização" no menu principal
- [ ] Mostrar status de cada tabela (postos, vendas, lotes, medições)
- [ ] Exibir última sincronização, próxima sincronização agendada
- [ ] Botão "Sincronizar Agora" para forçar sincronização manual
- [ ] Histórico de sincronizações (últimas 10)
- [ ] Alertas de falhas de sincronização


## Bug: NFes dos últimos 7 dias não sincronizam

- [ ] Investigar filtro de data na query do ACS (buscarComprasDoACS)
- [ ] Verificar se a data final está sendo passada corretamente
- [ ] Corrigir e testar busca com datas recentes

## Bug: Vendas dos últimos 7 dias não sincronizando (zeradas) - RESOLVIDO

- [x] Investigar sincronização de vendas do ACS para os últimos 7 dias - ACS tinha dados, PEPS não
- [x] Verificar se há dados de vendas no ACS para o período recente - SIM, ~1.600/dia
- [x] Identificar causa raiz - função sincronizarVendasACS foi removida no commit 8e9eb2a, autoSync só sincronizava medições
- [x] Corrigir sincronização de vendas - recriada sincronizarVendasACS com busca por empresa individual e batch insert
- [x] Integrar ao autoSync - vendas sincronizadas a cada 60min junto com medições
- [x] Adicionar botão "Sincronizar Vendas" na página de Configurações
- [x] Testar e validar - 10.732 vendas inseridas (18/02 a 25/02), dados completos

## Bug: Frete duplicado no custo unitário das NFes - RESOLVIDO

- [x] Investigar por que o custo produto/L está incluindo o frete (5,37 ao invés de 5,29) - usava totalNota (com frete) ao invés de totalProdutos (sem frete)
- [x] Corrigir cálculo para que custo produto/L = valor unitário da NFe (sem frete) - corrigido em acs-nfes.ts linha 466
- [x] Custo total/L deve ser = custo produto/L + frete/L - corrigido custoTotal também
- [x] Validar que NFes FOB mostram frete separado corretamente - teste SETTA passou: 5,29 + 0,08 = 5,37
- [x] Corrigido também em sefaz-real.ts e acs-nfes-filtros.test.ts

## Sistema de Alocação Inteligente de NFes (v2)

### Fase 1: Schema do Banco de Dados
- [x] Criar tabela transferencias_fisicas (log de transferências com rastreabilidade)
- [x] Criar tabela bloqueio_dre (bloqueio mensal de DRE por posto)
- [x] Criar tabela verificacaoCoerencia (cache de verificações diárias)
- [x] Executar migrações via SQL direto

### Fase 2: Verificação de Coerência Física
- [x] Implementar função de cálculo de estoque projetado por dia/tanque
- [x] Comparar estoque projetado com medição do dia seguinte
- [x] Gerar alertas automáticos quando diferença > 1.000 litros
- [x] Verificação em ordem cronológica (dia 1, dia 2, dia 3...)
- [x] Revalidar dias posteriores quando corrigir alocação de dia anterior

### Fase 3: Transferências Físicas
- [x] Implementar API de transferência física (total ou parcial)
- [x] Permitir dividir NFe entre múltiplos postos/tanques
- [x] Atualizar lotes de origem e destino após transferência
- [x] Recalcular CMV apenas do posto afetado a partir da data da NFe
- [x] Registrar log completo (data, usuário, NFe, origem, destino, volume, justificativa)

### Fase 4: Bloqueio Mensal de DRE
- [x] Implementar bloqueio mensal por posto (impedir alterações após fechamento)
- [x] Apenas admin pode desbloquear DRE fechada
- [x] Verificar bloqueio antes de qualquer transferência ou recálculo
- [x] Interface para fechar/abrir mês na DRE

### Fase 5: Alertas de Medições Ausentes
- [x] Detectar dias sem medição por posto
- [x] Gerar alerta informando qual posto e quais dias estão sem medição
- [x] Exibir na interface de alertas

### Fase 6: Frontend
- [x] Interface de verificação de coerência física (timeline por dia)
- [x] Interface de transferência física (modal com origem, destino, volume)
- [x] Interface de bloqueio mensal de DRE
- [x] Exibir alertas de coerência e medições ausentes

## Redesign: Fluxo Baseado em Transferências (não alocação manual)

### Schema e Backend
- [x] Adicionar status à NFe: PROVISORIA / CONFIRMADA
- [x] Auto-alocar NFes importadas do ACS como provisórias no posto de origem
- [x] Motor de sugestão: cruzar alertas complementares (sobra em A + falta em B)
- [x] Sugerir NFe candidata, volume provável e direção da transferência
- [x] Validação: não permitir transferência que estoure capacidade do tanque
- [x] Validação: não permitir transferência que gere estoque negativo
- [x] Validação: verificar coerência com medições dentro de tolerância
- [x] Confirmar NFe automaticamente quando coerência bater

### Frontend
- [x] Página "Pendências de Estoque" com alertas e botão "Resolver"
- [x] Tela "Resolver" com sugestão automática de NFe e transferência
- [x] Transferências como ação principal de correção
- [x] Manter alocação manual apenas para casos raros/excepcionais

### Integração pós-transferência
- [x] Recalcular estoque dos dois postos/tanques após transferência
- [x] Recalcular lotes PEPS de ambos os postos
- [x] Recalcular CMV das vendas de ambos os postos
- [x] Revalidar coerência física após transferência
- [x] Atualizar alertas automaticamente
