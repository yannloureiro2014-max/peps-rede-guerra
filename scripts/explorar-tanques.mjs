import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
});

async function run() {
  await client.connect();
  
  // Buscar estrutura da tabela tanques
  console.log('=== ESTRUTURA TANQUES ===');
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tanques' AND table_schema = 'public'
  `);
  cols.rows.forEach(r => console.log(r.column_name + ': ' + r.data_type));
  
  console.log('\n=== DADOS TANQUES ===');
  const tanques = await client.query('SELECT * FROM tanques LIMIT 30');
  console.log(JSON.stringify(tanques.rows, null, 2));
  
  // Buscar produtos
  console.log('\n=== ESTRUTURA PRODUTOS ===');
  const prodCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'produtos' AND table_schema = 'public'
  `);
  prodCols.rows.forEach(r => console.log(r.column_name + ': ' + r.data_type));
  
  console.log('\n=== PRODUTOS (combustíveis) ===');
  const produtos = await client.query(`SELECT * FROM produtos WHERE tipo = 'C' LIMIT 20`);
  console.log(JSON.stringify(produtos.rows, null, 2));
  
  await client.end();
}

run().catch(console.error);
