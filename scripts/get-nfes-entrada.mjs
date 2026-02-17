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

async function getNfesEntrada() {
  try {
    await client.connect();
    console.log('✓ Conectado ao ACS\n');

    // Buscar NFes de entrada (tipo E) do período
    const query = `
      SELECT 
        documento,
        serie,
        dt_emissao,
        nfe_chave,
        cod_empresa,
        cod_cliente,
        cod_estoque,
        total_nota,
        nfe_status,
        observacao
      FROM notas_fiscais
      WHERE tipo = 'E'
        AND dt_emissao >= '2025-12-16'::date
        AND dt_emissao <= '2026-02-16'::date
      ORDER BY dt_emissao DESC
    `;

    console.log('📊 Buscando NFes de entrada (tipo E) de 16/12/2025 até 16/02/2026...\n');
    const result = await client.query(query);

    console.log(`✓ Encontradas ${result.rows.length} NFes de entrada\n`);

    if (result.rows.length === 0) {
      console.log('⚠️  Nenhuma NFe de entrada encontrada no período');
      await client.end();
      return;
    }

    // Salvar em JSON
    fs.writeFileSync('nfes-entrada.json', JSON.stringify(result.rows, null, 2));
    console.log('✓ Exportadas para: nfes-entrada.json\n');

    // Mostrar estatísticas
    console.log('📈 Estatísticas:');
    console.log(`  Total: ${result.rows.length} NFes`);
    const totalCusto = result.rows.reduce((sum, r) => sum + parseFloat(r.total_nota || 0), 0);
    console.log(`  Custo total: R$ ${totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Custo médio: R$ ${(totalCusto / result.rows.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    // Mostrar primeiras 5
    console.log('\n📋 Primeiras 5 NFes:');
    result.rows.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. NF ${r.documento}/${r.serie} - ${r.dt_emissao.toISOString().split('T')[0]} - R$ ${parseFloat(r.total_nota).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    });

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    await client.end();
  }
}

getNfesEntrada();
