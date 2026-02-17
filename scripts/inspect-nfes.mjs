import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
});

async function inspectNfes() {
  try {
    await client.connect();
    console.log('✓ Conectado ao ACS\n');

    // Buscar uma NFe para ver a estrutura
    const query = `SELECT * FROM notas_fiscais LIMIT 1`;
    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('⚠️  Nenhuma NFe encontrada');
      await client.end();
      return;
    }

    const nfe = result.rows[0];
    console.log('📋 Estrutura de uma NFe:');
    Object.keys(nfe).forEach(key => {
      console.log(`  ${key}: ${nfe[key]}`);
    });

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    await client.end();
  }
}

inspectNfes();
