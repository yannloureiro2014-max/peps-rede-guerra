const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        ALOCAÇÃO AUTOMÁTICA DE NFes PENDENTES                                   ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
    
    // Mapeamento de postos
    const mapeamento_postos = {
      'MÃE E FILHO': 1,
      'POSTO GUERRA PALHANO': 4,
      'POSTO PAI TEREZA': 5,
      'POSTO JAGUARUANA': 8,
      'POSTO ITAIÇABA': 9
    };
    
    // CMV necessário por posto
    const cmv_necessario = {
      1: 790479.82,  // SUPER RUSSAS
      4: 90458.87,   // PALHANO
      5: 129192.49,  // PAI TERESA
      8: 119143.75,  // JAGUARUANA
      9: 14820.03    // ITAIÇABA
    };
    
    // Mapeamento de produtos
    const mapeamento_produtos = {
      'GASOLINA C COMUM': 3,
      'ETANOL HIDRATADO COMUM': 5,
      'OLEO DIESEL B S10': 6,
      'OLEO DIESEL B S10 ADITIVADO': 2,
      'GASOLINA C ADITIVADA': 4
    };
    
    // Buscar NFes pendentes de janeiro
    const [nfes_pendentes] = await connection.execute(`
      SELECT 
        id, numeroNf, serieNf, dataEmissao,
        produtoId, quantidade, custoUnitario, custoTotal
      FROM nfeStaging
      WHERE statusAlocacao = 'pendente' 
        AND MONTH(dataEmissao) = 1 AND YEAR(dataEmissao) = 2026
      ORDER BY dataEmissao ASC
    `);
    
    console.log(`Total de NFes pendentes: ${nfes_pendentes.length}\n`);
    
    if (nfes_pendentes.length === 0) {
      console.log('❌ Nenhuma NFe pendente encontrada em janeiro/2026');
      await connection.end();
      return;
    }
    
    // Alocar NFes por posto
    let total_alocado = 0;
    let nfes_alocadas = 0;
    
    for (const [postoNome, postoId] of Object.entries(mapeamento_postos)) {
      console.log(`\n📍 Alocando para ${postoNome} (ID ${postoId}):`);
      console.log(`   CMV necessário: R$ ${cmv_necessario[postoId].toFixed(2)}\n`);
      
      let cmv_acumulado = 0;
      let nfes_do_posto = 0;
      
      for (const nfe of nfes_pendentes) {
        // Verificar se NFe já foi alocada
        const [ja_alocada] = await connection.execute(
          `SELECT id FROM alocacoesFisicas WHERE nfeId = ?`,
          [nfe.id]
        );
        
        if (ja_alocada.length > 0) continue;
        
        const cmv_nfe = parseFloat(nfe.custoTotal);
        
        // Verificar se ainda precisa alocar para este posto
        if (cmv_acumulado >= cmv_necessario[postoId]) {
          console.log(`   ✓ CMV atingido: R$ ${cmv_acumulado.toFixed(2)}`);
          break;
        }
        
        // Encontrar tanque apropriado
        const [tanques] = await connection.execute(`
          SELECT id, produtoId FROM tanques WHERE postoId = ? AND ativo = true
        `, [postoId]);
        
        if (tanques.length === 0) {
          console.log(`   ⚠️ Nenhum tanque ativo encontrado para ${postoNome}`);
          continue;
        }
        
        // Selecionar tanque baseado no produto
        let tanqueId = tanques[0].id;
        for (const tanque of tanques) {
          if (tanque.produtoId === nfe.produtoId) {
            tanqueId = tanque.id;
            break;
          }
        }
        
        // Criar alocação
        const codigoAcs = `NFE-${nfe.numeroNf}-${nfe.serieNf}`;
        
        await connection.execute(`
          INSERT INTO alocacoesFisicas (
            nfeId, tanqueId, postoId, produtoId,
            quantidade, custoUnitario, custoTotal,
            dataDescarga, statusAlocacao
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          nfe.id,
          tanqueId,
          postoId,
          nfe.produtoId,
          nfe.quantidade,
          nfe.custoUnitario,
          nfe.custoTotal,
          nfe.dataEmissao,
          'alocado'
        ]);
        
        // Criar lote correspondente
        await connection.execute(`
          INSERT INTO lotes (
            codigoAcs, tanqueId, postoId, produtoId,
            nomeProduto, dataEmissao, dataEntrada,
            quantidadeOriginal, quantidadeDisponivel,
            custoUnitario, custoTotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          codigoAcs,
          tanqueId,
          postoId,
          nfe.produtoId,
          nfe.produtoId === 3 ? 'GASOLINA C COMUM' :
          nfe.produtoId === 5 ? 'ETANOL HIDRATADO COMUM' :
          nfe.produtoId === 6 ? 'OLEO DIESEL B S10' :
          nfe.produtoId === 2 ? 'OLEO DIESEL B S10 ADITIVADO' :
          'GASOLINA C ADITIVADA',
          nfe.dataEmissao,
          nfe.dataEmissao,
          nfe.quantidade,
          nfe.quantidade,
          nfe.custoUnitario,
          nfe.custoTotal
        ]);
        
        // Marcar NFe como alocada
        await connection.execute(
          `UPDATE nfeStaging SET statusAlocacao = 'alocado' WHERE id = ?`,
          [nfe.id]
        );
        
        cmv_acumulado += cmv_nfe;
        nfes_do_posto++;
        nfes_alocadas++;
        total_alocado += cmv_nfe;
        
        console.log(`   ✓ NFe ${nfe.numeroNf}/${nfe.serieNf}: ${nfe.quantidade} L = R$ ${cmv_nfe.toFixed(2)}`);
      }
      
      console.log(`   Total: ${nfes_do_posto} NFes, CMV = R$ ${cmv_acumulado.toFixed(2)}`);
    }
    
    console.log(`\n✅ ALOCAÇÃO CONCLUÍDA!`);
    console.log(`   Total de NFes alocadas: ${nfes_alocadas}`);
    console.log(`   CMV total alocado: R$ ${total_alocado.toFixed(2)}\n`);
    
    await connection.end();
  } catch (err) {
    console.error('Erro:', err.message);
    await connection.end();
    process.exit(1);
  }
})();
