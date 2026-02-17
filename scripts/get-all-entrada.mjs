import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
});

async function getAllEntrada() {
  try {
    await client.connect();
    console.log('✓ Conectado ao ACS\n');

    // Buscar TODAS as NFes de entrada
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
        nfe_status
      FROM notas_fiscais
      WHERE tipo = 'E'
      ORDER BY dt_emissao DESC
      LIMIT 100
    `;

    console.log('📊 Buscando TODAS as NFes de entrada...\n');
    const result = await client.query(query);

    console.log(`✓ Encontradas ${result.rows.length} NFes de entrada\n`);

    if (result.rows.length > 0) {
      console.log('📋 Primeiras 10 NFes de entrada:');
      result.rows.slice(0, 10).forEach((r, i) => {
        console.log(`  ${i + 1}. NF ${r.documento}/${r.serie} - ${r.dt_emissao.toISOString().split('T')[0]} - R$ ${parseFloat(r.total_nota).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      });

      // Mostrar range de datas
      const dates = result.rows.map(r => r.dt_emissao);
      const minDate = new Date(Math.min(...dates.map(d => new Date(d))));
      const maxDate = new Date(Math.max(...dates.map(d => new Date(d))));
      console.log(`\n📅 Range de datas: ${minDate.toISOString().split('T')[0]} até ${maxDate.toISOString().split('T')[0]}`);
    }

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    await client.end();
  }
}

getAllEntrada();
