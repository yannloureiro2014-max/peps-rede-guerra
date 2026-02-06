// Script para marcar aferições - roda como parte do servidor
// Usa a conexão ACS diretamente e atualiza via SQL no PEPS
import pg from "pg";

const acsClient = new pg.Client({
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
});

async function main() {
  await acsClient.connect();
  
  // Buscar todos os códigos de aferição do ACS
  console.log("Buscando aferições do ACS...");
  const result = await acsClient.query(`
    SELECT CONCAT(TRIM(cod_empresa), '-', TRIM(codigo)) as codigo_acs
    FROM abastecimentos 
    WHERE afericao = 'S' AND dt_abast >= '2025-12-01'
  `);
  
  console.log(`Encontradas ${result.rows.length} aferições no ACS`);
  
  // Salvar os códigos em um arquivo JSON para uso posterior
  const codigos = result.rows.map(r => r.codigo_acs);
  const fs = await import("fs");
  fs.writeFileSync("/tmp/afericoes-codigos.json", JSON.stringify(codigos));
  console.log(`Salvos ${codigos.length} códigos em /tmp/afericoes-codigos.json`);
  console.log("Exemplos:", codigos.slice(0, 5));
  
  await acsClient.end();
}

main().catch(console.error);
