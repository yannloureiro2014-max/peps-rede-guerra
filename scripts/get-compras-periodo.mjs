import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
});

async function getComprasPeriodo() {
  try {
    await client.connect();
    console.log('✓ Conectado ao ACS\n');

    // Buscar compras do período
    const query = `
      SELECT 
        c.cod_empresa,
        c.codigo,
        c.documento,
        c.serie,
        c.dt_emissao,
        c.dt_lmc,
        c.cod_fornecedor,
        c.total_nota,
        c.total_produtos,
        COUNT(i.numero) as total_itens,
        SUM(i.quantidade::numeric) as total_litros
      FROM compras_comb c
      LEFT JOIN itens_compra_comb i ON c.codigo = i.cod_compra AND c.cod_empresa = i.cod_empresa
      WHERE c.dt_emissao >= '2025-12-16'::date
        AND c.dt_emissao <= '2026-02-16'::date
      GROUP BY c.cod_empresa, c.codigo, c.documento, c.serie, c.dt_emissao, c.dt_lmc, c.cod_fornecedor, c.total_nota, c.total_produtos
      ORDER BY c.dt_emissao DESC
      LIMIT 500
    `;

    console.log('📊 Buscando compras de 16/12/2025 até 16/02/2026...\n');
    const result = await client.query(query);

    console.log(`✓ Encontradas ${result.rows.length} compras\n`);

    if (result.rows.length === 0) {
      console.log('⚠️  Nenhuma compra encontrada no período');
      await client.end();
      return;
    }

    // Salvar em JSON
    fs.writeFileSync('compras-periodo.json', JSON.stringify(result.rows, null, 2));
    console.log('✓ Exportadas para: compras-periodo.json\n');

    // Estatísticas
    const totalCompras = result.rows.length;
    const totalCusto = result.rows.reduce((sum, r) => sum + parseFloat(r.total_nota || 0), 0);
    const totalLitros = result.rows.reduce((sum, r) => sum + (parseFloat(r.total_litros) || 0), 0);

    console.log('📈 Estatísticas:');
    console.log(`  Total de compras: ${totalCompras}`);
    console.log(`  Custo total: R$ ${totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Total de litros: ${totalLitros.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} L`);
    console.log(`  Custo médio por litro: R$ ${(totalCusto / totalLitros).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}`);
    console.log(`  Custo médio por compra: R$ ${(totalCusto / totalCompras).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Litros médios por compra: ${(totalLitros / totalCompras).toLocaleString('pt-BR', { minimumFractionDigits: 0 })} L`);

    // Mostrar primeiras 5
    console.log('\n📋 Primeiras 5 compras:');
    result.rows.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. Compra ${r.documento}/${r.serie} - ${r.dt_emissao.toISOString().split('T')[0]} - R$ ${parseFloat(r.total_nota).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - ${parseFloat(r.total_litros).toLocaleString('pt-BR', { minimumFractionDigits: 0 })} L`);
    });

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    await client.end();
  }
}

getComprasPeriodo();
