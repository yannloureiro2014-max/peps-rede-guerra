import pg from "pg";

const ACS_CONFIG = {
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
};

async function test() {
  try {
    console.log("Conectando ao ACS...");
    const client = new pg.Client(ACS_CONFIG);
    await client.connect();
    console.log("✅ Conectado!");
    
    const result = await client.query("SELECT COUNT(*) FROM compras_comb");
    console.log("Total de compras:", result.rows[0].count);
    
    await client.end();
  } catch (error) {
    console.error("❌ Erro:", error.message);
  }
}

test();
