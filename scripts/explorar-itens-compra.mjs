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
    
    // Buscar exemplos de itens usando cod_compra
    console.log('\n=== EXEMPLOS DE ITENS DE COMPRA ===');
    const itens = await client.query(`
      SELECT i.*, c.documento, c.dt_recebimento, c.dt_lmc, c.chave_eletronica, e.fantasia, p.descricao as produto
      FROM itens_compra_comb i
      JOIN compras_comb c ON i.cod_empresa = c.cod_empresa AND i.cod_compra = c.codigo
      LEFT JOIN empresas e ON i.cod_empresa = e.cod_empresa
      LEFT JOIN produtos p ON i.cod_combustivel = p.cod_produto
      WHERE c.dt_recebimento >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY c.dt_recebimento DESC
      LIMIT 15
    `);
    console.log('Total de itens:', itens.rowCount);
    if (itens.rows.length > 0) {
      itens.rows.forEach((r, i) => {
        console.log(`\nItem ${i+1}:`);
        console.log(`  Empresa: ${r.fantasia} (${r.cod_empresa})`);
        console.log(`  NF: ${r.documento}`);
        console.log(`  Data Recebimento: ${r.dt_recebimento}`);
        console.log(`  Data LMC: ${r.dt_lmc}`);
        console.log(`  Chave NFe: ${r.chave_eletronica}`);
        console.log(`  Tanque: ${r.cod_tanque}`);
        console.log(`  Produto: ${r.produto} (${r.cod_combustivel})`);
        console.log(`  Quantidade: ${r.quantidade} L`);
        console.log(`  Valor Unit (nominal): ${r.valor_nominal}`);
        console.log(`  Valor Unit (líquido): ${r.valor_liquido}`);
        console.log(`  Preço: ${r.preco}`);
        console.log(`  Custo sem enc: ${r.custo_semenc}`);
        console.log(`  Custo com enc: ${r.custo_comenc}`);
      });
    }
    
    // Contar total de itens por empresa
    console.log('\n=== TOTAL DE ITENS DE COMPRA POR EMPRESA (últimos 60 dias) ===');
    const totais = await client.query(`
      SELECT i.cod_empresa, e.fantasia, 
             COUNT(*) as total_itens,
             SUM(i.quantidade) as litros_total,
             COUNT(DISTINCT c.documento) as total_nfs
      FROM itens_compra_comb i
      JOIN compras_comb c ON i.cod_empresa = c.cod_empresa AND i.cod_compra = c.codigo
      LEFT JOIN empresas e ON i.cod_empresa = e.cod_empresa
      WHERE c.dt_recebimento >= CURRENT_DATE - INTERVAL '60 days'
        AND (c.cancelada = 'N' OR c.cancelada IS NULL)
      GROUP BY i.cod_empresa, e.fantasia
      ORDER BY litros_total DESC
    `);
    totais.rows.forEach(r => {
      console.log(`${r.fantasia || r.cod_empresa}: ${r.total_nfs} NFs, ${r.total_itens} itens, ${parseFloat(r.litros_total).toLocaleString()} L`);
    });
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await client.end();
  }
}

explorar();
