CREATE TABLE `cached_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(128) NOT NULL,
	`cacheKey` varchar(512) NOT NULL,
	`data` json NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cached_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_finance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityId` int,
	`donorName` varchar(512),
	`recipientName` varchar(512),
	`amount` bigint,
	`date` varchar(32),
	`cycle` varchar(16),
	`source` varchar(128),
	`data` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_finance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `domain_intel` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityId` int,
	`domain` varchar(512) NOT NULL,
	`registrar` varchar(256),
	`registrantOrg` varchar(512),
	`registrantEmail` varchar(320),
	`createdDate` varchar(32),
	`expiresDate` varchar(32),
	`nameservers` json,
	`ipAddresses` json,
	`technologies` json,
	`certificates` json,
	`data` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `domain_intel_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`entityType` enum('company','person','domain','organization','fund') NOT NULL,
	`description` text,
	`jurisdiction` varchar(128),
	`incorporationDate` varchar(32),
	`status` varchar(64),
	`website` varchar(512),
	`ticker` varchar(32),
	`cik` varchar(32),
	`ein` varchar(32),
	`address` text,
	`profileData` json,
	`llmSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`targetId` int NOT NULL,
	`relationshipType` varchar(128) NOT NULL,
	`description` text,
	`startDate` varchar(32),
	`endDate` varchar(32),
	`confidence` int DEFAULT 100,
	`source` varchar(256),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `relationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`searchId` int NOT NULL,
	`source` varchar(128) NOT NULL,
	`status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`resultCount` int DEFAULT 0,
	`message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `searches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`query` varchar(512) NOT NULL,
	`searchType` enum('deep_research','build_profile','investigate_domain','monitor') NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`resultSummary` text,
	`entityId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `searches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sec_filings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityId` int NOT NULL,
	`cik` varchar(32) NOT NULL,
	`formType` varchar(32) NOT NULL,
	`filingDate` varchar(32) NOT NULL,
	`reportDate` varchar(32),
	`accessionNumber` varchar(64),
	`description` text,
	`url` varchar(1024),
	`data` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sec_filings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityId` int NOT NULL,
	`entityName` varchar(512) NOT NULL,
	`notifyOnFilings` boolean NOT NULL DEFAULT true,
	`notifyOnOwnership` boolean NOT NULL DEFAULT true,
	`notifyOnConnections` boolean NOT NULL DEFAULT true,
	`notifyOnNews` boolean NOT NULL DEFAULT false,
	`lastChecked` timestamp,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
