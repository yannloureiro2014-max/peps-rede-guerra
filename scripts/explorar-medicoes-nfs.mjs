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
    console.log('Conectado ao banco ACS!\n');

    // Buscar tabelas relacionadas a medições/LMC
    console.log('=== TABELAS RELACIONADAS A MEDIÇÕES/LMC ===');
    const tabelasMedicao = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name ILIKE '%medi%' 
        OR table_name ILIKE '%lmc%' 
        OR table_name ILIKE '%estoque%'
        OR table_name ILIKE '%tanque%'
        OR table_name ILIKE '%aferi%'
      )
      ORDER BY table_name
    `);
    console.log('Tabelas encontradas:', tabelasMedicao.rows.map(r => r.table_name));

    // Buscar tabelas relacionadas a notas fiscais
    console.log('\n=== TABELAS RELACIONADAS A NOTAS FISCAIS ===');
    const tabelasNF = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name ILIKE '%nota%' 
        OR table_name ILIKE '%nf%' 
        OR table_name ILIKE '%fiscal%'
        OR table_name ILIKE '%compra%'
        OR table_name ILIKE '%entrada%'
      )
      ORDER BY table_name
    `);
    console.log('Tabelas encontradas:', tabelasNF.rows.map(r => r.table_name));

    // Explorar estrutura de tabelas de medição
    for (const tabela of tabelasMedicao.rows) {
      console.log(`\n=== ESTRUTURA: ${tabela.table_name} ===`);
      const colunas = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tabela.table_name]);
      console.log('Colunas:', colunas.rows);

      // Amostra de dados
      const amostra = await client.query(`
        SELECT * FROM "${tabela.table_name}" LIMIT 3
      `);
      console.log('Amostra:', amostra.rows);
    }

    // Explorar estrutura de tabelas de NF
    for (const tabela of tabelasNF.rows) {
      console.log(`\n=== ESTRUTURA: ${tabela.table_name} ===`);
      const colunas = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tabela.table_name]);
      console.log('Colunas:', colunas.rows);

      // Amostra de dados
      const amostra = await client.query(`
        SELECT * FROM "${tabela.table_name}" LIMIT 3
      `);
      console.log('Amostra:', amostra.rows);
    }

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

explorar();
