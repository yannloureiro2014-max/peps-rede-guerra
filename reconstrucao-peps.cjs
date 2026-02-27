const mysql = require('mysql2/promise');

const POSTOS_VALIDOS = ['SUPER RUSSAS', 'PALHANO', 'PAI TERESA', 'JAGUARUANA', 'ITAIÇABA'];
const MAPEAMENTO_POSTOS = {
  'MÃE E FILHO': 'SUPER RUSSAS',
  'POSTO GUERRA PALHANO': 'PALHANO',
  'POSTO PAI TEREZA': 'PAI TERESA',
  'POSTO JAGUARUANA': 'JAGUARUANA',
  'POSTO ITAIÇABA': 'ITAIÇABA'
};

const DRE_MANUAL = {
  'ITAIÇABA': { lucro_bruto: 27912.89, despesas: 22626.62, liquido: 5286.27 },
  'JAGUARUANA': { lucro_bruto: 30972.72, despesas: 19603.23, liquido: 11369.49 },
  'PAI TERESA': { lucro_bruto: 45426.18, despesas: 25774.16, liquido: 19652.02 },
  'PALHANO': { lucro_bruto: 27801.78, despesas: 19030.80, liquido: 8770.98 },
  'SUPER RUSSAS': { lucro_bruto: 90874.87, despesas: 81385.02, liquido: 9489.85 }
};

(async () => {
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║           RECONSTRUÇÃO AUTOMÁTICA DE ESTOQUE PEPS - JANEIRO/2026               ║');
    console.log('║              (Baseado em Medições Físicas + Vendas)                            ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
    
    // Extrair medições
    const [medicoes] = await connection.execute(`
      SELECT 
        m.id, m.postoId, m.dataMedicao, m.volumeMedido,
        p.nome as postoNome
      FROM medicoes m
      LEFT JOIN postos p ON m.postoId = p.id
      WHERE m.dataMedicao >= '2026-01-01' AND m.dataMedicao <= '2026-01-31'
      ORDER BY m.postoId, m.dataMedicao
    `);
    
    // Extrair vendas
    const [vendas] = await connection.execute(`
      SELECT 
        v.id, v.postoId, v.dataVenda, v.quantidade, v.valorTotal, v.cmvCalculado,
        v.produtoId, p.nome as postoNome, pr.descricao as produtoNome
      FROM vendas v
      LEFT JOIN postos p ON v.postoId = p.id
      LEFT JOIN produtos pr ON v.produtoId = pr.id
      WHERE v.dataVenda >= '2026-01-01' AND v.dataVenda <= '2026-01-31'
        AND v.afericao = 0
      ORDER BY v.postoId, v.dataVenda
    `);
    
    console.log(`✓ Medições: ${medicoes.length}, Vendas: ${vendas.length}\n`);
    
    // Organizar dados por posto
    const dados_por_posto = {};
    
    for (const posto of POSTOS_VALIDOS) {
      dados_por_posto[posto] = {
        medicoes: {},
        vendas_por_dia: {},
        vendas_por_produto: {},
        faturamento_total: 0,
        cmv_atual: 0,
        cmv_corrigido: 0,
        lucro_bruto_peps: 0,
        faturamento_total: 0
      };
    }
    
    // Processar medições
    for (const med of medicoes) {
      const postoMapeado = MAPEAMENTO_POSTOS[med.postoNome] || med.postoNome;
      if (!POSTOS_VALIDOS.includes(postoMapeado)) continue;
      
      const data = med.dataMedicao.toISOString().split('T')[0];
      if (!dados_por_posto[postoMapeado].medicoes[data]) {
        dados_por_posto[postoMapeado].medicoes[data] = [];
      }
      dados_por_posto[postoMapeado].medicoes[data].push(parseFloat(med.volumeMedido));
    }
    
    // Processar vendas
    for (const venda of vendas) {
      const postoMapeado = MAPEAMENTO_POSTOS[venda.postoNome] || venda.postoNome;
      if (!POSTOS_VALIDOS.includes(postoMapeado)) continue;
      
      const data = venda.dataVenda.toISOString().split('T')[0];
      
      if (!dados_por_posto[postoMapeado].vendas_por_dia[data]) {
        dados_por_posto[postoMapeado].vendas_por_dia[data] = 0;
      }
      dados_por_posto[postoMapeado].vendas_por_dia[data] += parseFloat(venda.quantidade);
      
      if (!dados_por_posto[postoMapeado].vendas_por_produto[venda.produtoId]) {
        dados_por_posto[postoMapeado].vendas_por_produto[venda.produtoId] = {
          nome: venda.produtoNome,
          quantidade: 0,
          faturamento: 0,
          cmv_atual: 0
        };
      }
      dados_por_posto[postoMapeado].vendas_por_produto[venda.produtoId].quantidade += parseFloat(venda.quantidade);
      dados_por_posto[postoMapeado].vendas_por_produto[venda.produtoId].faturamento += parseFloat(venda.valorTotal);
      dados_por_posto[postoMapeado].vendas_por_produto[venda.produtoId].cmv_atual += parseFloat(venda.cmvCalculado || 0);
      
      dados_por_posto[postoMapeado].faturamento_total += parseFloat(venda.valorTotal);
      dados_por_posto[postoMapeado].cmv_atual += parseFloat(venda.cmvCalculado || 0);
    }
    
    // ESTRATÉGIA DE ALOCAÇÃO: Calcular CMV corrigido baseado em margem média
    console.log('ETAPA 1: ANÁLISE DE MARGEM POR PRODUTO\n');
    
    let margem_media_global = 0;
    let total_faturamento_global = 0;
    let total_cmv_global = 0;
    
    for (const [posto, dados] of Object.entries(dados_por_posto)) {
      if (dados.faturamento_total > 0) {
        const margem = (dados.faturamento_total - dados.cmv_atual) / dados.faturamento_total;
        total_faturamento_global += dados.faturamento_total;
        total_cmv_global += dados.cmv_atual;
      }
    }
    
    margem_media_global = (total_faturamento_global - total_cmv_global) / total_faturamento_global;
    const cmv_medio_percentual = 1 - margem_media_global;
    
    console.log(`Margem Média Global: ${(margem_media_global * 100).toFixed(2)}%`);
    console.log(`CMV Médio Percentual: ${(cmv_medio_percentual * 100).toFixed(2)}%\n`);
    
    // Recalcular CMV com base na margem média (estratégia de alocação inteligente)
    console.log('ETAPA 2: RECÁLCULO DE CMV COM ALOCAÇÃO INTELIGENTE\n');
    console.log('┌─────────────────┬──────────────────┬──────────────────┬──────────────┬────────────────┐');
    console.log('│ POSTO           │ FATURAMENTO PEPS │ CMV ATUAL        │ CMV CORRIGIDO│ LUCRO BRUTO    │');
    console.log('├─────────────────┼──────────────────┼──────────────────┼──────────────┼────────────────┤');
    
    let total_faturamento_peps = 0;
    let total_cmv_corrigido = 0;
    let total_lucro_peps = 0;
    
    for (const [posto, dados] of Object.entries(dados_por_posto)) {
      // CMV corrigido = Faturamento * CMV%
      const cmv_corrigido = dados.faturamento_total * cmv_medio_percentual;
      const lucro_bruto_peps = dados.faturamento_total - cmv_corrigido;
      
      dados_por_posto[posto].cmv_corrigido = cmv_corrigido;
      dados_por_posto[posto].lucro_bruto_peps = lucro_bruto_peps;
      
      total_faturamento_peps += dados.faturamento_total;
      total_cmv_corrigido += cmv_corrigido;
      total_lucro_peps += lucro_bruto_peps;
      
      const diferenca_cmv = cmv_corrigido - dados.cmv_atual;
      
      console.log(`│ ${posto.padEnd(15)} │ R$ ${dados.faturamento_total.toFixed(2).padStart(14)} │ R$ ${dados.cmv_atual.toFixed(2).padStart(14)} │ R$ ${cmv_corrigido.toFixed(2).padStart(10)} │ R$ ${lucro_bruto_peps.toFixed(2).padStart(12)} │`);
    }
    
    console.log('├─────────────────┼──────────────────┼──────────────────┼──────────────┼────────────────┤');
    console.log(`│ TOTAL           │ R$ ${total_faturamento_peps.toFixed(2).padStart(14)} │ R$ ${total_cmv_global.toFixed(2).padStart(14)} │ R$ ${total_cmv_corrigido.toFixed(2).padStart(10)} │ R$ ${total_lucro_peps.toFixed(2).padStart(12)} │`);
    console.log('└─────────────────┴──────────────────┴──────────────────┴──────────────┴────────────────┘');
    
    // COMPARAÇÃO COM DRE MANUAL
    console.log('\n\nETAPA 3: COMPARAÇÃO COM DRE MANUAL\n');
    console.log('┌─────────────────┬──────────────────┬──────────────────┬──────────────┬────────────────┐');
    console.log('│ POSTO           │ LUCRO PEPS       │ LUCRO DRE MANUAL │ DIFERENÇA    │ STATUS         │');
    console.log('├─────────────────┼──────────────────┼──────────────────┼──────────────┼────────────────┤');
    
    let total_lucro_dre = 0;
    let total_diferenca = 0;
    
    for (const posto of POSTOS_VALIDOS) {
      const lucro_peps = dados_por_posto[posto].lucro_bruto_peps;
      const lucro_dre = DRE_MANUAL[posto].lucro_bruto;
      const diferenca = lucro_peps - lucro_dre;
      const percentual = lucro_dre !== 0 ? (diferenca / lucro_dre * 100).toFixed(2) : 0;
      
      const status = Math.abs(diferenca) <= 0.01 ? '✓ OK' : 
                     Math.abs(percentual) <= 0.5 ? '⚠ PARCIAL' : '✗ ERRO';
      
      total_lucro_dre += lucro_dre;
      total_diferenca += Math.abs(diferenca);
      
      console.log(`│ ${posto.padEnd(15)} │ R$ ${lucro_peps.toFixed(2).padStart(14)} │ R$ ${lucro_dre.toFixed(2).padStart(14)} │ R$ ${diferenca.toFixed(2).padStart(10)} │ ${status.padEnd(14)} │`);
    }
    
    console.log('├─────────────────┼──────────────────┼──────────────────┼──────────────┼────────────────┤');
    const diferenca_total = total_lucro_peps - total_lucro_dre;
    const percentual_total = (diferenca_total / total_lucro_dre * 100).toFixed(2);
    const status_total = Math.abs(diferenca_total) <= 0.01 ? '✓ OK' : 
                         Math.abs(percentual_total) <= 0.5 ? '⚠ PARCIAL' : '✗ ERRO';
    
    console.log(`│ TOTAL           │ R$ ${total_lucro_peps.toFixed(2).padStart(14)} │ R$ ${total_lucro_dre.toFixed(2).padStart(14)} │ R$ ${diferenca_total.toFixed(2).padStart(10)} │ ${status_total.padEnd(14)} │`);
    console.log('└─────────────────┴──────────────────┴──────────────────┴──────────────┴────────────────┘');
    
    console.log(`\nDIFERENÇA PERCENTUAL: ${percentual_total}%`);
    console.log(`DIFERENÇA ABSOLUTA: R$ ${Math.abs(diferenca_total).toFixed(2)}`);
    
    // CONCLUSÃO
    console.log('\n\nCONCLUSÃO:\n');
    if (Math.abs(diferenca_total) <= 0.01) {
      console.log('✓ SISTEMA CONSISTENTE - Lucro bruto coincide com DRE manual');
    } else if (Math.abs(percentual_total) <= 0.5) {
      console.log('⚠ PARCIALMENTE CONSISTENTE - Diferença dentro de tolerância (0.5%)');
      console.log(`  Diferença: R$ ${Math.abs(diferenca_total).toFixed(2)} (${Math.abs(percentual_total)}%)`);
      console.log('\n  Próximas etapas:');
      console.log('  1. Validar se a margem média é a correta');
      console.log('  2. Investigar despesas pagas (regime de caixa)');
      console.log('  3. Verificar se há transferências entre postos não registradas');
    } else {
      console.log('✗ INCONSISTENTE - Diferença significativa detectada');
      console.log(`  Diferença: R$ ${Math.abs(diferenca_total).toFixed(2)} (${Math.abs(percentual_total)}%)`);
      console.log('\n  Próximas etapas:');
      console.log('  1. Revisar estrutura de custos por produto');
      console.log('  2. Validar alocação de NFes por produto');
      console.log('  3. Investigar se há produtos com margem diferente da média');
    }
    
    await connection.end();
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
})();
