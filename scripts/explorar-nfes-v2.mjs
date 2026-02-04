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
    
    // Buscar exemplos de compras usando dt_recebimento
    console.log('\n=== EXEMPLOS DE COMPRAS (últimos 6 meses) ===');
    const compras = await client.query(`
      SELECT * FROM compras_comb 
      WHERE dt_recebimento >= CURRENT_DATE - INTERVAL '180 days'
      ORDER BY dt_recebimento DESC
      LIMIT 5
    `);
    console.log('Total de registros:', compras.rowCount);
    if (compras.rows.length > 0) {
      compras.rows.forEach((r, i) => {
        console.log(`\nRegistro ${i+1}:`);
        console.log(`  Empresa: ${r.cod_empresa}`);
        console.log(`  Documento/NF: ${r.documento}`);
        console.log(`  Série: ${r.serie}`);
        console.log(`  Fornecedor: ${r.cod_fornecedor}`);
        console.log(`  Data Emissão: ${r.dt_emissao}`);
        console.log(`  Data Recebimento: ${r.dt_recebimento}`);
        console.log(`  Data LMC: ${r.dt_lmc}`);
        console.log(`  Chave NFe: ${r.chave_eletronica}`);
        console.log(`  Total Nota: ${r.total_nota}`);
        console.log(`  Total Produtos: ${r.total_produtos}`);
      });
    }
    
    // Buscar itens das compras
    console.log('\n=== ESTRUTURA itens_compra_comb ===');
    const estruturaItens = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'itens_compra_comb'
      ORDER BY ordinal_position
    `);
    estruturaItens.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
    // Buscar exemplos de itens
    console.log('\n=== EXEMPLOS DE ITENS DE COMPRA ===');
    const itens = await client.query(`
      SELECT i.*, c.documento, c.dt_recebimento, e.fantasia
      FROM itens_compra_comb i
      JOIN compras_comb c ON i.cod_empresa = c.cod_empresa AND i.codigo = c.codigo
      LEFT JOIN empresas e ON i.cod_empresa = e.cod_empresa
      WHERE c.dt_recebimento >= CURRENT_DATE - INTERVAL '180 days'
      ORDER BY c.dt_recebimento DESC
      LIMIT 10
    `);
    console.log('Total de itens:', itens.rowCount);
    if (itens.rows.length > 0) {
      itens.rows.forEach((r, i) => {
        console.log(`\nItem ${i+1}:`);
        console.log(`  Empresa: ${r.fantasia}`);
        console.log(`  NF: ${r.documento}`);
        console.log(`  Data: ${r.dt_recebimento}`);
        console.log(`  Tanque: ${r.tanque}`);
        console.log(`  Produto: ${r.cod_produto}`);
        console.log(`  Quantidade: ${r.quantidade}`);
        console.log(`  Valor Unit: ${r.valor_unitario}`);
        console.log(`  Valor Total: ${r.valor_total}`);
      });
    }
    
    // Contar total de compras por empresa
    console.log('\n=== TOTAL DE COMPRAS POR EMPRESA ===');
    const totais = await client.query(`
      SELECT c.cod_empresa, e.fantasia, COUNT(*) as total_nfs,
             MIN(c.dt_recebimento) as primeira_compra,
             MAX(c.dt_recebimento) as ultima_compra
      FROM compras_comb c
      LEFT JOIN empresas e ON c.cod_empresa = e.cod_empresa
      WHERE c.cancelada = 'N' OR c.cancelada IS NULL
      GROUP BY c.cod_empresa, e.fantasia
      ORDER BY total_nfs DESC
    `);
    totais.rows.forEach(r => {
      console.log(`${r.fantasia || r.cod_empresa}: ${r.total_nfs} NFs (${r.primeira_compra} a ${r.ultima_compra})`);
    });
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await client.end();
  }
}

explorar();
