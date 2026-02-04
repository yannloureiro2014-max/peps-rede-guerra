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
  console.log('Conectado!\n');

  // Amostra compras_comb recentes (usando dt_emissao)
  console.log('=== AMOSTRA compras_comb (últimas 5) ===');
  const amostraCompras = await client.query(`
    SELECT cod_empresa, codigo, documento, serie, dt_emissao, dt_lmc,
           cod_fornecedor, total_nota, total_produtos
    FROM compras_comb 
    ORDER BY dt_emissao DESC 
    LIMIT 5
  `);
  console.log(amostraCompras.rows);

  // Estrutura itens_compra_comb
  console.log('\n=== ESTRUTURA itens_compra_comb ===');
  const colsItens = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'itens_compra_comb' 
    ORDER BY ordinal_position
  `);
  console.log(colsItens.rows.map(c => c.column_name));

  // Amostra itens_compra_comb
  console.log('\n=== AMOSTRA itens_compra_comb ===');
  const amostraItens = await client.query(`
    SELECT * FROM itens_compra_comb LIMIT 3
  `);
  console.log(amostraItens.rows);

  // Contagem de compras
  console.log('\n=== TOTAL COMPRAS POR EMPRESA ===');
  const totalCompras = await client.query(`
    SELECT cod_empresa, COUNT(*) as total, 
           MIN(dt_emissao) as primeira, 
           MAX(dt_emissao) as ultima
    FROM compras_comb 
    GROUP BY cod_empresa 
    ORDER BY cod_empresa
  `);
  console.log(totalCompras.rows);

  // Buscar tabela de fechamento de tanques (LMC)
  console.log('\n=== BUSCANDO TABELAS DE FECHAMENTO/LMC ===');
  const tabelasFech = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (
      table_name ILIKE '%fech%' 
      OR table_name ILIKE '%lmc%'
      OR table_name ILIKE '%aferi%'
      OR table_name ILIKE '%tanque%'
    )
    ORDER BY table_name
  `);
  console.log('Tabelas:', tabelasFech.rows.map(r => r.table_name));

  // Explorar tabela tanques
  console.log('\n=== ESTRUTURA tanques ===');
  const colsTanques = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tanques' 
    ORDER BY ordinal_position
  `);
  console.log(colsTanques.rows.map(c => c.column_name));

  // Amostra tanques
  console.log('\n=== AMOSTRA tanques ===');
  const amostraTanques = await client.query(`
    SELECT * FROM tanques WHERE cod_empresa = '01' LIMIT 3
  `);
  console.log(amostraTanques.rows);

  // Buscar tabela fechamento_tanques ou similar
  console.log('\n=== BUSCANDO fechamento_tanques ===');
  try {
    const colsFech = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fechamento_tanques' 
      ORDER BY ordinal_position
    `);
    console.log('Colunas:', colsFech.rows.map(c => c.column_name));

    const amostraFech = await client.query(`
      SELECT * FROM fechamento_tanques 
      ORDER BY data DESC 
      LIMIT 5
    `);
    console.log('Amostra:', amostraFech.rows);
  } catch (e) {
    console.log('Tabela não existe ou erro:', e.message);
  }

  // Buscar tabela afericao_tanques ou similar
  console.log('\n=== BUSCANDO afericao_tanques ===');
  try {
    const colsAfer = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name ILIKE '%aferi%' 
      ORDER BY ordinal_position
    `);
    console.log('Colunas:', colsAfer.rows);
  } catch (e) {
    console.log('Erro:', e.message);
  }

  // Buscar todas as tabelas com 'tanque' no nome
  console.log('\n=== TABELAS COM TANQUE NO NOME ===');
  const tabelasTanque = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name ILIKE '%tanque%'
  `);
  for (const t of tabelasTanque.rows) {
    console.log(`\n--- ${t.table_name} ---`);
    const cols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [t.table_name]);
    console.log('Colunas:', cols.rows.map(c => c.column_name));
    
    try {
      const count = await client.query(`SELECT COUNT(*) FROM "${t.table_name}"`);
      console.log('Total registros:', count.rows[0].count);
      
      if (parseInt(count.rows[0].count) > 0) {
        const amostra = await client.query(`SELECT * FROM "${t.table_name}" LIMIT 2`);
        console.log('Amostra:', amostra.rows);
      }
    } catch (e) {
      console.log('Erro:', e.message);
    }
  }

  await client.end();
}

main().catch(console.error);
