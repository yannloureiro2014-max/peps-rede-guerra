import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
  port: 5432,
  ssl: false,
});

async function main() {
  await client.connect();

  // Buscar tabelas que podem conter medições físicas diárias
  console.log('=== BUSCANDO TABELAS COM MEDIÇÕES DIÁRIAS ===');
  const tabelas = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  
  // Procurar tabelas com colunas de data e quantidade/volume
  for (const t of tabelas.rows) {
    const cols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [t.table_name]);
    
    const colNames = cols.rows.map(c => c.column_name.toLowerCase());
    
    // Procurar tabelas com data + volume/quantidade + tanque/combustível
    if ((colNames.some(c => c.includes('data') || c.includes('date')) &&
        colNames.some(c => c.includes('volume') || c.includes('quantidade') || c.includes('qtd') || c.includes('saldo') || c.includes('estoque'))) ||
        t.table_name.includes('lmc') || t.table_name.includes('medicao')) {
      console.log(`\n=== ${t.table_name} ===`);
      console.log('Colunas:', colNames);
      
      try {
        const amostra = await client.query(`SELECT * FROM "${t.table_name}" LIMIT 2`);
        console.log('Amostra:', amostra.rows);
      } catch (e) {
        console.log('Erro ao ler:', e.message);
      }
    }
  }

  // Explorar compras_comb
  console.log('\n\n=== ESTRUTURA compras_comb ===');
  const colsCompras = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'compras_comb' 
    ORDER BY ordinal_position
  `);
  console.log(colsCompras.rows);

  console.log('\n=== AMOSTRA compras_comb (últimas 3) ===');
  const amostraCompras = await client.query(`
    SELECT * FROM compras_comb 
    ORDER BY data_emissao DESC 
    LIMIT 3
  `);
  console.log(amostraCompras.rows);

  // Explorar itens_compra_comb
  console.log('\n=== ESTRUTURA itens_compra_comb ===');
  const colsItens = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'itens_compra_comb' 
    ORDER BY ordinal_position
  `);
  console.log(colsItens.rows);

  console.log('\n=== AMOSTRA itens_compra_comb ===');
  const amostraItens = await client.query('SELECT * FROM itens_compra_comb LIMIT 3');
  console.log(amostraItens.rows);

  // Contagem de compras por empresa
  console.log('\n=== CONTAGEM COMPRAS POR EMPRESA ===');
  const contagemCompras = await client.query(`
    SELECT cod_empresa, COUNT(*) as total 
    FROM compras_comb 
    GROUP BY cod_empresa 
    ORDER BY cod_empresa
  `);
  console.log(contagemCompras.rows);

  await client.end();
}

main().catch(console.error);
