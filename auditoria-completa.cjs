const mysql = require('mysql2/promise');

// Mapeamento de postos
const MAPEAMENTO_POSTOS = {
  'MÃE E FILHO': 'SUPER RUSSAS',
  'POSTO GUERRA PALHANO': 'PALHANO',
  'POSTO PAI TEREZA': 'PAI TERESA',
  'POSTO JAGUARUANA': 'JAGUARUANA',
  'POSTO ITAIÇABA': 'ITAIÇABA'
};

const POSTOS_VALIDOS = ['SUPER RUSSAS', 'PALHANO', 'PAI TERESA', 'JAGUARUANA', 'ITAIÇABA'];

// Valores da DRE Manual
const DRE_MANUAL = {
  'ITAIÇABA': { lucro_bruto: 27912.89, despesas: 22626.62, liquido: 5286.27 },
  'JAGUARUANA': { lucro_bruto: 30972.72, despesas: 19603.23, liquido: 11369.49 },
  'PAI TERESA': { lucro_bruto: 45426.18, despesas: 25774.16, liquido: 19652.02 },
  'PALHANO': { lucro_bruto: 27801.78, despesas: 19030.80, liquido: 8770.98 },
  'SUPER RUSSAS': { lucro_bruto: 90874.87, despesas: 81385.02, liquido: 9489.85 }
};

const TOTAL_DRE_MANUAL = {
  lucro_bruto: 222988.43,
  despesas: 168419.83,
  liquido: 54568.60
};

(async () => {
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        AUDITORIA MATEMÁTICA OFICIAL - DRE MANUAL VS SISTEMA PEPS               ║');
    console.log('║                          JANEIRO/2026                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
    
    // ETAPA 1: Extrair vendas
    console.log('ETAPA 1: EXTRAÇÃO DE VENDAS DO PEPS\n');
    
    const [vendas] = await connection.execute(`
      SELECT 
        v.id, v.postoId, v.dataVenda, v.quantidade, v.valorTotal, v.cmvCalculado,
        p.nome as postoNome, pr.descricao as produtoNome
      FROM vendas v
      LEFT JOIN postos p ON v.postoId = p.id
      LEFT JOIN produtos pr ON v.produtoId = pr.id
      WHERE v.dataVenda >= '2026-01-01' AND v.dataVenda <= '2026-01-31'
        AND v.afericao = 0
      ORDER BY v.postoId, v.dataVenda
    `);
    
    console.log(`✓ Total de vendas extraído: ${vendas.length}\n`);
    
    // ETAPA 2: Agrupar por posto (com mapeamento)
    console.log('ETAPA 2: RECONSTRUÇÃO DE RESULTADO OPERACIONAL\n');
    
    const vendas_por_posto = {};
    let total_faturamento = 0;
    let total_cmv = 0;
    
    for (const venda of vendas) {
      const postoMapeado = MAPEAMENTO_POSTOS[venda.postoNome] || venda.postoNome;
      
      if (!POSTOS_VALIDOS.includes(postoMapeado)) continue;
      
      if (!vendas_por_posto[postoMapeado]) {
        vendas_por_posto[postoMapeado] = {
          quantidade: 0,
          faturamento: 0,
          cmv: 0,
          registros: 0,
          vendas_sem_cmv: 0
        };
      }
      
      vendas_por_posto[postoMapeado].quantidade += parseFloat(venda.quantidade);
      vendas_por_posto[postoMapeado].faturamento += parseFloat(venda.valorTotal);
      vendas_por_posto[postoMapeado].cmv += parseFloat(venda.cmvCalculado || 0);
      vendas_por_posto[postoMapeado].registros++;
      
      if (!venda.cmvCalculado || venda.cmvCalculado === 0) {
        vendas_por_posto[postoMapeado].vendas_sem_cmv++;
      }
      
      total_faturamento += parseFloat(venda.valorTotal);
      total_cmv += parseFloat(venda.cmvCalculado || 0);
    }
    
    // ETAPA 3: Comparação com DRE Manual
    console.log('ETAPA 3: COMPARAÇÃO COM DRE MANUAL\n');
    console.log('┌─────────────────┬──────────────────┬──────────────────┬──────────────┬────────────────┐');
    console.log('│ POSTO           │ LUCRO BRUTO PEPS │ LUCRO BRUTO DRE  │ DIFERENÇA    │ STATUS         │');
    console.log('├─────────────────┼──────────────────┼──────────────────┼──────────────┼────────────────┤');
    
    let total_peps_lucro = 0;
    let total_diferenca = 0;
    let consistente = true;
    
    for (const posto of POSTOS_VALIDOS) {
      const dados_peps = vendas_por_posto[posto] || { faturamento: 0, cmv: 0 };
      const lucro_peps = dados_peps.faturamento - dados_peps.cmv;
      const lucro_manual = DRE_MANUAL[posto].lucro_bruto;
      const diferenca = lucro_peps - lucro_manual;
      const percentual = lucro_manual !== 0 ? (diferenca / lucro_manual * 100).toFixed(2) : 0;
      
      total_peps_lucro += lucro_peps;
      total_diferenca += Math.abs(diferenca);
      
      const status = Math.abs(diferenca) <= 0.01 ? '✓ OK' : 
                     Math.abs(percentual) <= 0.5 ? '⚠ PARCIAL' : '✗ ERRO';
      
      if (Math.abs(diferenca) > 0.01) {
        consistente = false;
      }
      
      console.log(`│ ${posto.padEnd(15)} │ R$ ${lucro_peps.toFixed(2).padStart(14)} │ R$ ${lucro_manual.toFixed(2).padStart(14)} │ R$ ${diferenca.toFixed(2).padStart(10)} │ ${status.padEnd(14)} │`);
    }
    
    console.log('├─────────────────┼──────────────────┼──────────────────┼──────────────┼────────────────┤');
    const lucro_manual_total = TOTAL_DRE_MANUAL.lucro_bruto;
    const diferenca_total = total_peps_lucro - lucro_manual_total;
    const percentual_total = (diferenca_total / lucro_manual_total * 100).toFixed(2);
    const status_total = Math.abs(diferenca_total) <= 0.01 ? '✓ OK' : 
                         Math.abs(percentual_total) <= 0.5 ? '⚠ PARCIAL' : '✗ ERRO';
    
    console.log(`│ TOTAL           │ R$ ${total_peps_lucro.toFixed(2).padStart(14)} │ R$ ${lucro_manual_total.toFixed(2).padStart(14)} │ R$ ${diferenca_total.toFixed(2).padStart(10)} │ ${status_total.padEnd(14)} │`);
    console.log('└─────────────────┴──────────────────┴──────────────────┴──────────────┴────────────────┘');
    
    console.log(`\nDIFERENÇA PERCENTUAL: ${percentual_total}%`);
    console.log(`DIFERENÇA ABSOLUTA: R$ ${Math.abs(diferenca_total).toFixed(2)}`);
    
    // ETAPA 4: Análise de Vendas sem CMV
    console.log('\n\nETAPA 4: ANÁLISE DE VENDAS SEM CMV\n');
    
    let vendas_sem_cmv_total = 0;
    for (const [posto, dados] of Object.entries(vendas_por_posto)) {
      if (dados.vendas_sem_cmv > 0) {
        console.log(`⚠️  ${posto}: ${dados.vendas_sem_cmv} vendas sem CMV calculado`);
        vendas_sem_cmv_total += dados.vendas_sem_cmv;
      }
    }
    
    if (vendas_sem_cmv_total === 0) {
      console.log('✓ Todas as vendas têm CMV calculado');
    }
    
    // Conclusão
    console.log('\n\nCONCLUSÃO:\n');
    if (Math.abs(diferenca_total) <= 0.01) {
      console.log('✓ SISTEMA CONSISTENTE - Lucro bruto coincide com DRE manual');
    } else if (Math.abs(percentual_total) <= 0.5) {
      console.log('⚠ PARCIALMENTE CONSISTENTE - Diferença dentro de tolerância (0.5%)');
      console.log(`  Diferença: R$ ${Math.abs(diferenca_total).toFixed(2)} (${Math.abs(percentual_total)}%)`);
    } else {
      console.log('✗ INCONSISTENTE - Diferença significativa detectada');
      console.log(`  Diferença: R$ ${Math.abs(diferenca_total).toFixed(2)} (${Math.abs(percentual_total)}%)`);
      console.log('\nPróximas etapas: Investigar alocação de NFes e transferências entre postos');
    }
    
    await connection.end();
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
})();
