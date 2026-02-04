import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
  ssl: false,
  connectionTimeoutMillis: 30000,
});

async function explorar() {
  try {
    console.log('Conectando ao banco ACS...');
    await client.connect();
    console.log('Conectado!\n');

    // Listar todas as tabelas
    console.log('=== TABELAS DISPONÍVEIS ===');
    const tabelas = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    tabelas.rows.forEach(r => console.log('  -', r.table_name));

    // Buscar tabela de empresas/postos
    console.log('\n=== ESTRUTURA DA TABELA EMPRESA ===');
    try {
      const empresaCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'empresa' AND table_schema = 'public'
      `);
      empresaCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

      console.log('\n=== DADOS DA TABELA EMPRESA ===');
      const empresas = await client.query(`SELECT * FROM empresa LIMIT 20`);
      console.log(empresas.rows);
    } catch (e) {
      console.log('Tabela empresa não encontrada, buscando alternativas...');
    }

    // Buscar tabela de tanques
    console.log('\n=== ESTRUTURA DA TABELA TANQUE ===');
    try {
      const tanqueCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tanque' AND table_schema = 'public'
      `);
      tanqueCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

      console.log('\n=== DADOS DA TABELA TANQUE ===');
      const tanques = await client.query(`SELECT * FROM tanque LIMIT 20`);
      console.log(tanques.rows);
    } catch (e) {
      console.log('Tabela tanque não encontrada');
    }

    // Buscar tabela de produtos
    console.log('\n=== ESTRUTURA DA TABELA PRODUTO ===');
    try {
      const produtoCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'produto' AND table_schema = 'public'
      `);
      produtoCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

      console.log('\n=== DADOS DA TABELA PRODUTO (combustíveis) ===');
      const produtos = await client.query(`SELECT * FROM produto WHERE tipo = 'C' OR descricao ILIKE '%gasolina%' OR descricao ILIKE '%diesel%' OR descricao ILIKE '%etanol%' LIMIT 20`);
      console.log(produtos.rows);
    } catch (e) {
      console.log('Tabela produto não encontrada');
    }

    // Buscar tabela de vendas/abastecimentos
    console.log('\n=== BUSCANDO TABELAS DE VENDAS ===');
    const vendasTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name ILIKE '%venda%' OR table_name ILIKE '%abastec%' OR table_name ILIKE '%movimento%')
    `);
    vendasTables.rows.forEach(r => console.log('  -', r.table_name));

    // Explorar primeira tabela de vendas encontrada
    if (vendasTables.rows.length > 0) {
      const vendaTable = vendasTables.rows[0].table_name;
      console.log(`\n=== ESTRUTURA DA TABELA ${vendaTable.toUpperCase()} ===`);
      const vendaCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [vendaTable]);
      vendaCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

      console.log(`\n=== AMOSTRA DE DADOS (${vendaTable}) ===`);
      const vendas = await client.query(`SELECT * FROM ${vendaTable} LIMIT 5`);
      console.log(vendas.rows);
    }

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

explorar();
