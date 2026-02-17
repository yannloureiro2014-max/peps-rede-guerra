import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const client = new Client({
  host: '177.87.120.172',
  port: 5432,
  database: 'Sintese_Rede_Guerra',
  user: 'redeguerra',
  password: 'ZQ18Uaa4AD',
});

async function exportarNfes() {
  try {
    await client.connect();
    console.log('✓ Conectado ao ACS');

    const dataInicio = '2025-12-16';
    const dataFim = '2026-02-16';

    const query = `
      SELECT 
        id,
        numero,
        serie,
        data_emissao,
        chave_acesso,
        fornecedor_id,
        empresa_id,
        tipo
      FROM notas_fiscais
      WHERE data_emissao >= $1
        AND data_emissao <= $2
        AND tipo = 'E'
      ORDER BY data_emissao DESC
      LIMIT 10000
    `;

    console.log(`\n📊 Buscando NFes de ${dataInicio} até ${dataFim}...`);
    const result = await client.query(query, [dataInicio, dataFim]);

    console.log(`✓ Encontradas ${result.rows.length} NFes`);

    if (result.rows.length === 0) {
      console.log('⚠️  Nenhuma NFe encontrada no período');
      await client.end();
      return;
    }

    // Salvar em JSON
    const outputPath = path.join(process.cwd(), 'nfes-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(result.rows, null, 2));
    console.log(`✓ Exportadas para: ${outputPath}`);

    // Salvar em CSV
    const csvPath = path.join(process.cwd(), 'nfes-export.csv');
    const headers = Object.keys(result.rows[0] || {});
    const csvContent = [
      headers.join(','),
      ...result.rows.map(row => 
        headers.map(h => {
          const val = row[h];
          if (val === null) return '';
          if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
          if (val instanceof Date) return val.toISOString().split('T')[0];
          return val;
        }).join(',')
      )
    ].join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
    console.log(`✓ Exportadas para: ${csvPath}`);

    console.log(`\n📈 Estatísticas:`);
    console.log(`  Total de NFes: ${result.rows.length}`);

  } catch (erro) {
    console.error('❌ Erro:', erro.message);
  } finally {
    await client.end();
  }
}

exportarNfes();
