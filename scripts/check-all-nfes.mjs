import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
});

async function checkNfes() {
  try {
    await client.connect();
    console.log('✓ Conectado ao ACS\n');

    // Contar todas as NFes
    const countQuery = `SELECT COUNT(*) as total FROM notas_fiscais`;
    const countResult = await client.query(countQuery);
    console.log(`Total de NFes: ${countResult.rows[0].total}`);

    // Buscar tipos de NFe
    const typesQuery = `SELECT DISTINCT tipo FROM notas_fiscais ORDER BY tipo`;
    const typesResult = await client.query(typesQuery);
    console.log('\nTipos de NFe:');
    typesResult.rows.forEach(r => console.log(`  - ${r.tipo}`));

    // Buscar datas
    const datesQuery = `
      SELECT 
        MIN(dt_emissao) as min_date,
        MAX(dt_emissao) as max_date
      FROM notas_fiscais
    `;
    const datesResult = await client.query(datesQuery);
    console.log(`\nData mínima: ${datesResult.rows[0].min_date}`);
    console.log(`Data máxima: ${datesResult.rows[0].max_date}`);

    // Buscar NFes recentes
    console.log('\nÚltimas 10 NFes:');
    const recentQuery = `
      SELECT documento, serie, tipo, dt_emissao, total_nota
      FROM notas_fiscais
      ORDER BY dt_emissao DESC
      LIMIT 10
    `;
    const recentResult = await client.query(recentQuery);
    recentResult.rows.forEach(r => {
      console.log(`  ${r.documento}/${r.serie} (${r.tipo}) - ${r.dt_emissao.toISOString().split('T')[0]} - R$ ${r.total_nota}`);
    });

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    await client.end();
  }
}

checkNfes();
