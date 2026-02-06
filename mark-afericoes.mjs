import pg from "pg";
import mysql from "mysql2/promise";

const acsClient = new pg.Client({
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
});

async function main() {
  await acsClient.connect();
  
  // 1. Buscar todos os códigos de aferição do ACS
  console.log("Buscando aferições do ACS...");
  const result = await acsClient.query(`
    SELECT CONCAT(TRIM(cod_empresa), '-', TRIM(codigo)) as codigo_acs
    FROM abastecimentos 
    WHERE afericao = 'S' AND dt_abast >= '2025-12-01'
  `);
  
  console.log(`Encontradas ${result.rows.length} aferições no ACS`);
  
  if (result.rows.length === 0) {
    console.log("Nenhuma aferição encontrada");
    await acsClient.end();
    return;
  }
  
  // 2. Conectar ao MySQL do PEPS
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL não definida");
    await acsClient.end();
    return;
  }
  
  const mysqlConn = await mysql.createConnection(dbUrl);
  
  // 3. Marcar aferições no PEPS
  const codigos = result.rows.map(r => r.codigo_acs);
  console.log("Exemplos de códigos:", codigos.slice(0, 5));
  
  // Fazer em batches
  let updated = 0;
  const batchSize = 100;
  for (let i = 0; i < codigos.length; i += batchSize) {
    const batch = codigos.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(',');
    const [result] = await mysqlConn.execute(
      `UPDATE vendas SET afericao = 1 WHERE codigoAcs IN (${placeholders})`,
      batch
    );
    updated += result.affectedRows;
  }
  
  console.log(`${updated} vendas marcadas como aferição no PEPS`);
  
  // 4. Verificar
  const [check] = await mysqlConn.execute('SELECT COUNT(*) as total FROM vendas WHERE afericao = 1');
  console.log(`Total de aferições no PEPS: ${check[0].total}`);
  
  await mysqlConn.end();
  await acsClient.end();
}

main().catch(console.error);
