CREATE TABLE `alertas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('estoque_baixo','diferenca_medicao','cmv_pendente','sincronizacao') NOT NULL,
	`postoId` int,
	`tanqueId` int,
	`titulo` varchar(200) NOT NULL,
	`mensagem` text NOT NULL,
	`dados` text,
	`status` enum('pendente','visualizado','resolvido') NOT NULL DEFAULT 'pendente',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `alertas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `configuracoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chave` varchar(100) NOT NULL,
	`valor` text,
	`tipo` varchar(20) NOT NULL DEFAULT 'text',
	`descricao` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracoes_id` PRIMARY KEY(`id`),
	CONSTRAINT `configuracoes_chave_unique` UNIQUE(`chave`)
);
--> statement-breakpoint
CREATE TABLE `consumoLotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendaId` int NOT NULL,
	`loteId` int NOT NULL,
	`quantidadeConsumida` decimal(12,3) NOT NULL,
	`custoUnitario` decimal(12,4) NOT NULL,
	`custoTotal` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consumoLotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tanqueId` int NOT NULL,
	`numeroNf` varchar(50),
	`fornecedor` varchar(200),
	`dataEntrada` date NOT NULL,
	`quantidadeOriginal` decimal(12,3) NOT NULL,
	`quantidadeDisponivel` decimal(12,3) NOT NULL,
	`custoUnitario` decimal(12,4) NOT NULL,
	`ordemConsumo` int NOT NULL DEFAULT 0,
	`status` enum('ativo','consumido','cancelado') NOT NULL DEFAULT 'ativo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medicoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tanqueId` int NOT NULL,
	`dataMedicao` date NOT NULL,
	`horaMedicao` varchar(10),
	`volumeMedido` decimal(12,3) NOT NULL,
	`temperatura` decimal(5,2),
	`estoqueEscritural` decimal(12,3) NOT NULL,
	`diferenca` decimal(12,3) NOT NULL,
	`percentualDiferenca` decimal(8,4) NOT NULL,
	`tipoDiferenca` enum('sobra','perda','ok') NOT NULL,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `medicoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `postos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoAcs` varchar(10) NOT NULL,
	`nome` varchar(200) NOT NULL,
	`cnpj` varchar(20),
	`endereco` text,
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `postos_id` PRIMARY KEY(`id`),
	CONSTRAINT `postos_codigoAcs_unique` UNIQUE(`codigoAcs`)
);
--> statement-breakpoint
CREATE TABLE `produtos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoAcs` varchar(20) NOT NULL,
	`descricao` varchar(200) NOT NULL,
	`tipo` varchar(10) NOT NULL DEFAULT 'C',
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `produtos_id` PRIMARY KEY(`id`),
	CONSTRAINT `produtos_codigoAcs_unique` UNIQUE(`codigoAcs`)
);
--> statement-breakpoint
CREATE TABLE `syncLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` varchar(50) NOT NULL,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp,
	`registrosProcessados` int DEFAULT 0,
	`registrosInseridos` int DEFAULT 0,
	`registrosIgnorados` int DEFAULT 0,
	`erros` int DEFAULT 0,
	`status` enum('executando','sucesso','erro') NOT NULL DEFAULT 'executando',
	`mensagem` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `syncLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tanques` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postoId` int NOT NULL,
	`codigoAcs` varchar(10) NOT NULL,
	`produtoId` int NOT NULL,
	`capacidade` decimal(12,3) NOT NULL DEFAULT '0',
	`estoqueMinimo` decimal(12,3) NOT NULL DEFAULT '1000',
	`ativo` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tanques_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uuidAcs` varchar(64),
	`tanqueId` int NOT NULL,
	`dataVenda` date NOT NULL,
	`quantidade` decimal(12,3) NOT NULL,
	`valorUnitario` decimal(12,4) NOT NULL,
	`valorTotal` decimal(14,2) NOT NULL,
	`cmvCalculado` decimal(14,2) DEFAULT '0',
	`cmvUnitario` decimal(12,4) DEFAULT '0',
	`statusCmv` enum('pendente','calculado','erro') NOT NULL DEFAULT 'pendente',
	`origem` varchar(20) NOT NULL DEFAULT 'acs',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendas_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendas_uuidAcs_unique` UNIQUE(`uuidAcs`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','operator','viewer') NOT NULL DEFAULT 'user';