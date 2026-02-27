const mysql = require('mysql2/promise');

(async () => {
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    // Buscar vendas de janeiro/2026
    const [vendas] = await connection.execute(`
      SELECT 
        v.id, v.postoId, v.dataVenda, v.quantidade, v.valorTotal, v.cmvCalculado,
        p.nome as postoNome, pr.descricao as produtoNome
      FROM vendas v
      LEFT JOIN postos p ON v.postoId = p.id
      LEFT JOIN produtos pr ON v.produtoId = pr.id
      WHERE v.dataVenda >= '2026-01-01' AND v.dataVenda <= '2026-01-31'
        AND v.afericao = 0
      ORDER BY v.postoId, v.dataVenda
    `);
    
    console.log('=== ETAPA 1: EXTRAÇÃO DE VENDAS DO PEPS ===\n');
    console.log(`Total de vendas: ${vendas.length}\n`);
    
    // Agrupar por posto
    const vendas_por_posto = {};
    let total_quantidade = 0;
    let total_faturamento = 0;
    let total_cmv = 0;
    
    for (const venda of vendas) {
      if (!vendas_por_posto[venda.postoNome]) {
        vendas_por_posto[venda.postoNome] = {
          postoId: venda.postoId,
          quantidade: 0,
          faturamento: 0,
          cmv: 0,
          registros: 0,
          vendas_sem_cmv: 0
        };
      }
      
      vendas_por_posto[venda.postoNome].quantidade += parseFloat(venda.quantidade);
      vendas_por_posto[venda.postoNome].faturamento += parseFloat(venda.valorTotal);
      vendas_por_posto[venda.postoNome].cmv += parseFloat(venda.cmvCalculado || 0);
      vendas_por_posto[venda.postoNome].registros++;
      
      if (!venda.cmvCalculado || venda.cmvCalculado === 0) {
        vendas_por_posto[venda.postoNome].vendas_sem_cmv++;
      }
      
      total_quantidade += parseFloat(venda.quantidade);
      total_faturamento += parseFloat(venda.valorTotal);
      total_cmv += parseFloat(venda.cmvCalculado || 0);
    }
    
    console.log('RESUMO POR POSTO (PEPS):');
    console.log('─'.repeat(100));
    
    for (const [postoNome, dados] of Object.entries(vendas_por_posto)) {
      const lucro_bruto = dados.faturamento - dados.cmv;
      console.log(`\n${postoNome}:`);
      console.log(`  Registros: ${dados.registros}`);
      console.log(`  Quantidade: ${dados.quantidade.toFixed(3)} L`);
      console.log(`  Faturamento: R$ ${dados.faturamento.toFixed(2)}`);
      console.log(`  CMV: R$ ${dados.cmv.toFixed(2)}`);
      console.log(`  Lucro Bruto: R$ ${lucro_bruto.toFixed(2)}`);
      if (dados.vendas_sem_cmv > 0) {
        console.log(`  ⚠️  Vendas sem CMV: ${dados.vendas_sem_cmv}`);
      }
    }
    
    console.log('\n' + '─'.repeat(100));
    console.log('\nTOTAL CONSOLIDADO (PEPS):');
    console.log(`  Quantidade: ${total_quantidade.toFixed(3)} L`);
    console.log(`  Faturamento: R$ ${total_faturamento.toFixed(2)}`);
    console.log(`  CMV: R$ ${total_cmv.toFixed(2)}`);
    console.log(`  Lucro Bruto: R$ ${(total_faturamento - total_cmv).toFixed(2)}`);
    
    await connection.end();
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
})();
