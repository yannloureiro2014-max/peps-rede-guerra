import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
  port: 5432,
  ssl: false,
});

async function main() {
  await client.connect();

  // Estrutura tab_medicao
  console.log('=== ESTRUTURA tab_medicao ===');
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tab_medicao' 
    ORDER BY ordinal_position
  `);
  console.log(cols.rows);

  // Amostra de dados
  console.log('\n=== AMOSTRA tab_medicao ===');
  const amostra = await client.query('SELECT * FROM tab_medicao LIMIT 5');
  console.log(amostra.rows);

  // Contagem por empresa
  console.log('\n=== CONTAGEM POR EMPRESA ===');
  const contagem = await client.query(`
    SELECT cod_empresa, COUNT(*) as total 
    FROM tab_medicao 
    GROUP BY cod_empresa 
    ORDER BY cod_empresa
  `);
  console.log(contagem.rows);

  // Estrutura compras_comb (notas fiscais de combustível)
  console.log('\n=== ESTRUTURA compras_comb ===');
  const colsCompras = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'compras_comb' 
    ORDER BY ordinal_position
  `);
  console.log(colsCompras.rows);

  // Amostra compras_comb
  console.log('\n=== AMOSTRA compras_comb ===');
  const amostraCompras = await client.query('SELECT * FROM compras_comb LIMIT 3');
  console.log(amostraCompras.rows);

  // Estrutura itens_compra_comb
  console.log('\n=== ESTRUTURA itens_compra_comb ===');
  const colsItens = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'itens_compra_comb' 
    ORDER BY ordinal_position
  `);
  console.log(colsItens.rows);

  // Amostra itens_compra_comb
  console.log('\n=== AMOSTRA itens_compra_comb ===');
  const amostraItens = await client.query('SELECT * FROM itens_compra_comb LIMIT 3');
  console.log(amostraItens.rows);

  await client.end();
}

main().catch(console.error);
