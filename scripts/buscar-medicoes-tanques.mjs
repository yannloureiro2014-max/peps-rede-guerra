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

  // Buscar tabela de tanques para entender a estrutura
  console.log('=== ESTRUTURA tanques ===');
  const colsTanques = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tanques' 
    ORDER BY ordinal_position
  `);
  console.log(colsTanques.rows);

  // Amostra de tanques
  console.log('\n=== AMOSTRA tanques ===');
  const amostraTanques = await client.query(`
    SELECT * FROM tanques WHERE cod_empresa = '01' LIMIT 5
  `);
  console.log(amostraTanques.rows);

  // Buscar tabela produtos_estoque que parece ter saldos
  console.log('\n=== ESTRUTURA produtos_estoque ===');
  const colsProdEstoque = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'produtos_estoque' 
    ORDER BY ordinal_position
  `);
  console.log(colsProdEstoque.rows);

  // Amostra produtos_estoque para tanques (cod_estoque = '01' geralmente é tanques)
  console.log('\n=== AMOSTRA produtos_estoque (estoque 01) ===');
  const amostraProdEstoque = await client.query(`
    SELECT * FROM produtos_estoque 
    WHERE cod_empresa = '01' AND cod_estoque = '01'
    LIMIT 10
  `);
  console.log(amostraProdEstoque.rows);

  // Buscar tabela de movimentações de estoque
  console.log('\n=== BUSCANDO TABELAS DE MOVIMENTAÇÃO ===');
  const tabelasMov = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (
      table_name ILIKE '%mov%' 
      OR table_name ILIKE '%hist%'
      OR table_name ILIKE '%diario%'
      OR table_name ILIKE '%fechamento%'
    )
    ORDER BY table_name
  `);
  console.log('Tabelas:', tabelasMov.rows.map(r => r.table_name));

  // Explorar mov_estoque se existir
  for (const t of tabelasMov.rows) {
    console.log(`\n=== ESTRUTURA ${t.table_name} ===`);
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [t.table_name]);
    console.log(cols.rows.map(c => c.column_name));

    // Amostra
    try {
      const amostra = await client.query(`SELECT * FROM "${t.table_name}" LIMIT 2`);
      if (amostra.rows.length > 0) {
        console.log('Amostra:', amostra.rows[0]);
      }
    } catch (e) {
      console.log('Erro:', e.message);
    }
  }

  // Buscar compras_comb (notas fiscais de entrada de combustível)
  console.log('\n\n=== ESTRUTURA compras_comb ===');
  const colsCompras = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'compras_comb' 
    ORDER BY ordinal_position
  `);
  console.log(colsCompras.rows.map(c => c.column_name));

  // Amostra compras_comb recentes
  console.log('\n=== AMOSTRA compras_comb (últimas 5) ===');
  const amostraCompras = await client.query(`
    SELECT cod_empresa, codigo, documento, serie, dt_emissao, dt_entrada, 
           cod_fornecedor, total_nota, chave_nfe
    FROM compras_comb 
    ORDER BY dt_entrada DESC 
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
           MIN(dt_entrada) as primeira, 
           MAX(dt_entrada) as ultima
    FROM compras_comb 
    GROUP BY cod_empresa 
    ORDER BY cod_empresa
  `);
  console.log(totalCompras.rows);

  await client.end();
}

main().catch(console.error);
