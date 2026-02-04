import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

// Gerar SQL diretamente usando drizzle-kit
const sql = `
-- Adicionar novas colunas na tabela lotes
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS codigoAcs VARCHAR(50) UNIQUE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS postoId INT NOT NULL DEFAULT 0;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS produtoId INT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fornecedorId INT;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS serieNf VARCHAR(10);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS chaveNfe VARCHAR(60);
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS dataEmissao DATE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS dataLmc DATE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS custoTotal DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS origem ENUM('acs', 'manual') DEFAULT 'manual' NOT NULL;

-- Adicionar novas colunas na tabela tanques
ALTER TABLE tanques ADD COLUMN IF NOT EXISTS saldoAtual DECIMAL(12,3) DEFAULT 0 NOT NULL;

-- Adicionar novas colunas na tabela medicoes
ALTER TABLE medicoes ADD COLUMN IF NOT EXISTS codigoAcs VARCHAR(64) UNIQUE;
ALTER TABLE medicoes ADD COLUMN IF NOT EXISTS postoId INT NOT NULL DEFAULT 0;
ALTER TABLE medicoes ADD COLUMN IF NOT EXISTS origem ENUM('acs', 'manual') DEFAULT 'manual' NOT NULL;
ALTER TABLE medicoes ADD COLUMN IF NOT EXISTS deletedAt TIMESTAMP;
ALTER TABLE medicoes ADD COLUMN IF NOT EXISTS updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL;

-- Modificar coluna estoqueEscritural para ter default
ALTER TABLE medicoes MODIFY COLUMN estoqueEscritural DECIMAL(12,3) DEFAULT 0;
ALTER TABLE medicoes MODIFY COLUMN diferenca DECIMAL(12,3) DEFAULT 0;
ALTER TABLE medicoes MODIFY COLUMN percentualDiferenca DECIMAL(8,4) DEFAULT 0;
ALTER TABLE medicoes MODIFY COLUMN tipoDiferenca ENUM('sobra', 'perda', 'ok') DEFAULT 'ok';

-- Criar tabela de fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigoAcs VARCHAR(20) UNIQUE,
  nome VARCHAR(200) NOT NULL,
  cnpj VARCHAR(20),
  ativo INT DEFAULT 1 NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Criar tabela de histórico de alterações
CREATE TABLE IF NOT EXISTS historicoAlteracoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tabela VARCHAR(50) NOT NULL,
  registroId INT NOT NULL,
  acao ENUM('insert', 'update', 'delete') NOT NULL,
  camposAlterados TEXT,
  valoresAntigos TEXT,
  valoresNovos TEXT,
  usuarioId INT,
  usuarioNome VARCHAR(200),
  justificativa TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Adicionar tipo medicao_faltante aos alertas
ALTER TABLE alertas MODIFY COLUMN tipo ENUM('estoque_baixo', 'diferenca_medicao', 'cmv_pendente', 'sincronizacao', 'medicao_faltante') NOT NULL;
`;

console.log('SQL a ser executado:');
console.log(sql);
console.log('\nExecute este SQL manualmente no banco de dados.');
