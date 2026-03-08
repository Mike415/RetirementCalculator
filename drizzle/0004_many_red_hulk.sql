CREATE TABLE `pageViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int,
	`path` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pageViews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripeEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`eventType` varchar(64) NOT NULL,
	`tier` enum('free','basic','pro'),
	`amountCents` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripeEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `betaOverride` boolean DEFAULT null;