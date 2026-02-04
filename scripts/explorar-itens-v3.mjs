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
    
    // Buscar nome correto da tabela de empresas
    console.log('\n=== TABELAS EMPRESA ===');
    const tabEmp = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name ILIKE '%empresa%'
    `);
    console.log('Tabelas:', tabEmp.rows.map(r => r.table_name));
    
    // Buscar exemplos de itens sem join com empresas
    console.log('\n=== EXEMPLOS DE ITENS DE COMPRA ===');
    const itens = await client.query(`
      SELECT i.*, c.documento, c.dt_recebimento, c.dt_lmc, c.chave_eletronica, c.cod_fornecedor
      FROM itens_compra_comb i
      JOIN compras_comb c ON i.cod_empresa = c.cod_empresa AND i.cod_compra = c.codigo
      WHERE c.dt_recebimento >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY c.dt_recebimento DESC
      LIMIT 15
    `);
    console.log('Total de itens:', itens.rowCount);
    if (itens.rows.length > 0) {
      itens.rows.forEach((r, i) => {
        console.log(`\nItem ${i+1}:`);
        console.log(`  Empresa: ${r.cod_empresa}`);
        console.log(`  NF: ${r.documento}`);
        console.log(`  Fornecedor: ${r.cod_fornecedor}`);
        console.log(`  Data Recebimento: ${r.dt_recebimento}`);
        console.log(`  Data LMC: ${r.dt_lmc}`);
        console.log(`  Chave NFe: ${r.chave_eletronica}`);
        console.log(`  Tanque: ${r.cod_tanque}`);
        console.log(`  Combustível: ${r.cod_combustivel}`);
        console.log(`  Quantidade: ${r.quantidade} L`);
        console.log(`  Valor Nominal: ${r.valor_nominal}`);
        console.log(`  Valor Líquido: ${r.valor_liquido}`);
        console.log(`  Preço: ${r.preco}`);
      });
    }
    
    // Contar total
    console.log('\n=== TOTAL DE COMPRAS POR EMPRESA (últimos 60 dias) ===');
    const totais = await client.query(`
      SELECT i.cod_empresa, 
             COUNT(*) as total_itens,
             SUM(i.quantidade) as litros_total,
             COUNT(DISTINCT c.documento) as total_nfs
      FROM itens_compra_comb i
      JOIN compras_comb c ON i.cod_empresa = c.cod_empresa AND i.cod_compra = c.codigo
      WHERE c.dt_recebimento >= CURRENT_DATE - INTERVAL '60 days'
        AND (c.cancelada = 'N' OR c.cancelada IS NULL)
      GROUP BY i.cod_empresa
      ORDER BY litros_total DESC
    `);
    totais.rows.forEach(r => {
      console.log(`Empresa ${r.cod_empresa}: ${r.total_nfs} NFs, ${r.total_itens} itens, ${parseFloat(r.litros_total).toLocaleString()} L`);
    });
    
    // Buscar fornecedores
    console.log('\n=== FORNECEDORES ===');
    const fornecedores = await client.query(`
      SELECT DISTINCT c.cod_fornecedor, f.razao_social, f.fantasia
      FROM compras_comb c
      LEFT JOIN fornecedores f ON c.cod_fornecedor = f.cod_fornecedor
      WHERE c.dt_recebimento >= CURRENT_DATE - INTERVAL '60 days'
      LIMIT 10
    `);
    fornecedores.rows.forEach(r => {
      console.log(`${r.cod_fornecedor}: ${r.fantasia || r.razao_social || 'N/A'}`);
    });
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await client.end();
  }
}

explorar();
