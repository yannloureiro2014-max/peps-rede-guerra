import pg from "pg";

const client = new pg.Client({
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
});

async function main() {
  await client.connect();
  
  // 1. Ver todas as colunas da tabela abastecimentos
  console.log("=== COLUNAS DA TABELA ABASTECIMENTOS ===");
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'abastecimentos'
    ORDER BY ordinal_position
  `);
  cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) ${r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`));
  
  // 2. Verificar se existe campo tipo_operacao, afericao, calibracao, etc
  console.log("\n=== CAMPOS QUE PODEM INDICAR AFERIÇÃO ===");
  const possibleFields = cols.rows.filter(r => 
    /aferi|calibr|tipo|flag|status|operacao|obs|descr/i.test(r.column_name)
  );
  possibleFields.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
  
  // 3. Ver um exemplo de registro com todos os campos
  console.log("\n=== EXEMPLO DE REGISTRO COMPLETO ===");
  const sample = await client.query(`
    SELECT * FROM abastecimentos 
    WHERE dt_abast >= '2025-12-01'
    LIMIT 3
  `);
  sample.rows.forEach((r, i) => {
    console.log(`\n--- Registro ${i+1} ---`);
    Object.entries(r).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  });
  
  // 4. Verificar valores distintos de campos suspeitos
  console.log("\n=== VALORES DISTINTOS DE tipo_combustivel ===");
  const tipos = await client.query(`
    SELECT DISTINCT tipo_combustivel, COUNT(*) as qtd 
    FROM abastecimentos 
    WHERE dt_abast >= '2025-12-01'
    GROUP BY tipo_combustivel 
    ORDER BY qtd DESC
  `);
  tipos.rows.forEach(r => console.log(`  ${r.tipo_combustivel}: ${r.qtd}`));
  
  // 5. Verificar se há campo 'tipo' ou similar
  console.log("\n=== VERIFICAR CAMPO 'tipo' ===");
  try {
    const tipoField = await client.query(`
      SELECT DISTINCT tipo, COUNT(*) as qtd 
      FROM abastecimentos 
      WHERE dt_abast >= '2025-12-01'
      GROUP BY tipo 
      ORDER BY qtd DESC
    `);
    tipoField.rows.forEach(r => console.log(`  tipo=${r.tipo}: ${r.qtd}`));
  } catch(e) {
    console.log("  Campo 'tipo' não existe");
  }
  
  // 6. Verificar registros com preço = 0 ou total = 0 (possíveis aferições)
  console.log("\n=== REGISTROS COM PRECO=0 OU TOTAL=0 ===");
  const zeros = await client.query(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN preco = 0 THEN 1 ELSE 0 END) as preco_zero,
      SUM(CASE WHEN total = 0 THEN 1 ELSE 0 END) as total_zero,
      SUM(CASE WHEN litros < 0 THEN 1 ELSE 0 END) as litros_negativos
    FROM abastecimentos 
    WHERE dt_abast >= '2025-12-01' AND baixado = 'S'
  `);
  console.log(zeros.rows[0]);
  
  // 7. Verificar se existe campo 'afericao' ou 'tipo_abastecimento'
  console.log("\n=== VERIFICAR CAMPOS ESPECIAIS ===");
  for (const field of ['afericao', 'tipo_abastecimento', 'tipo_abast', 'operacao', 'tipo_operacao', 'flag', 'observacao', 'obs']) {
    try {
      const r = await client.query(`SELECT DISTINCT "${field}", COUNT(*) as qtd FROM abastecimentos WHERE dt_abast >= '2025-12-01' GROUP BY "${field}" ORDER BY qtd DESC LIMIT 10`);
      console.log(`  ${field}:`, r.rows);
    } catch(e) {
      // campo não existe
    }
  }
  
  await client.end();
}

main().catch(console.error);
