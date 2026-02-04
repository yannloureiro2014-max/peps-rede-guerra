ALTER TABLE `vendas` DROP INDEX `vendas_uuidAcs_unique`;--> statement-breakpoint
ALTER TABLE `tanques` MODIFY COLUMN `produtoId` int;--> statement-breakpoint
ALTER TABLE `vendas` MODIFY COLUMN `tanqueId` int;--> statement-breakpoint
ALTER TABLE `vendas` ADD `codigoAcs` varchar(64);--> statement-breakpoint
ALTER TABLE `vendas` ADD `postoId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `vendas` ADD `produtoId` int;--> statement-breakpoint
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_codigoAcs_unique` UNIQUE(`codigoAcs`);--> statement-breakpoint
ALTER TABLE `vendas` DROP COLUMN `uuidAcs`;