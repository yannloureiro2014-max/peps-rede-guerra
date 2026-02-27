/**
 * Auditoria de NFes - Cruza lotes (sistema) com nfeStaging (ACS)
 * 
 * Colunas reais:
 * - lotes: id, tanqueId, numeroNf, fornecedor, dataEntrada, quantidadeOriginal, 
 *          quantidadeDisponivel, custoUnitario, status, statusNfe, postoId, produtoId,
 *          nomeFornecedor, nomeProduto, tipoFrete, custoUnitarioProduto, custoUnitarioFrete,
 *          valorFrete, dataEmissao, dataLmc, custoTotal, origem, chaveNfe, serieNf
 * - nfeStaging: id, chaveNfe, numeroNf, serieNf, dataEmissao, cnpjFaturado, cnpjFornecedor,
 *              postoFiscalId, produtoId, quantidade, custoUnitario, custoTotal,
 *              statusAlocacao, quantidadeAlocada
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL não encontrada'); process.exit(1); }

const output = [];
function log(msg) { console.log(msg); output.push(msg); }

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║   AUDITORIA COMPLETA DE NFes - REDE GUERRA DE POSTOS       ║');
  log('║   Período: 01/12/2025 a 27/02/2026                         ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log(`Data da auditoria: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`);
  
  // ==========================================
  // 1. POSTOS ATIVOS
  // ==========================================
  const [postos] = await conn.execute('SELECT id, nome, cnpj FROM postos WHERE ativo = 1 ORDER BY id');
  log(`\n━━━ POSTOS ATIVOS: ${postos.length} ━━━`);
  for (const p of postos) {
    log(`  ID=${p.id} | ${p.nome} | CNPJ=${p.cnpj}`);
  }
  const postoIds = postos.map(p => p.id);
  
  // ==========================================
  // 2. TOTAIS GERAIS
  // ==========================================
  const [totalACS] = await conn.execute(`
    SELECT COUNT(*) as t, ROUND(COALESCE(SUM(quantidade), 0), 3) as v, ROUND(COALESCE(SUM(custoTotal), 0), 2) as c
    FROM nfeStaging 
    WHERE dataEmissao >= '2025-12-01' AND dataEmissao <= '2026-02-27'
  `);
  
  const [totalLotes] = await conn.execute(`
    SELECT COUNT(*) as t, ROUND(COALESCE(SUM(quantidadeOriginal), 0), 3) as v, ROUND(COALESCE(SUM(custoTotal), 0), 2) as c
    FROM lotes 
    WHERE dataEntrada >= '2025-12-01' AND dataEntrada <= '2026-02-27'
      AND status != 'cancelado'
  `);
  
  log(`\n━━━ TOTAIS GERAIS ━━━`);
  log(`  NFes no ACS (nfeStaging): ${totalACS[0].t} registros | ${totalACS[0].v} L | R$ ${totalACS[0].c}`);
  log(`  Lotes no sistema:         ${totalLotes[0].t} registros | ${totalLotes[0].v} L | R$ ${totalLotes[0].c}`);
  
  // ==========================================
  // 3. NFes POR POSTO - ACS
  // ==========================================
  const [nfesPorPostoACS] = await conn.execute(`
    SELECT ns.postoFiscalId, p.nome as postoNome, 
           COUNT(*) as totalNfes, 
           ROUND(SUM(ns.quantidade), 3) as volumeTotal,
           ROUND(SUM(ns.custoTotal), 2) as valorTotal,
           COUNT(DISTINCT ns.cnpjFornecedor) as fornecedores
    FROM nfeStaging ns
    LEFT JOIN postos p ON ns.postoFiscalId = p.id
    WHERE ns.dataEmissao >= '2025-12-01' AND ns.dataEmissao <= '2026-02-27'
    GROUP BY ns.postoFiscalId, p.nome
    ORDER BY ns.postoFiscalId
  `);
  log(`\n━━━ NFes NO ACS POR POSTO ━━━`);
  for (const n of nfesPorPostoACS) {
    log(`  Posto ${n.postoFiscalId} (${n.postoNome || 'N/A'}): ${n.totalNfes} NFes | ${n.volumeTotal} L | R$ ${n.valorTotal} | ${n.fornecedores} fornecedores`);
  }
  
  // ==========================================
  // 4. LOTES POR POSTO - SISTEMA
  // ==========================================
  const [lotesPorPosto] = await conn.execute(`
    SELECT l.postoId, p.nome as postoNome, 
           COUNT(*) as totalLotes, 
           ROUND(SUM(l.quantidadeOriginal), 3) as volumeTotal,
           ROUND(SUM(l.custoTotal), 2) as valorTotal,
           SUM(CASE WHEN l.statusNfe = 'provisoria' THEN 1 ELSE 0 END) as provisorias,
           SUM(CASE WHEN l.statusNfe = 'confirmada' THEN 1 ELSE 0 END) as confirmadas,
           SUM(CASE WHEN l.origem = 'acs' THEN 1 ELSE 0 END) as origemAcs,
           SUM(CASE WHEN l.origem = 'manual' THEN 1 ELSE 0 END) as origemManual,
           SUM(CASE WHEN l.origem = 'transferencia' THEN 1 ELSE 0 END) as origemTransf
    FROM lotes l
    LEFT JOIN postos p ON l.postoId = p.id
    WHERE l.dataEntrada >= '2025-12-01' AND l.dataEntrada <= '2026-02-27'
      AND l.status != 'cancelado'
    GROUP BY l.postoId, p.nome
    ORDER BY l.postoId
  `);
  log(`\n━━━ LOTES NO SISTEMA POR POSTO ━━━`);
  for (const l of lotesPorPosto) {
    log(`  Posto ${l.postoId} (${l.postoNome || 'N/A'}): ${l.totalLotes} lotes | ${l.volumeTotal} L | R$ ${l.valorTotal}`);
    log(`    Status: ${l.provisorias} provisórias, ${l.confirmadas} confirmadas`);
    log(`    Origem: ${l.origemAcs} ACS, ${l.origemManual} manual, ${l.origemTransf} transferência`);
  }
  
  // ==========================================
  // 5. CRUZAMENTO: NFes FALTANTES (no ACS mas não no sistema)
  // ==========================================
  log('\n\n╔══════════════════════════════════════════════════════════════╗');
  log('║  🔴 NFes FALTANTES (existem no ACS mas NÃO no sistema)     ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  
  // Cruzar por chaveNfe (mais preciso) ou por numeroNf
  const [faltantes] = await conn.execute(`
    SELECT ns.id, ns.chaveNfe, ns.numeroNf, ns.serieNf, ns.postoFiscalId, 
           p.nome as postoNome, ns.cnpjFornecedor,
           ROUND(ns.quantidade, 3) as quantidade, 
           ROUND(ns.custoUnitario, 4) as custoUnit,
           ROUND(ns.custoTotal, 2) as custoTotal, 
           ns.dataEmissao, ns.statusAlocacao,
           pr.descricao as produtoNome
    FROM nfeStaging ns
    LEFT JOIN postos p ON ns.postoFiscalId = p.id
    LEFT JOIN produtos pr ON ns.produtoId = pr.id
    LEFT JOIN lotes l ON (
      (ns.chaveNfe IS NOT NULL AND ns.chaveNfe != '' AND ns.chaveNfe = l.chaveNfe)
      OR (ns.numeroNf = l.numeroNf AND ns.serieNf = l.serieNf)
    ) AND l.status != 'cancelado'
    WHERE ns.dataEmissao >= '2025-12-01' AND ns.dataEmissao <= '2026-02-27'
      AND l.id IS NULL
    ORDER BY ns.postoFiscalId, ns.dataEmissao
  `);
  
  log(`\nTotal: ${faltantes.length} NFes faltantes`);
  
  let volumeFaltanteTotal = 0;
  let valorFaltanteTotal = 0;
  const faltantesPorPosto = {};
  for (const f of faltantes) {
    const key = `${f.postoFiscalId}-${f.postoNome || 'Sem posto'}`;
    if (!faltantesPorPosto[key]) faltantesPorPosto[key] = [];
    faltantesPorPosto[key].push(f);
    volumeFaltanteTotal += parseFloat(f.quantidade) || 0;
    valorFaltanteTotal += parseFloat(f.custoTotal) || 0;
  }
  
  for (const [posto, nfes] of Object.entries(faltantesPorPosto)) {
    const volPosto = nfes.reduce((s, n) => s + (parseFloat(n.quantidade) || 0), 0);
    log(`\n  ┌── ${posto} (${nfes.length} faltantes | ${volPosto.toFixed(3)} L) ──`);
    for (const f of nfes) {
      log(`  │ NFe ${f.numeroNf}/${f.serieNf} | ${f.dataEmissao} | ${f.produtoNome || 'N/A'} | ${f.quantidade} L | R$ ${f.custoTotal} | CNPJ Forn: ${f.cnpjFornecedor || 'N/A'} | Status: ${f.statusAlocacao}`);
    }
    log(`  └──`);
  }
  log(`\n  TOTAL FALTANTE: ${volumeFaltanteTotal.toFixed(3)} L | R$ ${valorFaltanteTotal.toFixed(2)}`);
  
  // ==========================================
  // 6. CRUZAMENTO: NFes FICTÍCIAS (no sistema mas não no ACS)
  // ==========================================
  log('\n\n╔══════════════════════════════════════════════════════════════╗');
  log('║  🟡 NFes FICTÍCIAS (existem no sistema mas NÃO no ACS)     ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  
  const [ficticias] = await conn.execute(`
    SELECT l.id, l.numeroNf, l.serieNf, l.chaveNfe, l.postoId, p.nome as postoNome, 
           l.nomeFornecedor, ROUND(l.quantidadeOriginal, 3) as qtdOriginal, 
           ROUND(l.custoUnitario, 4) as custoUnit,
           ROUND(l.custoTotal, 2) as custoTotal, l.dataEntrada, l.dataEmissao,
           l.statusNfe, l.status, l.origem, l.nomeProduto
    FROM lotes l
    LEFT JOIN postos p ON l.postoId = p.id
    LEFT JOIN nfeStaging ns ON (
      (l.chaveNfe IS NOT NULL AND l.chaveNfe != '' AND l.chaveNfe = ns.chaveNfe)
      OR (l.numeroNf = ns.numeroNf AND l.serieNf = ns.serieNf)
    )
    WHERE l.dataEntrada >= '2025-12-01' AND l.dataEntrada <= '2026-02-27'
      AND l.status != 'cancelado'
      AND ns.id IS NULL
      AND l.numeroNf IS NOT NULL
      AND l.numeroNf != ''
    ORDER BY l.postoId, l.dataEntrada
  `);
  
  log(`\nTotal: ${ficticias.length} NFes fictícias (no sistema sem correspondência no ACS)`);
  
  let volumeFicticioTotal = 0;
  let valorFicticioTotal = 0;
  const fictPorPosto = {};
  for (const f of ficticias) {
    const key = `${f.postoId}-${f.postoNome || 'Sem posto'}`;
    if (!fictPorPosto[key]) fictPorPosto[key] = [];
    fictPorPosto[key].push(f);
    volumeFicticioTotal += parseFloat(f.qtdOriginal) || 0;
    valorFicticioTotal += parseFloat(f.custoTotal) || 0;
  }
  
  for (const [posto, nfes] of Object.entries(fictPorPosto)) {
    const volPosto = nfes.reduce((s, n) => s + (parseFloat(n.qtdOriginal) || 0), 0);
    log(`\n  ┌── ${posto} (${nfes.length} fictícias | ${volPosto.toFixed(3)} L) ──`);
    for (const f of nfes) {
      log(`  │ Lote ${f.id} | NFe ${f.numeroNf}/${f.serieNf} | ${f.dataEntrada} | ${f.nomeProduto || 'N/A'} | ${f.qtdOriginal} L | R$ ${f.custoTotal} | ${f.nomeFornecedor || 'N/A'} | Status: ${f.statusNfe} | Origem: ${f.origem}`);
      if (f.chaveNfe) log(`  │   Chave: ${f.chaveNfe}`);
    }
    log(`  └──`);
  }
  log(`\n  TOTAL FICTÍCIO: ${volumeFicticioTotal.toFixed(3)} L | R$ ${valorFicticioTotal.toFixed(2)}`);
  
  // ==========================================
  // 7. DIVERGÊNCIAS (posto ou volume diferente)
  // ==========================================
  log('\n\n╔══════════════════════════════════════════════════════════════╗');
  log('║  🟠 DIVERGÊNCIAS (posto ou volume diferente ACS vs Sistema) ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  
  const [divergencias] = await conn.execute(`
    SELECT ns.numeroNf, ns.serieNf, ns.dataEmissao,
           ns.postoFiscalId as acsPostoId, pa.nome as acsPostoNome,
           ROUND(ns.quantidade, 3) as acsVolume, 
           ROUND(ns.custoTotal, 2) as acsValor,
           ns.cnpjFornecedor,
           l.id as loteId, l.postoId as sistemaPostoId, ps.nome as sistemaPostoNome,
           ROUND(l.quantidadeOriginal, 3) as sistemaVolume, 
           ROUND(l.custoTotal, 2) as sistemaValor,
           l.nomeProduto, l.nomeFornecedor, l.statusNfe, l.origem,
           ROUND(ABS(ns.quantidade - l.quantidadeOriginal), 3) as diferencaVolume,
           ROUND(ABS(ns.custoTotal - l.custoTotal), 2) as diferencaValor
    FROM nfeStaging ns
    JOIN lotes l ON (
      (ns.chaveNfe IS NOT NULL AND ns.chaveNfe != '' AND ns.chaveNfe = l.chaveNfe)
      OR (ns.numeroNf = l.numeroNf AND ns.serieNf = l.serieNf)
    ) AND l.status != 'cancelado'
    LEFT JOIN postos pa ON ns.postoFiscalId = pa.id
    LEFT JOIN postos ps ON l.postoId = ps.id
    WHERE ns.dataEmissao >= '2025-12-01' AND ns.dataEmissao <= '2026-02-27'
      AND (ABS(ns.quantidade - l.quantidadeOriginal) > 50 OR ns.postoFiscalId != l.postoId)
    ORDER BY CASE WHEN ns.postoFiscalId != l.postoId THEN 0 ELSE 1 END, 
             ABS(ns.quantidade - l.quantidadeOriginal) DESC
  `);
  
  let postosDiferentes = 0;
  let volumesDiferentes = 0;
  
  log(`\nTotal: ${divergencias.length} divergências`);
  
  for (const d of divergencias) {
    const postoDiff = d.acsPostoId !== d.sistemaPostoId;
    if (postoDiff) postosDiferentes++;
    else volumesDiferentes++;
    
    const flag = postoDiff ? '⚠️  POSTO DIFERENTE' : '📏 Volume diferente';
    log(`\n  ${flag} | NFe ${d.numeroNf}/${d.serieNf} | ${d.dataEmissao} | ${d.nomeProduto || 'N/A'}`);
    log(`    ACS:     Posto ${d.acsPostoId} (${d.acsPostoNome || 'N/A'}) | ${d.acsVolume} L | R$ ${d.acsValor}`);
    log(`    Sistema: Posto ${d.sistemaPostoId} (${d.sistemaPostoNome || 'N/A'}) Lote ${d.loteId} | ${d.sistemaVolume} L | R$ ${d.sistemaValor} | ${d.nomeFornecedor || 'N/A'}`);
    if (postoDiff) {
      log(`    ➜ NFe faturada para ${d.acsPostoNome} mas alocada em ${d.sistemaPostoNome}`);
    }
    log(`    Δ Volume: ${d.diferencaVolume} L | Δ Valor: R$ ${d.diferencaValor}`);
  }
  
  log(`\n  Divergências de posto: ${postosDiferentes}`);
  log(`  Divergências de volume: ${volumesDiferentes}`);
  
  // ==========================================
  // 8. NFes DUPLICADAS no sistema
  // ==========================================
  log('\n\n╔══════════════════════════════════════════════════════════════╗');
  log('║  🔵 NFes DUPLICADAS no sistema (mesmo número em >1 lote)    ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  
  const [duplicadas] = await conn.execute(`
    SELECT l.numeroNf, l.serieNf, COUNT(*) as qtdLotes,
           GROUP_CONCAT(l.id ORDER BY l.id) as loteIds,
           GROUP_CONCAT(l.postoId ORDER BY l.id) as postoIds,
           GROUP_CONCAT(ROUND(l.quantidadeOriginal, 3) ORDER BY l.id) as volumes,
           GROUP_CONCAT(l.status ORDER BY l.id) as statuses,
           GROUP_CONCAT(l.origem ORDER BY l.id) as origens
    FROM lotes l
    WHERE l.dataEntrada >= '2025-12-01' AND l.dataEntrada <= '2026-02-27'
      AND l.status != 'cancelado'
      AND l.numeroNf IS NOT NULL AND l.numeroNf != ''
    GROUP BY l.numeroNf, l.serieNf
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);
  
  log(`\nTotal: ${duplicadas.length} NFes com múltiplos lotes`);
  for (const d of duplicadas) {
    log(`  NFe ${d.numeroNf}/${d.serieNf}: ${d.qtdLotes} lotes`);
    log(`    Lotes: [${d.loteIds}] | Postos: [${d.postoIds}] | Volumes: [${d.volumes}] | Origens: [${d.origens}]`);
  }
  
  // ==========================================
  // 9. RESUMO GERAL
  // ==========================================
  const [totalMatch] = await conn.execute(`
    SELECT COUNT(*) as t FROM nfeStaging ns 
    JOIN lotes l ON (
      (ns.chaveNfe IS NOT NULL AND ns.chaveNfe != '' AND ns.chaveNfe = l.chaveNfe)
      OR (ns.numeroNf = l.numeroNf AND ns.serieNf = l.serieNf)
    ) AND l.status != 'cancelado'
    WHERE ns.dataEmissao >= '2025-12-01' AND ns.dataEmissao <= '2026-02-27'
  `);
  
  log('\n\n╔══════════════════════════════════════════════════════════════╗');
  log('║  📊 RESUMO GERAL DA AUDITORIA                              ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log(`  NFes no ACS (nfeStaging):      ${totalACS[0].t} (${totalACS[0].v} L | R$ ${totalACS[0].c})`);
  log(`  Lotes no sistema:              ${totalLotes[0].t} (${totalLotes[0].v} L | R$ ${totalLotes[0].c})`);
  log(`  Matches (encontrados em ambos): ${totalMatch[0].t}`);
  log(`  ──────────────────────────────────────`);
  log(`  🔴 NFes FALTANTES:             ${faltantes.length} (${volumeFaltanteTotal.toFixed(3)} L | R$ ${valorFaltanteTotal.toFixed(2)})`);
  log(`  🟡 NFes FICTÍCIAS:             ${ficticias.length} (${volumeFicticioTotal.toFixed(3)} L | R$ ${valorFicticioTotal.toFixed(2)})`);
  log(`  🟠 Divergências de POSTO:      ${postosDiferentes}`);
  log(`  🟠 Divergências de VOLUME:     ${volumesDiferentes}`);
  log(`  🔵 NFes DUPLICADAS:            ${duplicadas.length}`);
  
  await conn.end();
  
  // Salvar relatório
  const reportPath = '/home/ubuntu/auditoria-nfe-report.txt';
  fs.writeFileSync(reportPath, output.join('\n'), 'utf8');
  log(`\n✅ Relatório salvo em ${reportPath}`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
