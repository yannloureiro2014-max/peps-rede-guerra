import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
  port: 5432,
  ssl: false,
  connectionTimeoutMillis: 30000,
});

async function explorar() {
  try {
    await client.connect();
    console.log('Conectado ao ACS!');
    
    // Buscar tabelas relacionadas a compras/notas fiscais
    console.log('\n=== TABELAS DE COMPRAS/NFE ===');
    const tabelas = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name ILIKE '%compra%' OR 
        table_name ILIKE '%nf%' OR 
        table_name ILIKE '%nota%' OR
        table_name ILIKE '%entrada%' OR
        table_name ILIKE '%lmc%'
      )
      ORDER BY table_name
    `);
    console.log('Tabelas encontradas:', tabelas.rows.map(r => r.table_name));
    
    // Explorar compras_comb (compras de combustível)
    console.log('\n=== ESTRUTURA compras_comb ===');
    const estrutura = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'compras_comb'
      ORDER BY ordinal_position
    `);
    estrutura.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
    // Buscar exemplos de compras
    console.log('\n=== EXEMPLOS DE COMPRAS (últimos 6 meses) ===');
    const compras = await client.query(`
      SELECT * FROM compras_comb 
      WHERE data_entrada >= CURRENT_DATE - INTERVAL '180 days'
      ORDER BY data_entrada DESC
      LIMIT 10
    `);
    console.log('Total de registros:', compras.rowCount);
    if (compras.rows.length > 0) {
      console.log('Colunas:', Object.keys(compras.rows[0]));
      compras.rows.forEach((r, i) => {
        console.log(`\nRegistro ${i+1}:`, JSON.stringify(r, null, 2));
      });
    }
    
    // Contar total de compras por empresa
    console.log('\n=== TOTAL DE COMPRAS POR EMPRESA ===');
    const totais = await client.query(`
      SELECT c.cod_empresa, e.fantasia, COUNT(*) as total, 
             SUM(c.quantidade) as litros_total,
             MIN(c.data_entrada) as primeira_compra,
             MAX(c.data_entrada) as ultima_compra
      FROM compras_comb c
      LEFT JOIN empresas e ON c.cod_empresa = e.cod_empresa
      GROUP BY c.cod_empresa, e.fantasia
      ORDER BY total DESC
    `);
    totais.rows.forEach(r => {
      console.log(`${r.fantasia}: ${r.total} compras, ${r.litros_total}L (${r.primeira_compra} a ${r.ultima_compra})`);
    });
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await client.end();
  }
}

explorar();
