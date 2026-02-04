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
  
  // Ver estrutura da tabela abastecimentos
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'abastecimentos'
    ORDER BY ordinal_position
  `);
  console.log('Colunas de abastecimentos:');
  cols.rows.forEach(r => console.log('  -', r.column_name, ':', r.data_type));
  
  // Ver exemplo de dados
  const sample = await client.query(`
    SELECT * FROM abastecimentos 
    WHERE dt_abast >= '2026-02-01'
    LIMIT 3
  `);
  console.log('\nExemplo de abastecimentos:');
  sample.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));
  
  // Verificar totais de um dia específico para comparar
  const totais = await client.query(`
    SELECT 
      cod_empresa,
      DATE(dt_abast) as data,
      SUM(litros) as total_litros,
      SUM(total) as total_valor,
      COUNT(*) as qtd_registros
    FROM abastecimentos
    WHERE dt_abast >= '2026-02-01' AND dt_abast < '2026-02-02'
      AND baixado = 'S'
    GROUP BY cod_empresa, DATE(dt_abast)
    ORDER BY cod_empresa
  `);
  console.log('\nTotais por posto em 01/02/2026:');
  totais.rows.forEach(r => console.log(r));
  
  await client.end();
}

run().catch(console.error);
