const pg = require('pg');

const client = new pg.Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
  connectionTimeoutMillis: 10000,
});

async function check() {
  await client.connect();
  
  // Buscar tabelas que possam ter info de empresas
  const tabRes = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%empresa%' OR table_name LIKE '%filial%' OR table_name LIKE '%loja%' OR table_name LIKE '%unidade%')
    ORDER BY table_name
  `);
  console.log('=== TABELAS RELACIONADAS A EMPRESAS ===');
  for (const row of tabRes.rows) {
    console.log(row.table_name);
  }
  
  // Tentar buscar info da empresa 11 via compras_comb (fornecedores distintos)
  const emp11Res = await client.query(`
    SELECT DISTINCT c.cod_empresa, 
      COALESCE(f.razao_social, 'Desconhecido') as fornecedor,
      COUNT(*) as total_nfes
    FROM compras_comb c
    LEFT JOIN fornecedores f ON c.cod_fornecedor = f.codigo
    WHERE c.cod_empresa = '11'
    AND c.dt_emissao >= '2026-02-01'::date
    GROUP BY c.cod_empresa, f.razao_social
    ORDER BY total_nfes DESC
  `);
  console.log('\n=== EMPRESA 11 - FORNECEDORES RECENTES ===');
  for (const row of emp11Res.rows) {
    console.log('Empresa:', row.cod_empresa, '| Fornecedor:', row.fornecedor, '| NFes:', row.total_nfes);
  }
  
  // Verificar todas as empresas com NFes e seus nomes via alguma tabela
  const allEmpRes = await client.query(`
    SELECT DISTINCT cod_empresa, COUNT(*) as total
    FROM compras_comb
    WHERE dt_emissao >= '2025-12-01'::date
    GROUP BY cod_empresa
    ORDER BY cod_empresa
  `);
  console.log('\n=== TODAS AS EMPRESAS COM NFES (dez/2025+) ===');
  for (const row of allEmpRes.rows) {
    console.log('Empresa:', row.cod_empresa, '| Total NFes:', row.total);
  }
  
  await client.end();
}
check().catch(e => { console.error(e); process.exit(1); });
