/**
 * Auditoria de NFes v2 - Cruza dados do ACS (PostgreSQL externo) com lotes (MySQL local)
 * 
 * O ACS armazena as compras na tabela compras_comb (PostgreSQL externo)
 * O sistema PEPS armazena os lotes na tabela lotes (MySQL local)
 * A tabela nfeStaging está vazia - NFes são buscadas em tempo real do ACS
 * 
 * Este script:
 * 1. Busca TODAS as compras do ACS no período (sem filtro de alocação)
 * 2. Busca TODOS os lotes do sistema no período
 * 3. Cruza por chaveNfe (formato: ACS-{codEmpresa}-{codigo})
 * 4. Identifica: faltantes, fictícias, divergências de posto/volume, duplicadas
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL não encontrada'); process.exit(1); }

const ACS_CONFIG = {
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
  connectionTimeoutMillis: 10000,
};

const output = [];
function log(msg) { console.log(msg); output.push(msg); }

async function main() {
  // Conectar ao MySQL (PEPS)
  const mysqlConn = await mysql.createConnection(DATABASE_URL);
  
  // Conectar ao PostgreSQL (ACS)
  const pgClient = new pg.Client(ACS_CONFIG);
  await pgClient.connect();
  
  log('╔══════════════════════════════════════════════════════════════════════╗');
  log('║   AUDITORIA COMPLETA DE NFes - REDE GUERRA DE POSTOS              ║');
  log('║   Período: 01/12/2025 a 27/02/2026                                ║');
  log('║   Fontes: ACS (PostgreSQL) × Sistema PEPS (MySQL)                 ║');
  log('╚══════════════════════════════════════════════════════════════════════╝');
  log(`Data da auditoria: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`);
  
  // ==========================================
  // 1. POSTOS ATIVOS (MySQL)
  // ==========================================
  const [postos] = await mysqlConn.execute('SELECT id, nome, cnpj, codigoAcs FROM postos WHERE ativo = 1 ORDER BY id');
  log(`\n━━━ POSTOS ATIVOS: ${postos.length} ━━━`);
  const postoMap = new Map(); // codigoAcs -> {id, nome}
  const postoIdMap = new Map(); // id -> {nome, codigoAcs}
  for (const p of postos) {
    const codAcs = (p.codigoAcs || '').trim();
    log(`  ID=${p.id} | ${p.nome} | CNPJ=${p.cnpj} | CodACS=${codAcs}`);
    postoMap.set(codAcs, { id: p.id, nome: p.nome });
    postoIdMap.set(p.id, { nome: p.nome, codigoAcs: codAcs });
  }
  const codEmpresasAtivos = Array.from(postoMap.keys()).filter(k => k !== '');
  
  // ==========================================
  // 2. COMPRAS DO ACS (PostgreSQL) - TODAS no período
  // ==========================================
  log('\n━━━ BUSCANDO COMPRAS DO ACS (PostgreSQL) ━━━');
  
  const placeholders = codEmpresasAtivos.map((_, i) => `$${i + 3}`).join(', ');
  const acsQuery = `
    SELECT 
      c.cod_empresa,
      c.codigo,
      c.documento,
      c.serie,
      c.dt_emissao,
      c.dt_lmc,
      c.cod_fornecedor,
      COALESCE(f.razao_social, 'Fornecedor ' || c.cod_fornecedor) as nome_fornecedor,
      c.total_nota,
      c.total_produtos,
      c.tipo_frete,
      c.frete,
      c.despesas,
      COUNT(i.numero) as total_itens,
      SUM(i.quantidade::numeric) as total_litros,
      (
        SELECT COALESCE(p.descricao, 'Combustível')
        FROM itens_compra_comb ic
        LEFT JOIN produtos p ON TRIM(ic.cod_combustivel) = TRIM(p.codigo)
        WHERE ic.cod_compra = c.codigo AND ic.cod_empresa = c.cod_empresa AND ic.cancelado = 'N'
        ORDER BY ic.quantidade::numeric DESC
        LIMIT 1
      ) as nome_combustivel
    FROM compras_comb c
    LEFT JOIN itens_compra_comb i ON c.codigo = i.cod_compra AND c.cod_empresa = i.cod_empresa AND i.cancelado = 'N'
    LEFT JOIN fornecedores f ON c.cod_fornecedor = f.codigo
    WHERE c.dt_emissao >= $1::date
      AND c.dt_emissao <= $2::date
      AND c.cod_empresa IN (${placeholders})
    GROUP BY c.cod_empresa, c.codigo, c.documento, c.serie, c.dt_emissao, c.dt_lmc, 
             c.cod_fornecedor, f.razao_social, c.total_nota, c.total_produtos, 
             c.tipo_frete, c.frete, c.despesas, nome_combustivel
    ORDER BY c.dt_emissao, c.cod_empresa
  `;
  
  const acsResult = await pgClient.query(acsQuery, ['2025-12-01', '2026-02-27', ...codEmpresasAtivos]);
  const comprasACS = acsResult.rows.map(row => {
    const codEmp = (row.cod_empresa || '').trim();
    const postoInfo = postoMap.get(codEmp);
    return {
      chaveNfe: `ACS-${codEmp}-${row.codigo}`,
      codEmpresa: codEmp,
      codigo: row.codigo,
      documento: (row.documento || '').trim(),
      serie: (row.serie || '').trim(),
      dataEmissao: row.dt_emissao,
      dataLmc: row.dt_lmc,
      fornecedor: row.nome_fornecedor,
      codFornecedor: row.cod_fornecedor,
      totalNota: Number(row.total_nota) || 0,
      totalProdutos: Number(row.total_produtos) || 0,
      totalLitros: Number(row.total_litros) || 0,
      frete: Number(row.frete) || 0,
      tipoFrete: row.tipo_frete,
      produto: row.nome_combustivel || 'Combustível',
      postoId: postoInfo?.id || null,
      postoNome: postoInfo?.nome || `Empresa ${codEmp}`,
    };
  });
  
  log(`  Total de compras no ACS: ${comprasACS.length}`);
  
  // Agrupar por posto
  const acsPorPosto = {};
  let acsVolumeTotal = 0;
  let acsValorTotal = 0;
  for (const c of comprasACS) {
    const key = `${c.postoId}-${c.postoNome}`;
    if (!acsPorPosto[key]) acsPorPosto[key] = { nfes: 0, volume: 0, valor: 0 };
    acsPorPosto[key].nfes++;
    acsPorPosto[key].volume += c.totalLitros;
    acsPorPosto[key].valor += c.totalNota;
    acsVolumeTotal += c.totalLitros;
    acsValorTotal += c.totalNota;
  }
  log('\n  Por posto:');
  for (const [posto, dados] of Object.entries(acsPorPosto)) {
    log(`    ${posto}: ${dados.nfes} NFes | ${dados.volume.toFixed(3)} L | R$ ${dados.valor.toFixed(2)}`);
  }
  log(`  TOTAL ACS: ${comprasACS.length} NFes | ${acsVolumeTotal.toFixed(3)} L | R$ ${acsValorTotal.toFixed(2)}`);
  
  // ==========================================
  // 3. LOTES DO SISTEMA (MySQL) - TODOS no período
  // ==========================================
  log('\n━━━ BUSCANDO LOTES DO SISTEMA (MySQL) ━━━');
  
  const [lotesRows] = await mysqlConn.execute(`
    SELECT l.id, l.tanqueId, l.numeroNf, l.serieNf, l.chaveNfe, l.postoId, 
           p.nome as postoNome, l.nomeFornecedor, l.nomeProduto,
           ROUND(l.quantidadeOriginal, 3) as quantidadeOriginal,
           ROUND(l.quantidadeDisponivel, 3) as quantidadeDisponivel,
           ROUND(l.custoUnitario, 4) as custoUnitario,
           ROUND(l.custoTotal, 2) as custoTotal,
           l.dataEntrada, l.dataEmissao, l.dataLmc,
           l.statusNfe, l.status, l.origem, l.codigoAcs,
           t.codigoAcs as tanqueCodigo
    FROM lotes l
    LEFT JOIN postos p ON l.postoId = p.id
    LEFT JOIN tanques t ON l.tanqueId = t.id
    WHERE l.dataEntrada >= '2025-12-01' AND l.dataEntrada <= '2026-02-27'
      AND l.status != 'cancelado'
    ORDER BY l.postoId, l.dataEntrada
  `);
  
  log(`  Total de lotes no sistema: ${lotesRows.length}`);
  
  // Agrupar por posto
  const lotesPorPosto = {};
  let lotesVolumeTotal = 0;
  let lotesValorTotal = 0;
  for (const l of lotesRows) {
    const key = `${l.postoId}-${l.postoNome || 'N/A'}`;
    if (!lotesPorPosto[key]) lotesPorPosto[key] = { lotes: 0, volume: 0, valor: 0, prov: 0, conf: 0 };
    lotesPorPosto[key].lotes++;
    lotesPorPosto[key].volume += parseFloat(l.quantidadeOriginal) || 0;
    lotesPorPosto[key].valor += parseFloat(l.custoTotal) || 0;
    if (l.statusNfe === 'provisoria') lotesPorPosto[key].prov++;
    else lotesPorPosto[key].conf++;
    lotesVolumeTotal += parseFloat(l.quantidadeOriginal) || 0;
    lotesValorTotal += parseFloat(l.custoTotal) || 0;
  }
  log('\n  Por posto:');
  for (const [posto, dados] of Object.entries(lotesPorPosto)) {
    log(`    ${posto}: ${dados.lotes} lotes (${dados.prov} prov, ${dados.conf} conf) | ${dados.volume.toFixed(3)} L | R$ ${dados.valor.toFixed(2)}`);
  }
  log(`  TOTAL SISTEMA: ${lotesRows.length} lotes | ${lotesVolumeTotal.toFixed(3)} L | R$ ${lotesValorTotal.toFixed(2)}`);
  
  // ==========================================
  // 4. CRUZAMENTO por chaveNfe
  // ==========================================
  
  // Criar mapas para cruzamento
  const acsMap = new Map(); // chaveNfe -> compra ACS
  for (const c of comprasACS) {
    acsMap.set(c.chaveNfe, c);
  }
  
  const lotesMap = new Map(); // chaveNfe -> lote(s)
  const lotesPorChave = new Map(); // chaveNfe -> [lotes]
  for (const l of lotesRows) {
    const chave = l.chaveNfe || '';
    if (!lotesPorChave.has(chave)) lotesPorChave.set(chave, []);
    lotesPorChave.get(chave).push(l);
    lotesMap.set(chave, l);
  }
  
  // Também criar mapa por numeroNf+serie para cruzamento alternativo
  const acsPorDocSerie = new Map();
  for (const c of comprasACS) {
    const key = `${c.documento}/${c.serie}`;
    if (!acsPorDocSerie.has(key)) acsPorDocSerie.set(key, []);
    acsPorDocSerie.get(key).push(c);
  }
  
  const lotesPorDocSerie = new Map();
  for (const l of lotesRows) {
    const key = `${(l.numeroNf || '').trim()}/${(l.serieNf || '').trim()}`;
    if (!lotesPorDocSerie.has(key)) lotesPorDocSerie.set(key, []);
    lotesPorDocSerie.get(key).push(l);
  }
  
  // ==========================================
  // 5. NFes FALTANTES (no ACS mas não no sistema)
  // ==========================================
  log('\n\n╔══════════════════════════════════════════════════════════════════════╗');
  log('║  🔴 NFes FALTANTES (existem no ACS mas NÃO como lote no sistema)  ║');
  log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const faltantes = [];
  for (const c of comprasACS) {
    // Verificar por chaveNfe
    if (lotesPorChave.has(c.chaveNfe)) continue;
    
    // Verificar por documento/serie (fallback)
    const docKey = `${c.documento}/${c.serie}`;
    const lotesPorDoc = lotesPorDocSerie.get(docKey);
    if (lotesPorDoc && lotesPorDoc.length > 0) continue;
    
    faltantes.push(c);
  }
  
  log(`\nTotal: ${faltantes.length} NFes faltantes`);
  
  let volFaltante = 0, valFaltante = 0;
  const faltPorPosto = {};
  for (const f of faltantes) {
    const key = `${f.postoId}-${f.postoNome}`;
    if (!faltPorPosto[key]) faltPorPosto[key] = [];
    faltPorPosto[key].push(f);
    volFaltante += f.totalLitros;
    valFaltante += f.totalNota;
  }
  
  for (const [posto, nfes] of Object.entries(faltPorPosto)) {
    const vol = nfes.reduce((s, n) => s + n.totalLitros, 0);
    log(`\n  ┌── ${posto} (${nfes.length} faltantes | ${vol.toFixed(3)} L) ──`);
    for (const f of nfes) {
      const dt = f.dataEmissao instanceof Date ? f.dataEmissao.toISOString().split('T')[0] : f.dataEmissao;
      log(`  │ Chave: ${f.chaveNfe}`);
      log(`  │ NFe ${f.documento}/${f.serie} | ${dt} | ${f.produto} | ${f.totalLitros.toFixed(3)} L | R$ ${f.totalNota.toFixed(2)} | ${f.fornecedor} | Frete: ${f.tipoFrete}`);
    }
    log(`  └──`);
  }
  log(`\n  TOTAL FALTANTE: ${volFaltante.toFixed(3)} L | R$ ${valFaltante.toFixed(2)}`);
  
  // ==========================================
  // 6. NFes FICTÍCIAS (no sistema mas não no ACS)
  // ==========================================
  log('\n\n╔══════════════════════════════════════════════════════════════════════╗');
  log('║  🟡 NFes FICTÍCIAS (existem como lote no sistema mas NÃO no ACS)  ║');
  log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const ficticias = [];
  for (const l of lotesRows) {
    const chave = l.chaveNfe || '';
    
    // Verificar por chaveNfe
    if (chave && acsMap.has(chave)) continue;
    
    // Verificar por documento/serie (fallback)
    const docKey = `${(l.numeroNf || '').trim()}/${(l.serieNf || '').trim()}`;
    const acsPorDoc = acsPorDocSerie.get(docKey);
    if (acsPorDoc && acsPorDoc.length > 0) continue;
    
    ficticias.push(l);
  }
  
  log(`\nTotal: ${ficticias.length} lotes fictícios (no sistema sem correspondência no ACS)`);
  
  let volFicticio = 0, valFicticio = 0;
  const fictPorPosto = {};
  for (const f of ficticias) {
    const key = `${f.postoId}-${f.postoNome || 'N/A'}`;
    if (!fictPorPosto[key]) fictPorPosto[key] = [];
    fictPorPosto[key].push(f);
    volFicticio += parseFloat(f.quantidadeOriginal) || 0;
    valFicticio += parseFloat(f.custoTotal) || 0;
  }
  
  for (const [posto, nfes] of Object.entries(fictPorPosto)) {
    const vol = nfes.reduce((s, n) => s + (parseFloat(n.quantidadeOriginal) || 0), 0);
    log(`\n  ┌── ${posto} (${nfes.length} fictícias | ${vol.toFixed(3)} L) ──`);
    for (const f of nfes) {
      const dt = f.dataEntrada instanceof Date ? f.dataEntrada.toISOString().split('T')[0] : f.dataEntrada;
      log(`  │ Lote ${f.id} | Chave: ${f.chaveNfe || 'N/A'}`);
      log(`  │ NFe ${f.numeroNf}/${f.serieNf} | ${dt} | ${f.nomeProduto || 'N/A'} | ${f.quantidadeOriginal} L | R$ ${f.custoTotal} | ${f.nomeFornecedor || 'N/A'} | Tanque: ${f.tanqueCodigo || f.tanqueId} | Status: ${f.statusNfe} | Origem: ${f.origem}`);
    }
    log(`  └──`);
  }
  log(`\n  TOTAL FICTÍCIO: ${volFicticio.toFixed(3)} L | R$ ${valFicticio.toFixed(2)}`);
  
  // ==========================================
  // 7. DIVERGÊNCIAS (posto ou volume diferente)
  // ==========================================
  log('\n\n╔══════════════════════════════════════════════════════════════════════╗');
  log('║  🟠 DIVERGÊNCIAS (posto ou volume diferente ACS vs Sistema)        ║');
  log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const divergencias = [];
  for (const c of comprasACS) {
    // Encontrar lote correspondente
    let lotesCorrespondentes = lotesPorChave.get(c.chaveNfe) || [];
    if (lotesCorrespondentes.length === 0) {
      const docKey = `${c.documento}/${c.serie}`;
      lotesCorrespondentes = lotesPorDocSerie.get(docKey) || [];
    }
    
    for (const l of lotesCorrespondentes) {
      const volumeAcs = c.totalLitros;
      const volumeSistema = parseFloat(l.quantidadeOriginal) || 0;
      const diffVolume = Math.abs(volumeAcs - volumeSistema);
      const postoDiff = c.postoId !== l.postoId;
      
      if (diffVolume > 50 || postoDiff) {
        divergencias.push({ acs: c, lote: l, diffVolume, postoDiff });
      }
    }
  }
  
  let postosDiff = 0, volumesDiff = 0;
  log(`\nTotal: ${divergencias.length} divergências`);
  
  for (const d of divergencias) {
    if (d.postoDiff) postosDiff++;
    else volumesDiff++;
    
    const flag = d.postoDiff ? '⚠️  POSTO DIFERENTE' : '📏 Volume diferente';
    const dtAcs = d.acs.dataEmissao instanceof Date ? d.acs.dataEmissao.toISOString().split('T')[0] : d.acs.dataEmissao;
    const dtLote = d.lote.dataEntrada instanceof Date ? d.lote.dataEntrada.toISOString().split('T')[0] : d.lote.dataEntrada;
    
    log(`\n  ${flag} | NFe ${d.acs.documento}/${d.acs.serie} | ${dtAcs} | ${d.acs.produto}`);
    log(`    ACS:     Posto ${d.acs.postoId} (${d.acs.postoNome}) | ${d.acs.totalLitros.toFixed(3)} L | R$ ${d.acs.totalNota.toFixed(2)} | ${d.acs.fornecedor}`);
    log(`    Sistema: Posto ${d.lote.postoId} (${d.lote.postoNome || 'N/A'}) Lote ${d.lote.id} | ${d.lote.quantidadeOriginal} L | R$ ${d.lote.custoTotal} | ${d.lote.nomeFornecedor || 'N/A'} | Tanque: ${d.lote.tanqueCodigo || d.lote.tanqueId}`);
    if (d.postoDiff) {
      log(`    ➜ NFe faturada para ${d.acs.postoNome} mas alocada em ${d.lote.postoNome || 'Posto ' + d.lote.postoId}`);
    }
    log(`    Δ Volume: ${d.diffVolume.toFixed(3)} L`);
  }
  
  log(`\n  Divergências de posto: ${postosDiff}`);
  log(`  Divergências de volume: ${volumesDiff}`);
  
  // ==========================================
  // 8. NFes DUPLICADAS no sistema
  // ==========================================
  log('\n\n╔══════════════════════════════════════════════════════════════════════╗');
  log('║  🔵 NFes DUPLICADAS no sistema (mesmo número em >1 lote ativo)     ║');
  log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const [duplicadas] = await mysqlConn.execute(`
    SELECT l.numeroNf, l.serieNf, COUNT(*) as qtdLotes,
           GROUP_CONCAT(l.id ORDER BY l.id) as loteIds,
           GROUP_CONCAT(l.postoId ORDER BY l.id) as postoIds,
           GROUP_CONCAT(ROUND(l.quantidadeOriginal, 3) ORDER BY l.id) as volumes,
           GROUP_CONCAT(l.statusNfe ORDER BY l.id) as statusNfes,
           GROUP_CONCAT(l.origem ORDER BY l.id) as origens,
           GROUP_CONCAT(COALESCE(l.chaveNfe, 'N/A') ORDER BY l.id) as chaves
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
    log(`\n  NFe ${d.numeroNf}/${d.serieNf}: ${d.qtdLotes} lotes`);
    log(`    Lotes: [${d.loteIds}]`);
    log(`    Postos: [${d.postoIds}]`);
    log(`    Volumes: [${d.volumes}]`);
    log(`    Status: [${d.statusNfes}]`);
    log(`    Origens: [${d.origens}]`);
    log(`    Chaves: [${d.chaves}]`);
  }
  
  // ==========================================
  // 9. RESUMO GERAL
  // ==========================================
  const matches = comprasACS.length - faltantes.length;
  
  log('\n\n╔══════════════════════════════════════════════════════════════════════╗');
  log('║  📊 RESUMO GERAL DA AUDITORIA                                     ║');
  log('╚══════════════════════════════════════════════════════════════════════╝');
  log(`  Compras no ACS (PostgreSQL):   ${comprasACS.length} (${acsVolumeTotal.toFixed(3)} L | R$ ${acsValorTotal.toFixed(2)})`);
  log(`  Lotes no sistema (MySQL):      ${lotesRows.length} (${lotesVolumeTotal.toFixed(3)} L | R$ ${lotesValorTotal.toFixed(2)})`);
  log(`  Matches (encontrados em ambos): ${matches}`);
  log(`  ──────────────────────────────────────────`);
  log(`  🔴 NFes FALTANTES (ACS → sistema):  ${faltantes.length} (${volFaltante.toFixed(3)} L | R$ ${valFaltante.toFixed(2)})`);
  log(`  🟡 NFes FICTÍCIAS (sistema → ACS):  ${ficticias.length} (${volFicticio.toFixed(3)} L | R$ ${valFicticio.toFixed(2)})`);
  log(`  🟠 Divergências de POSTO:           ${postosDiff}`);
  log(`  🟠 Divergências de VOLUME:          ${volumesDiff}`);
  log(`  🔵 NFes DUPLICADAS no sistema:      ${duplicadas.length}`);
  log(`  ──────────────────────────────────────────`);
  log(`  Δ Volume (ACS - Sistema): ${(acsVolumeTotal - lotesVolumeTotal).toFixed(3)} L`);
  log(`  Δ Valor (ACS - Sistema):  R$ ${(acsValorTotal - lotesValorTotal).toFixed(2)}`);
  
  await mysqlConn.end();
  await pgClient.end();
  
  // Salvar relatório
  const reportPath = '/home/ubuntu/auditoria-nfe-report.txt';
  fs.writeFileSync(reportPath, output.join('\n'), 'utf8');
  log(`\n✅ Relatório salvo em ${reportPath}`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
