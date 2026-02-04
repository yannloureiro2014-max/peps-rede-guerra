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
