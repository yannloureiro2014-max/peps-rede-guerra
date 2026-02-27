#!/usr/bin/env node

const mysql = require('mysql2/promise');

(async () => {
  const connPeps = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        SINCRONIZAÇÃO DE NFes DO ACS PARA nfeStaging                            ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
    
    // Buscar NFes de janeiro/2026 do ACS
    console.log('Buscando NFes de janeiro/2026 do ACS...\n');
    
    // Conectar ao ACS
    const connAcs = await mysql.createConnection({
      host: process.env.ACS_HOST || '177.87.120.172',
      user: process.env.ACS_USER || 'sa',
      password: process.env.ACS_PASSWORD || 'sa',
      database: process.env.ACS_DATABASE || 'ACS_PRODUCAO',
      waitForConnections: true,
      connectionLimit: 1,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelayMs: 0,
      decimalNumbers: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      timeout: 60000,
      ssl: false
    });
    
    // Buscar NFes de compra de janeiro/2026 do ACS
    const [nfes_acs] = await connAcs.execute(`
      SELECT TOP 100
        n.numero_nf as numeroNf,
        n.serie_nf as serieNf,
        n.chave_nfe as chaveNfe,
        n.data_emissao as dataEmissao,
        n.cnpj_faturado as cnpjFaturado,
        n.cnpj_fornecedor as cnpjFornecedor,
        p.cod_produto as codProduto,
        p.descricao as descricaoProduto,
        n.quantidade as quantidade,
        n.valor_unitario as valorUnitario,
        n.valor_total as valorTotal,
        n.valor_frete as valorFrete,
        n.tipo_frete as tipoFrete
      FROM nfes n
      INNER JOIN nfe_itens ni ON n.id = ni.nfe_id
      INNER JOIN produtos p ON ni.produto_id = p.id
      WHERE YEAR(n.data_emissao) = 2026
        AND MONTH(n.data_emissao) = 1
        AND n.tipo_nfe = 'E'  -- Entrada
      ORDER BY n.data_emissao ASC
    `);
    
    console.log(`✓ Total de NFes encontradas no ACS: ${nfes_acs.length}\n`);
    
    if (nfes_acs.length === 0) {
      console.log('⚠ Nenhuma NFe encontrada no ACS para janeiro/2026');
      await connAcs.end();
      await connPeps.end();
      return;
    }
    
    // Buscar produtos no PEPS para mapear
    const [produtos_peps] = await connPeps.execute(`
      SELECT id, codigoAcs, descricao FROM produtos
    `);
    
    const produtoMap = {};
    for (const prod of produtos_peps) {
      produtoMap[prod.codigoAcs] = prod.id;
    }
    
    console.log(`Produtos mapeados: ${Object.keys(produtoMap).length}\n`);
    
    // Inserir NFes no PEPS
    console.log('Inserindo NFes no PEPS...\n');
    
    let inseridas = 0;
    let duplicadas = 0;
    let erros = 0;
    
    for (const nfe of nfes_acs) {
      try {
        // Verificar se já existe
        const [existe] = await connPeps.execute(
          'SELECT id FROM nfeStaging WHERE chaveNfe = ?',
          [nfe.chaveNfe]
        );
        
        if (existe.length > 0) {
          duplicadas++;
          continue;
        }
        
        // Mapear produto
        const produtoId = produtoMap[nfe.codProduto];
        if (!produtoId) {
          console.log(`⚠ Produto não encontrado: ${nfe.codProduto} (${nfe.descricaoProduto})`);
          erros++;
          continue;
        }
        
        // Calcular custo unitário (valor total / quantidade)
        const custoUnitario = parseFloat(nfe.valorTotal) / parseFloat(nfe.quantidade);
        
        // Inserir NFe
        await connPeps.execute(
          `INSERT INTO nfeStaging (
            chaveNfe, numeroNf, serieNf, dataEmissao, cnpjFaturado, cnpjFornecedor,
            produtoId, quantidade, custoUnitario, custoTotal, statusAlocacao,
            quantidadeAlocada, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            nfe.chaveNfe,
            nfe.numeroNf,
            nfe.serieNf,
            new Date(nfe.dataEmissao).toISOString().split('T')[0],
            nfe.cnpjFaturado,
            nfe.cnpjFornecedor,
            produtoId,
            nfe.quantidade,
            custoUnitario,
            nfe.valorTotal,
            'pendente',
            0
          ]
        );
        
        inseridas++;
        
        if (inseridas % 10 === 0) {
          console.log(`  ✓ ${inseridas} NFes inseridas...`);
        }
      } catch (err) {
        console.error(`  ✗ Erro ao inserir NFe ${nfe.numeroNf}: ${err.message}`);
        erros++;
      }
    }
    
    console.log(`\n✅ SINCRONIZAÇÃO CONCLUÍDA!`);
    console.log(`  NFes inseridas: ${inseridas}`);
    console.log(`  NFes duplicadas (ignoradas): ${duplicadas}`);
    console.log(`  Erros: ${erros}`);
    
    await connAcs.end();
    await connPeps.end();
  } catch (err) {
    console.error('Erro:', err.message);
    await connPeps.end();
    process.exit(1);
  }
})();
