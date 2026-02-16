-- ==================== ÍNDICES OTIMIZADOS ====================
-- Criados para acelerar queries frequentes e complexas
-- Data: 2026-02-07

-- ==================== TABELA: vendas ====================
-- Acelera consultas por posto e data de venda (comum em dashboards e relatórios)
CREATE INDEX IF NOT EXISTS idx_vendas_posto_data ON vendas(postoId, dataVenda);

-- Acelera consultas por tanque e status de CMV (para recalcular CMV ou verificar pendências)
CREATE INDEX IF NOT EXISTS idx_vendas_tanque_status ON vendas(tanqueId, statusCmv);

-- Acelera consultas por posto e status de CMV (para recalcular CMV ou verificar pendências)
CREATE INDEX IF NOT EXISTS idx_vendas_posto_status_cmv ON vendas(postoId, statusCmv);

-- Acelera filtros por data de venda (usado em múltiplas queries)
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(dataVenda);

-- Acelera filtro por aferição (para excluir aferições de cálculos)
CREATE INDEX IF NOT EXISTS idx_vendas_afericao ON vendas(afericao);

-- ==================== TABELA: lotes ====================
-- Acelera consultas por tanque e ordem de consumo (essencial para o algoritmo PEPS)
CREATE INDEX IF NOT EXISTS idx_lotes_tanque_ordem ON lotes(tanqueId, ordemConsumo) WHERE status = 'ativo';

-- Acelera consultas por posto e data de entrada (para relatórios de entrada de mercadoria)
CREATE INDEX IF NOT EXISTS idx_lotes_posto_data_entrada ON lotes(postoId, dataEntrada);

-- Acelera filtros por status (ativo, consumido, cancelado)
CREATE INDEX IF NOT EXISTS idx_lotes_status ON lotes(status);

-- ==================== TABELA: medicoes ====================
-- Acelera consultas por tanque e data de medição (para gráficos de nível e histórico)
CREATE INDEX IF NOT EXISTS idx_medicoes_tanque_data ON medicoes(tanqueId, dataMedicao);

-- Acelera filtros por data de medição
CREATE INDEX IF NOT EXISTS idx_medicoes_data ON medicoes(dataMedicao);

-- ==================== TABELA: consumoLotes ====================
-- Acelera consultas para encontrar os lotes consumidos por uma venda específica
CREATE INDEX IF NOT EXISTS idx_consumo_venda ON consumoLotes(vendaId);

-- Acelera consultas para encontrar as vendas que consumiram um lote específico
CREATE INDEX IF NOT EXISTS idx_consumo_lote ON consumoLotes(loteId);

-- ==================== TABELA: historicoAlteracoes ====================
-- Acelera consultas de auditoria por tabela e registro
CREATE INDEX IF NOT EXISTS idx_historico_tabela_registro ON historicoAlteracoes(tabela, registroId);

-- Acelera filtros por data de alteração
CREATE INDEX IF NOT EXISTS idx_historico_data ON historicoAlteracoes(dataAlteracao);

-- ==================== TABELA: alertas ====================
-- Acelera consultas de alertas pendentes
CREATE INDEX IF NOT EXISTS idx_alertas_status ON alertas(status);

-- Acelera filtros por tipo de alerta
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas(tipo);

-- Acelera consultas de alertas por posto
CREATE INDEX IF NOT EXISTS idx_alertas_posto ON alertas(postoId);

-- ==================== TABELA: syncLogs ====================
-- Acelera consultas do histórico de sincronizações
CREATE INDEX IF NOT EXISTS idx_synclogs_data ON syncLogs(dataSincronizacao DESC);

-- ==================== TABELA: inicializacaoMensalLotes ====================
-- Acelera consultas de inicialização mensal por mês e posto
CREATE INDEX IF NOT EXISTS idx_inicializacao_mes_posto ON inicializacaoMensalLotes(mesReferencia, postoId);

-- ==================== TABELA: tanques ====================
-- Acelera consultas de tanques por posto
CREATE INDEX IF NOT EXISTS idx_tanques_posto ON tanques(postoId);

-- ==================== TABELA: postos ====================
-- Acelera filtros por status ativo/inativo
CREATE INDEX IF NOT EXISTS idx_postos_ativo ON postos(ativo);

-- ==================== TABELA: usuarios ====================
-- Acelera consultas de usuários por role
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);

-- Acelera consultas de usuários por posto
CREATE INDEX IF NOT EXISTS idx_usuarios_posto ON usuarios(postoId);

-- ==================== TABELA: produtos ====================
-- Acelera filtros por tipo de produto
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos(tipo);

-- ==================== ANÁLISE DE ÍNDICES ====================
-- Para verificar a efetividade dos índices, execute:
-- ANALYZE TABLE vendas;
-- ANALYZE TABLE lotes;
-- ANALYZE TABLE medicoes;
-- ANALYZE TABLE consumoLotes;
-- EXPLAIN SELECT * FROM vendas WHERE postoId = 1 AND dataVenda >= '2026-01-01';
