import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
});

async function listarTabelas() {
  try {
    await client.connect();
    console.log('✓ Conectado ao ACS\n');

    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tabelas disponíveis:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    await client.end();
  }
}

listarTabelas();
