import pg from 'pg';

const client = new pg.Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
});

async function run() {
  await client.connect();
  
  // Ver exemplo de dados de compras recentes usando dt_emissao
  const sample = await client.query(`
    SELECT * FROM compras_comb 
    WHERE dt_emissao >= '2026-01-01'
    ORDER BY dt_emissao DESC
    LIMIT 3
  `);
  console.log('Exemplo de compras_comb:');
  sample.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));
  
  // Verificar tabela itens_compra_comb
  const colsItens = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'itens_compra_comb'
    ORDER BY ordinal_position
  `);
  console.log('\nColunas de itens_compra_comb:');
  colsItens.rows.forEach(r => console.log('  -', r.column_name, ':', r.data_type));
  
  // Ver exemplo de itens de compra
  const sampleItens = await client.query(`
    SELECT i.*, c.documento as num_nf, c.dt_emissao
    FROM itens_compra_comb i
    JOIN compras_comb c ON i.cod_empresa = c.cod_empresa AND i.cod_compra = c.codigo
    WHERE c.dt_emissao >= '2026-01-01'
    ORDER BY c.dt_emissao DESC
    LIMIT 5
  `);
  console.log('\nExemplo de itens_compra_comb com NF:');
  sampleItens.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));
  
  await client.end();
}

run().catch(console.error);
