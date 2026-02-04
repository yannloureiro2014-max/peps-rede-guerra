import pg from 'pg';

const client = new pg.Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
});

await client.connect();

// Verificar colunas da tabela itens_compra_comb
const cols = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'itens_compra_comb'
  ORDER BY ordinal_position
`);
console.log('Colunas de itens_compra_comb:');
cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

// Buscar uma amostra de dados para ver os valores
const sample = await client.query(`
  SELECT 
    cod_empresa, cod_compra, cod_tanque, quantidade,
    preco, custo_semenc, custo_comenc, valor_nominal
  FROM itens_compra_comb
  ORDER BY cod_compra DESC
  LIMIT 5
`);
console.log('\nAmostra de dados:');
sample.rows.forEach(r => console.log(JSON.stringify(r)));

await client.end();
