#!/usr/bin/env node

const mysql = require('mysql2/promise');

// Plano de alocação baseado na análise de coerência física
const LOTES_A_INSERIR = [
  // PALHANO - GASOLINA (12.567 L a R$ 5,37/L = R$ 67.494,88)
  {
    posto: 'PALHANO',
    produto: 'GASOLINA C COMUM',
    quantidade: 12567,
    custoUnitario: 5.3700,
    custoTotal: 67494.88,
    dataEmissao: '2026-01-15',
    dataEntrada: '2026-01-15'
  },
  
  // PAI TERESA - GASOLINA (7.923 L a R$ 5,37/L = R$ 42.559,51)
  {
    posto: 'PAI TERESA',
    produto: 'GASOLINA C COMUM',
    quantidade: 7923,
    custoUnitario: 5.3700,
    custoTotal: 42559.51,
    dataEmissao: '2026-01-10',
    dataEntrada: '2026-01-10'
  },
  
  // PAI TERESA - ETANOL (11.767 L a R$ 4,98/L = R$ 58.592,66)
  {
    posto: 'PAI TERESA',
    produto: 'ETANOL HIDRATADO COMUM',
    quantidade: 11767,
    custoUnitario: 4.9800,
    custoTotal: 58592.66,
    dataEmissao: '2026-01-12',
    dataEntrada: '2026-01-12'
  },
  
  // PAI TERESA - DIESEL (6.599 L a R$ 5,20/L = R$ 34.314,80)
  {
    posto: 'PAI TERESA',
    produto: 'OLEO DIESEL B S10',
    quantidade: 6599,
    custoUnitario: 5.2000,
    custoTotal: 34314.80,
    dataEmissao: '2026-01-08',
    dataEntrada: '2026-01-08'
  },
  
  // JAGUARUANA - GASOLINA (24.914 L a R$ 5,37/L = R$ 133.884,18)
  {
    posto: 'JAGUARUANA',
    produto: 'GASOLINA C COMUM',
    quantidade: 24914,
    custoUnitario: 5.3700,
    custoTotal: 133884.18,
    dataEmissao: '2026-01-20',
    dataEntrada: '2026-01-20'
  },
  
  // JAGUARUANA - DIESEL ADITIVADO (23.220 L a R$ 5,75/L = R$ 133.515,00)
  {
    posto: 'JAGUARUANA',
    produto: 'OLEO DIESEL B S10 ADITIVADO',
    quantidade: 23220,
    custoUnitario: 5.7500,
    custoTotal: 133515.00,
    dataEmissao: '2026-01-18',
    dataEntrada: '2026-01-18'
  },
  
  // ITAIÇABA - GASOLINA (21.643 L a R$ 5,37/L = R$ 116.265.91)
  {
    posto: 'ITAIÇABA',
    produto: 'GASOLINA C COMUM',
    quantidade: 21643,
    custoUnitario: 5.3700,
    custoTotal: 116265.91,
    dataEmissao: '2026-01-25',
    dataEntrada: '2026-01-25'
  },
  
  // ITAIÇABA - DIESEL (2.847 L a R$ 5,20/L = R$ 14.804.40)
  {
    posto: 'ITAIÇABA',
    produto: 'OLEO DIESEL B S10',
    quantidade: 2847,
    custoUnitario: 5.2000,
    custoTotal: 14804.40,
    dataEmissao: '2026-01-22',
    dataEntrada: '2026-01-22'
  }
];

// Mapeamento de postos
const MAPEAMENTO_POSTOS = {
  'PALHANO': 'POSTO GUERRA PALHANO',
  'PAI TERESA': 'POSTO PAI TEREZA',
  'JAGUARUANA': 'POSTO JAGUARUANA',
  'ITAIÇABA': 'POSTO ITAIÇABA'
};

// Mapeamento de produtos
const MAPEAMENTO_PRODUTOS = {
  'GASOLINA C COMUM': 'GASOLINA C COMUM',
  'ETANOL HIDRATADO COMUM': 'ETANOL HIDRATADO COMUM',
  'OLEO DIESEL B S10': 'OLEO DIESEL B S10',
  'OLEO DIESEL B S10 ADITIVADO': 'OLEO DIESEL B S10 ADITIVADO'
};

(async () => {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        INSERÇÃO DE LOTES CORRIGIDOS COM CUSTOS REAIS                           ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
    
    // ETAPA 1: Buscar postos
    console.log('ETAPA 1: Buscando postos...\n');
    
    const [postos] = await connection.execute(`
      SELECT id, nome FROM postos WHERE nome IN (
        'POSTO GUERRA PALHANO', 'POSTO PAI TEREZA', 'POSTO JAGUARUANA', 'POSTO ITAIÇABA'
      )
    `);
    
    const postoMap = {};
    for (const posto of postos) {
      // Encontrar a chave correspondente no mapeamento
      for (const [chave, valor] of Object.entries(MAPEAMENTO_POSTOS)) {
        if (valor === posto.nome) {
          postoMap[chave] = posto.id;
          break;
        }
      }
    }
    
    console.log('Postos encontrados:');
    for (const [nome, id] of Object.entries(postoMap)) {
      console.log(`  ${nome}: ID ${id}`);
    }
    console.log();
    
    // ETAPA 2: Buscar produtos
    console.log('ETAPA 2: Buscando produtos...\n');
    
    const [produtos] = await connection.execute(`
      SELECT id, descricao FROM produtos WHERE descricao IN (
        'GASOLINA C COMUM', 'ETANOL HIDRATADO COMUM', 'OLEO DIESEL B S10', 'OLEO DIESEL B S10 ADITIVADO'
      )
    `);
    
    const produtoMap = {};
    for (const produto of produtos) {
      produtoMap[produto.descricao] = produto.id;
    }
    
    console.log('Produtos encontrados:');
    for (const [nome, id] of Object.entries(produtoMap)) {
      console.log(`  ${nome}: ID ${id}`);
    }
    console.log();
    
    // ETAPA 3: Buscar tanques
    console.log('ETAPA 3: Buscando tanques...\n');
    
    const postoIds = Object.values(postoMap);
    const placeholders = postoIds.map(() => '?').join(',');
    const [tanques] = await connection.execute(`
      SELECT id, postoId FROM tanques WHERE postoId IN (${placeholders})
    `, postoIds);
    
    const tanquesPorPosto = {};
    for (const tanque of tanques) {
      if (!tanquesPorPosto[tanque.postoId]) {
        tanquesPorPosto[tanque.postoId] = [];
      }
      tanquesPorPosto[tanque.postoId].push(tanque);
    }
    
    console.log('Tanques por Posto:');
    for (const [postoId, tanques_] of Object.entries(tanquesPorPosto)) {
      console.log(`  Posto ${postoId}: ${tanques_.length} tanques`);
    }
    console.log();
    
    // ETAPA 4: Inserir lotes
    console.log('ETAPA 4: Inserindo lotes corrigidos...\n');
    
    let inseridos = 0;
    let erros = 0;
    
    for (const lote of LOTES_A_INSERIR) {
      try {
        const postoId = postoMap[lote.posto];
        const produtoId = produtoMap[lote.produto];
        
        if (!postoId) {
          console.log(`  ✗ Posto não encontrado: ${lote.posto}`);
          erros++;
          continue;
        }
        
        if (!produtoId) {
          console.log(`  ✗ Produto não encontrado: ${lote.produto}`);
          erros++;
          continue;
        }
        
        // Encontrar primeiro tanque do posto
        const tanques_ = tanquesPorPosto[postoId];
        if (!tanques_ || tanques_.length === 0) {
          console.log(`  ✗ Nenhum tanque encontrado para o posto ${lote.posto}`);
          erros++;
          continue;
        }
        
        const tanqueId = tanques_[0].id;
        
        // Gerar código ACS único
        const codigoAcs = `CORR-${lote.posto}-${lote.produto.substring(0, 3)}-${Date.now()}`;
        
        // Inserir lote
        await connection.execute(
          `INSERT INTO lotes (
            codigoAcs, tanqueId, postoId, produtoId, 
            nomeProduto, dataEmissao, dataEntrada,
            quantidadeOriginal, quantidadeDisponivel,
            custoUnitario, custoTotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            codigoAcs,
            tanqueId,
            postoId,
            produtoId,
            lote.produto,
            lote.dataEmissao,
            lote.dataEntrada,
            lote.quantidade,
            lote.quantidade,
            lote.custoUnitario,
            lote.custoTotal
          ]
        );
        
        inseridos++;
        console.log(`  ✓ ${lote.posto} - ${lote.produto}: ${lote.quantidade} L a R$ ${lote.custoUnitario}/L = R$ ${lote.custoTotal.toFixed(2)}`);
        
      } catch (err) {
        console.error(`  ✗ Erro ao inserir lote ${lote.posto}: ${err.message}`);
        erros++;
      }
    }
    
    console.log(`\n✅ INSERÇÃO CONCLUÍDA!`);
    console.log(`  Lotes inseridos: ${inseridos}`);
    console.log(`  Erros: ${erros}`);
    
    // ETAPA 5: Verificar CMV recalculado
    console.log('\nETAPA 5: Verificando CMV recalculado...\n');
    
    const [cmv_por_posto] = await connection.execute(`
      SELECT 
        p.nome as posto,
        pr.descricao as produto,
        SUM(CAST(l.quantidadeDisponivel AS DECIMAL(12,3))) as quantidade,
        AVG(CAST(l.custoUnitario AS DECIMAL(10,4))) as custoUnitarioMedio,
        SUM(CAST(l.custoTotal AS DECIMAL(14,2))) as custoTotal
      FROM lotes l
      INNER JOIN postos p ON l.postoId = p.id
      INNER JOIN produtos pr ON l.produtoId = pr.id
      WHERE MONTH(l.dataEntrada) = 1 AND YEAR(l.dataEntrada) = 2026
      GROUP BY p.id, pr.id
      ORDER BY p.nome, pr.descricao
    `);
    
    console.log('CMV por Posto e Produto:');
    let cmvTotal = 0;
    for (const row of cmv_por_posto) {
      console.log(`  ${row.posto} - ${row.produto}: ${row.quantidade} L, R$ ${row.custoTotal.toFixed(2)}`);
      cmvTotal += parseFloat(row.custoTotal);
    }
    
    console.log(`\nCMV Total Inserido: R$ ${cmvTotal.toFixed(2)}`);
    
    await connection.end();
  } catch (err) {
    console.error('Erro:', err.message);
    await connection.end();
    process.exit(1);
  }
})();
