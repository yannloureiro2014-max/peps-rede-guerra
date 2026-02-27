const pg = require('pg');

const ACS_CONFIG = {
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
};

(async () => {
  const client = new pg.Client(ACS_CONFIG);
  
  try {
    await client.connect();
    
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║              ANÁLISE DE NFes PARA ALOCAÇÃO FÍSICA - 12/2025 e 01/2026          ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
    
    // Buscar NFes de 12/2025 e 01/2026
    console.log('ETAPA 1: EXTRAÇÃO DE NFes DO ACS\n');
    
    const queryNFes = `
      SELECT 
        nf.cod_empresa,
        nf.cod_nf,
        nf.num_nf,
        nf.ser_nf,
        nf.dat_emissao,
        nf.dat_entrada,
        nf.cod_fornecedor,
        nf.nom_fornecedor,
        nf.vlr_total,
        nfi.cod_produto,
        nfi.nom_produto,
        nfi.qtd_produto,
        nfi.vlr_unitario,
        nfi.vlr_total as vlr_total_item
      FROM notas_fiscais nf
      JOIN nf_itens nfi ON nf.cod_nf = nfi.cod_nf
      WHERE nf.dat_emissao >= '2025-12-01' AND nf.dat_emissao <= '2026-01-31'
      ORDER BY nf.dat_emissao, nf.cod_empresa, nf.num_nf
      LIMIT 500
    `;
    
    const resultNFes = await client.query(queryNFes);
    console.log(`✓ Total de itens de NFe encontrados: ${resultNFes.rows.length}\n`);
    
    // Agrupar por NFe
    const nfes = {};
    for (const row of resultNFes.rows) {
      const chave = `${row.cod_empresa}-${row.num_nf}-${row.ser_nf}`;
      
      if (!nfes[chave]) {
        nfes[chave] = {
          cod_empresa: row.cod_empresa,
          num_nf: row.num_nf,
          ser_nf: row.ser_nf,
          dat_emissao: row.dat_emissao,
          dat_entrada: row.dat_entrada,
          fornecedor: row.nom_fornecedor,
          itens: [],
          total_litros: 0,
          total_valor: 0
        };
      }
      
      nfes[chave].itens.push({
        produto: row.nom_produto,
        quantidade: row.qtd_produto,
        valor_unitario: row.vlr_unitario,
        valor_total: row.vlr_total_item
      });
      
      nfes[chave].total_litros += row.qtd_produto;
      nfes[chave].total_valor += row.vlr_total_item;
    }
    
    console.log('NFes AGRUPADAS:\n');
    console.log('┌────────────────────────┬──────────────┬──────────────┬──────────────┬────────────────┐');
    console.log('│ NFe                    │ Data Emissão │ Litros       │ Valor        │ Custo/L        │');
    console.log('├────────────────────────┼──────────────┼──────────────┼──────────────┼────────────────┤');
    
    for (const [chave, nfe] of Object.entries(nfes)) {
      const data = new Date(nfe.dat_emissao).toLocaleDateString('pt-BR');
      const custo_por_litro = (nfe.total_valor / nfe.total_litros).toFixed(4);
      console.log(`│ ${chave.padEnd(22)} │ ${data} │ ${nfe.total_litros.toFixed(0).padStart(12)} │ R$ ${nfe.total_valor.toFixed(2).padStart(10)} │ R$ ${custo_por_litro.padStart(12)} │`);
    }
    
    console.log('└────────────────────────┴──────────────┴──────────────┴──────────────┴────────────────┘');
    
    // Buscar medições de 01/01 a 02/01/2026
    console.log('\n\nETAPA 2: MEDIÇÕES INICIAIS (01/01 a 02/01/2026)\n');
    
    const queryMedicoes = `
      SELECT 
        med.cod_empresa,
        med.cod_pdv,
        med.dat_medicao,
        med.hor_medicao,
        med.vol_medido,
        med.temperatura,
        pdv.nom_pdv
      FROM medicoes med
      LEFT JOIN pdvs pdv ON med.cod_pdv = pdv.cod_pdv
      WHERE med.dat_medicao >= '2026-01-01' AND med.dat_medicao <= '2026-01-02'
      ORDER BY med.cod_empresa, med.cod_pdv, med.dat_medicao
      LIMIT 200
    `;
    
    const resultMedicoes = await client.query(queryMedicoes);
    console.log(`✓ Total de medições encontradas: ${resultMedicoes.rows.length}\n`);
    
    console.log('ESTOQUE INICIAL POR POSTO (01/01/2026):\n');
    
    const estoques_iniciais = {};
    for (const row of resultMedicoes.rows) {
      const data = new Date(row.dat_medicao).toLocaleDateString('pt-BR');
      const chave = `${row.cod_empresa}-${row.cod_pdv}`;
      
      if (!estoques_iniciais[chave]) {
        estoques_iniciais[chave] = {
          cod_empresa: row.cod_empresa,
          cod_pdv: row.cod_pdv,
          nom_pdv: row.nom_pdv,
          medicoes: []
        };
      }
      
      estoques_iniciais[chave].medicoes.push({
        data: data,
        volume: row.vol_medido,
        temperatura: row.temperatura
      });
    }
    
    for (const [chave, dados] of Object.entries(estoques_iniciais)) {
      console.log(`${dados.nom_pdv}:`);
      for (const med of dados.medicoes) {
        console.log(`  ${med.data}: ${med.volume.toFixed(3)} L (${med.temperatura}°C)`);
      }
      console.log();
    }
    
    await client.end();
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
})();
