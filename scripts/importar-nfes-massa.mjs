import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import pg from 'pg';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Mapeamento cod_empresa ACS -> postoId PEPS
const POSTO_MAP = {
  '01': 2,  // POSTO GUERRA FORTIM
  '03': 4,  // POSTO GUERRA PALHANO
  '04': 5,  // POSTO PAI TEREZA
  '06': 1,  // MÃE E FILHO
  '08': 8,  // POSTO JAGUARUANA
  '09': 9,  // POSTO ITAIÇABA
};

// Mapeamento produto ACS (descricao) -> produtoId PEPS
const PRODUTO_MAP = {
  'GASOLINA C COMUM': 3,
  'GASOLINA C ADITIVADA': 4,
  'ETANOL HIDRATADO COMUM': 5,
  'OLEO DIESEL B S10': 6,
  'OLEO DIESEL B S10 ADITIVADO': 2,
  'GASOLINA SHELL V-POWER': 1,
};

// Mapeamento postoId + produtoId -> tanqueId (primeiro tanque encontrado)
const TANQUE_MAP = {
  '1-3': 17,  // MÃE E FILHO - Gasolina
  '1-5': 18,  // MÃE E FILHO - Etanol (tanque 18 ou 19)
  '1-6': 20,  // MÃE E FILHO - Diesel S10
  '2-3': 2,   // FORTIM - Gasolina
  '2-5': 1,   // FORTIM - Etanol
  '2-6': 3,   // FORTIM - Diesel S10
  '4-3': 6,   // PALHANO - Gasolina
  '4-6': 7,   // PALHANO - Diesel S10
  '5-3': 9,   // PAI TEREZA - Gasolina
  '5-4': 11,  // PAI TEREZA - Gasolina Aditivada
  '5-5': 8,   // PAI TEREZA - Etanol
  '5-6': 10,  // PAI TEREZA - Diesel S10
  '8-2': 24,  // JAGUARUANA - Diesel Aditivado
  '8-3': 23,  // JAGUARUANA - Gasolina
  '9-3': 25,  // ITAIÇABA - Gasolina
  '9-6': 26,  // ITAIÇABA - Diesel S10
};

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   IMPORTAÇÃO EM MASSA DE NFes DO ACS → SISTEMA PEPS               ║');
  console.log('║   Período: 01/12/2025 a 27/02/2026                                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Conectar ao ACS (PostgreSQL)
  const pgClient = new pg.Client({
    host: '177.87.120.172', port: 5432, database: 'Sintese_Rede_Guerra',
    user: 'redeguerra', password: 'ZQ18Uaa4AD', connectionTimeoutMillis: 15000,
  });
  await pgClient.connect();
  console.log('✅ Conectado ao ACS (PostgreSQL)');

  // Conectar ao PEPS (MySQL)
  const mysqlConn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log('✅ Conectado ao PEPS (MySQL)');

  // 1. Buscar chaves de lotes já existentes no PEPS
  const [existingLotes] = await mysqlConn.execute(`
    SELECT chaveNfe FROM lotes WHERE status != 'cancelado' 
    AND dataEntrada >= '2025-12-01' AND dataEntrada <= '2026-02-27'
  `);
  const existingKeys = new Set(existingLotes.map(l => l.chaveNfe));
  console.log(`\n📋 Lotes já existentes no PEPS: ${existingKeys.size}`);
  existingKeys.forEach(k => console.log(`  ${k}`));

  // 2. Buscar todas as compras do ACS no período
  const acsResult = await pgClient.query(`
    SELECT 
      c.cod_empresa, c.codigo, c.documento, c.serie, c.dt_emissao,
      c.total_nota::numeric as total_nota, c.total_produtos::numeric as total_produtos,
      c.frete::numeric as frete, c.tipo_frete,
      COALESCE(f.razao_social, 'N/A') as fornecedor,
      SUM(i.quantidade::numeric) as litros,
      (SELECT COALESCE(p.descricao, 'N/A') 
       FROM itens_compra_comb ic 
       LEFT JOIN produtos p ON TRIM(ic.cod_combustivel) = TRIM(p.codigo) 
       WHERE ic.cod_compra = c.codigo AND ic.cod_empresa = c.cod_empresa AND ic.cancelado = 'N' 
       ORDER BY ic.quantidade::numeric DESC LIMIT 1) as produto
    FROM compras_comb c
    LEFT JOIN itens_compra_comb i ON c.codigo = i.cod_compra AND c.cod_empresa = i.cod_empresa AND i.cancelado = 'N'
    LEFT JOIN fornecedores f ON c.cod_fornecedor = f.codigo
    WHERE c.cancelada = 'N'
      AND c.dt_emissao >= '2025-12-01' AND c.dt_emissao <= '2026-02-27'
      AND c.cod_empresa IN ('01','03','04','06','08','09')
    GROUP BY c.cod_empresa, c.codigo, c.documento, c.serie, c.dt_emissao, c.total_nota, c.total_produtos, c.frete, c.tipo_frete, f.razao_social
    ORDER BY c.dt_emissao, c.cod_empresa
  `);
  console.log(`\n📦 Compras encontradas no ACS: ${acsResult.rows.length}`);

  // 3. Filtrar apenas as que NÃO existem no PEPS
  const toImport = [];
  const skipped = [];
  
  for (const row of acsResult.rows) {
    const chaveNfe = `ACS-${row.cod_empresa}-${row.codigo.trim()}`;
    if (existingKeys.has(chaveNfe)) {
      skipped.push({ chaveNfe, nfe: `${row.documento}/${row.serie}` });
      continue;
    }
    
    const postoId = POSTO_MAP[row.cod_empresa];
    if (!postoId) {
      console.log(`  ⚠️  Posto não mapeado: cod_empresa=${row.cod_empresa} | NFe ${row.documento}/${row.serie}`);
      continue;
    }

    const produtoNome = row.produto?.trim() || 'N/A';
    const produtoId = PRODUTO_MAP[produtoNome];
    if (!produtoId) {
      console.log(`  ⚠️  Produto não mapeado: "${produtoNome}" | NFe ${row.documento}/${row.serie} | Posto ${postoId}`);
      continue;
    }

    const tanqueKey = `${postoId}-${produtoId}`;
    const tanqueId = TANQUE_MAP[tanqueKey];
    if (!tanqueId) {
      console.log(`  ⚠️  Tanque não mapeado: posto=${postoId} produto=${produtoId} | NFe ${row.documento}/${row.serie}`);
      continue;
    }

    const litros = parseFloat(row.litros) || 0;
    const totalNota = parseFloat(row.total_nota) || 0;
    const totalProdutos = parseFloat(row.total_produtos) || 0;
    const frete = parseFloat(row.frete) || 0;
    const tipoFrete = row.tipo_frete === 'F' ? 'FOB' : 'CIF';
    
    // Custo unitário: (totalProdutos + frete) / litros
    const custoUnitario = litros > 0 ? totalNota / litros : 0;
    const custoUnitarioProduto = litros > 0 ? totalProdutos / litros : 0;
    const custoUnitarioFrete = litros > 0 ? frete / litros : 0;

    toImport.push({
      chaveNfe,
      postoId,
      tanqueId,
      produtoId,
      numeroNf: row.documento,
      serieNf: row.serie,
      codigoAcs: row.codigo.trim(),
      nomeFornecedor: row.fornecedor,
      nomeProduto: produtoNome,
      quantidadeOriginal: litros,
      quantidadeDisponivel: litros,
      custoUnitario: Math.round(custoUnitario * 10000) / 10000,
      custoUnitarioProduto: Math.round(custoUnitarioProduto * 10000) / 10000,
      custoUnitarioFrete: Math.round(custoUnitarioFrete * 10000) / 10000,
      custoTotal: Math.round(totalNota * 100) / 100,
      valorFrete: Math.round(frete * 100) / 100,
      tipoFrete,
      dataEntrada: row.dt_emissao,
      dataEmissao: row.dt_emissao,
      statusNfe: 'provisoria',
      status: 'ativo',
      origem: 'acs',
    });
  }

  console.log(`\n📊 Resumo:`);
  console.log(`  Já existentes (skip): ${skipped.length}`);
  console.log(`  A importar: ${toImport.length}`);
  
  if (skipped.length > 0) {
    console.log(`\n⏭️  Pulados (já existem):`);
    skipped.forEach(s => console.log(`  ${s.chaveNfe} (${s.nfe})`));
  }

  // 4. Inserir em lotes de 50
  let inserted = 0;
  let errors = 0;
  const batchSize = 50;

  for (let i = 0; i < toImport.length; i += batchSize) {
    const batch = toImport.slice(i, i + batchSize);
    
    for (const nfe of batch) {
      try {
        await mysqlConn.execute(`
          INSERT INTO lotes (
            chaveNfe, postoId, tanqueId, produtoId, numeroNf, serieNf, codigoAcs,
            nomeFornecedor, nomeProduto, quantidadeOriginal, quantidadeDisponivel,
            custoUnitario, custoUnitarioProduto, custoUnitarioFrete, custoTotal,
            valorFrete, tipoFrete, dataEntrada, dataEmissao,
            statusNfe, status, origem, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          nfe.chaveNfe, nfe.postoId, nfe.tanqueId, nfe.produtoId,
          nfe.numeroNf, nfe.serieNf, nfe.codigoAcs,
          nfe.nomeFornecedor, nfe.nomeProduto,
          nfe.quantidadeOriginal, nfe.quantidadeDisponivel,
          nfe.custoUnitario, nfe.custoUnitarioProduto, nfe.custoUnitarioFrete,
          nfe.custoTotal, nfe.valorFrete, nfe.tipoFrete,
          nfe.dataEntrada, nfe.dataEmissao,
          nfe.statusNfe, nfe.status, nfe.origem,
        ]);
        inserted++;
      } catch (err) {
        errors++;
        console.log(`  ❌ Erro ao inserir ${nfe.chaveNfe} (${nfe.numeroNf}/${nfe.serieNf}): ${err.message}`);
      }
    }
    
    console.log(`  Inseridos: ${inserted}/${toImport.length} (batch ${Math.floor(i/batchSize)+1})`);
  }

  // 5. Resumo por posto
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  RESULTADO DA IMPORTAÇÃO                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  ✅ Inseridos: ${inserted}`);
  console.log(`  ❌ Erros: ${errors}`);
  console.log(`  ⏭️  Pulados: ${skipped.length}`);

  // Resumo por posto
  const byPosto = {};
  for (const nfe of toImport) {
    if (!byPosto[nfe.postoId]) byPosto[nfe.postoId] = { count: 0, litros: 0, valor: 0 };
    byPosto[nfe.postoId].count++;
    byPosto[nfe.postoId].litros += nfe.quantidadeOriginal;
    byPosto[nfe.postoId].valor += nfe.custoTotal;
  }

  const postoNomes = { 1: 'MÃE E FILHO', 2: 'FORTIM', 4: 'PALHANO', 5: 'PAI TEREZA', 8: 'JAGUARUANA', 9: 'ITAIÇABA' };
  console.log('\n  Por posto:');
  for (const [pid, data] of Object.entries(byPosto)) {
    console.log(`    ${postoNomes[pid] || pid}: ${data.count} NFes | ${data.litros.toFixed(0)}L | R$ ${data.valor.toFixed(2)}`);
  }

  // 6. Verificar total final
  const [finalCount] = await mysqlConn.execute(`
    SELECT COUNT(*) as total, SUM(quantidadeOriginal) as litros, SUM(custoTotal) as valor
    FROM lotes WHERE status != 'cancelado' 
    AND dataEntrada >= '2025-12-01' AND dataEntrada <= '2026-02-27'
  `);
  console.log(`\n  Total de lotes ativos no PEPS agora: ${finalCount[0].total} | ${parseFloat(finalCount[0].litros).toFixed(0)}L | R$ ${parseFloat(finalCount[0].valor).toFixed(2)}`);

  await pgClient.end();
  await mysqlConn.end();
  console.log('\n✅ Importação concluída!');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
