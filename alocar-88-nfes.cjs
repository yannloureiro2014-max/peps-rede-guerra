#!/usr/bin/env node

const mysql = require('mysql2/promise');

// Mapeamento de postos
const MAPEAMENTO_POSTOS = {
  'MÃE E FILHO': 'SUPER RUSSAS',
  'POSTO GUERRA PALHANO': 'PALHANO',
  'POSTO PAI TEREZA': 'PAI TERESA',
  'POSTO JAGUARUANA': 'JAGUARUANA',
  'POSTO ITAIÇABA': 'ITAIÇABA'
};

// Gaps necessários por posto e combustível
const GAPS_NECESSARIOS = {
  'PALHANO': { 'GASOLINA C COMUM': 12567 },
  'PAI TERESA': { 'GASOLINA C COMUM': 7923, 'ETANOL HIDRATADO COMUM': 11767, 'OLEO DIESEL B S10': 6599 },
  'JAGUARUANA': { 'GASOLINA C COMUM': 24914, 'OLEO DIESEL B S10 ADITIVADO': 23220 },
  'ITAIÇABA': { 'GASOLINA C COMUM': 21643, 'OLEO DIESEL B S10': 2847 }
};

// Mapeamento de produtos
const PRODUTO_MAPEAMENTO = {
  'GASOLINA C COMUM': ['GASOLINA C COMUM', 'GASOLINA COMUM', 'GASOLINA'],
  'ETANOL HIDRATADO COMUM': ['ETANOL', 'ETANOL HIDRATADO', 'ETANOL HIDRATADO COMUM'],
  'OLEO DIESEL B S10': ['S10', 'DIESEL', 'OLEO DIESEL B S10'],
  'OLEO DIESEL B S10 ADITIVADO': ['S10 ADITIVADO', 'DIESEL ADITIVADO', 'OLEO DIESEL B S10 ADITIVADO']
};

(async () => {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        ALOCAÇÃO AUTOMÁTICA DE 88 NFes PENDENTES DE JANEIRO/2026                ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
    
    // ETAPA 1: Buscar NFes pendentes de janeiro
    console.log('ETAPA 1: Buscando NFes pendentes de janeiro...\n');
    
    const [nfes_pendentes] = await connection.execute(`
      SELECT 
        n.id, n.numeroNf, n.serieNf, n.dataEmissao, n.quantidade, 
        n.custoUnitario, n.custoTotal, n.statusAlocacao,
        n.quantidadeAlocada, n.chaveNfe, n.produtoId
      FROM nfeStaging n
      WHERE n.statusAlocacao = 'pendente'
        AND YEAR(n.dataEmissao) = 2026 
        AND MONTH(n.dataEmissao) = 1
      ORDER BY n.dataEmissao ASC
    `);
    
    console.log(`✓ Total de NFes encontradas: ${nfes_pendentes.length}\n`);
    
    if (nfes_pendentes.length === 0) {
      console.log('⚠ Nenhuma NFe pendente encontrada em janeiro/2026!');
      await connection.end();
      return;
    }
    
    // ETAPA 2: Buscar postos e tanques
    console.log('ETAPA 2: Mapeando postos e tanques...\n');
    
    const [postos] = await connection.execute(`
      SELECT id, nome FROM postos WHERE nome IN (
        'MÃE E FILHO', 'POSTO GUERRA PALHANO', 'POSTO PAI TEREZA', 'POSTO JAGUARUANA', 'POSTO ITAIÇABA'
      )
    `);
    
    const posto_id_map = {};
    for (const posto of postos) {
      const postoMapeado = MAPEAMENTO_POSTOS[posto.nome] || posto.nome;
      posto_id_map[postoMapeado] = posto.id;
    }
    
    console.log('Mapeamento de Postos:', posto_id_map, '\n');
    
    // ETAPA 3: Buscar tanques para cada posto
    console.log('ETAPA 3: Buscando tanques...\n');
    
    const [tanques] = await connection.execute(`
      SELECT id, postoId, nomeTanque FROM tanques WHERE postoId IN (?)
    `, [[Object.values(posto_id_map)]]);
    
    const tanques_por_posto = {};
    for (const tanque of tanques) {
      if (!tanques_por_posto[tanque.postoId]) {
        tanques_por_posto[tanque.postoId] = [];
      }
      tanques_por_posto[tanque.postoId].push(tanque);
    }
    
    console.log('Tanques por Posto:', tanques_por_posto, '\n');
    
    // ETAPA 4: Agrupar NFes por produto
    console.log('ETAPA 4: Agrupando NFes por produto...\n');
    
    const nfes_por_produto = {};
    for (const nfe of nfes_pendentes) {
      const produto = nfe.nomeProduto;
      
      if (!nfes_por_produto[produto]) {
        nfes_por_produto[produto] = [];
      }
      
      nfes_por_produto[produto].push(nfe);
    }
    
    console.log('NFes por Produto:\n');
    for (const [produto, nfes] of Object.entries(nfes_por_produto)) {
      const total_qty = nfes.reduce((sum, n) => sum + parseFloat(n.quantidade), 0);
      const total_valor = nfes.reduce((sum, n) => sum + parseFloat(n.custoTotal), 0);
      console.log(`  ${produto}: ${nfes.length} NFes, ${total_qty.toFixed(0)} L, R$ ${total_valor.toFixed(2)}`);
    }
    
    // ETAPA 5: Alocar NFes aos postos
    console.log('\n\nETAPA 5: Alocando NFes aos postos...\n');
    
    let total_alocado = 0;
    let total_nfes_alocadas = 0;
    const alocacoes_realizadas = [];
    
    for (const [posto, combustiveis_necessarios] of Object.entries(GAPS_NECESSARIOS)) {
      const posto_id = posto_id_map[posto];
      if (!posto_id) {
        console.log(`⚠ Posto ${posto} não encontrado no PEPS`);
        continue;
      }
      
      console.log(`\n${posto} (ID: ${posto_id}):`);
      
      const tanques_deste_posto = tanques_por_posto[posto_id] || [];
      if (tanques_deste_posto.length === 0) {
        console.log(`  ⚠ Nenhum tanque encontrado para este posto`);
        continue;
      }
      
      for (const [combustivel_dre, volume_necessario] of Object.entries(combustiveis_necessarios)) {
        // Encontrar NFes deste produto
        let nfes_encontradas = [];
        
        for (const [prod_peps, prod_acs_list] of Object.entries(PRODUTO_MAPEAMENTO)) {
          if (prod_peps === combustivel_dre) {
            for (const prod_acs of prod_acs_list) {
              if (nfes_por_produto[prod_acs]) {
                nfes_encontradas = nfes_encontradas.concat(nfes_por_produto[prod_acs]);
              }
            }
          }
        }
        
        if (nfes_encontradas.length === 0) {
          console.log(`  ⚠ Nenhuma NFe de ${combustivel_dre} encontrada`);
          continue;
        }
        
        let volume_alocado_combustivel = 0;
        
        for (const nfe of nfes_encontradas) {
          if (volume_alocado_combustivel >= volume_necessario) break;
          
          const volume_a_alocar = Math.min(
            parseFloat(nfe.quantidade) - (parseFloat(nfe.quantidadeAlocada) || 0),
            volume_necessario - volume_alocado_combustivel
          );
          
          if (volume_a_alocar > 0) {
            try {
              // Usar o primeiro tanque do posto (simplificado)
              const tanque = tanques_deste_posto[0];
              
              // Inserir alocação física
              const [result] = await connection.execute(
                `INSERT INTO alocacoesFisicas (
                  nfeStagingId, postoDestinoId, tanqueDestinoId, volumeAlocado,
                  custoUnitarioAplicado, dataDescargaReal, horaDescargaReal,
                  nomeFornecedor, nomeProduto, tipoFrete, custoUnitarioProduto,
                  custoUnitarioFrete, valorFrete, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                  nfe.id, posto_id, tanque.id, volume_a_alocar,
                  nfe.custoUnitario, new Date().toISOString().split('T')[0], '',
                  nfe.nomeFornecedor, nfe.nomeProduto, nfe.tipoFrete,
                  nfe.custoUnitarioProduto, nfe.custoUnitarioFrete, nfe.valorFrete
                ]
              );
              
              // Atualizar status da NFe
              const novaQuantidadeAlocada = (parseFloat(nfe.quantidadeAlocada) || 0) + volume_a_alocar;
              const statusNovo = novaQuantidadeAlocada >= parseFloat(nfe.quantidade)
                ? 'totalmente_alocado'
                : 'parcialmente_alocado';
              
              await connection.execute(
                `UPDATE nfeStaging SET 
                  quantidadeAlocada = ?, 
                  statusAlocacao = ?, 
                  updatedAt = NOW()
                WHERE id = ?`,
                [novaQuantidadeAlocada, statusNovo, nfe.id]
              );
              
              volume_alocado_combustivel += volume_a_alocar;
              total_alocado += volume_a_alocar;
              total_nfes_alocadas++;
              
              alocacoes_realizadas.push({
                nf: `${nfe.numeroNf}/${nfe.serieNf}`,
                produto: nfe.nomeProduto,
                volume: volume_a_alocar,
                posto: posto,
                status: statusNovo
              });
              
              console.log(`  ✓ NF ${nfe.numeroNf}/${nfe.serieNf}: ${volume_a_alocar.toFixed(0)} L de ${combustivel_dre} alocada`);
            } catch (err) {
              console.error(`  ✗ Erro ao alocar NF ${nfe.numeroNf}: ${err.message}`);
            }
          }
        }
        
        console.log(`  → Total alocado: ${volume_alocado_combustivel.toFixed(0)} L de ${combustivel_dre}`);
      }
    }
    
    console.log(`\n\n✅ ALOCAÇÃO CONCLUÍDA!`);
    console.log(`  Total de NFes alocadas: ${total_nfes_alocadas}`);
    console.log(`  Volume total alocado: ${total_alocado.toFixed(0)} L`);
    console.log(`\n  Alocações realizadas:`);
    
    for (const alocacao of alocacoes_realizadas) {
      console.log(`    - NF ${alocacao.nf}: ${alocacao.volume.toFixed(0)} L de ${alocacao.produto} → ${alocacao.posto} (${alocacao.status})`);
    }
    
    await connection.end();
  } catch (err) {
    console.error('Erro:', err.message);
    await connection.end();
    process.exit(1);
  }
})();
