-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_active_deletedAt_idx`(`active`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Farm` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lot` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `surfaceArea` DECIMAL(12, 4) NOT NULL,
    `surfaceUnit` ENUM('HECTARE', 'SQUARE_METER', 'ACRE') NOT NULL DEFAULT 'HECTARE',
    `location` VARCHAR(191) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `centroid` JSON NULL,
    `geoJson` JSON NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Lot_code_key`(`code`),
    INDEX `Lot_farmId_status_deletedAt_idx`(`farmId`, `status`, `deletedAt`),
    INDEX `Lot_latitude_longitude_idx`(`latitude`, `longitude`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Parcel` (
    `id` VARCHAR(191) NOT NULL,
    `lotId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `surfaceArea` DECIMAL(12, 4) NOT NULL,
    `surfaceUnit` ENUM('HECTARE', 'SQUARE_METER', 'ACRE') NOT NULL DEFAULT 'HECTARE',
    `centroid` JSON NULL,
    `geoJson` JSON NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Parcel_code_key`(`code`),
    INDEX `Parcel_lotId_status_deletedAt_idx`(`lotId`, `status`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Crop` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `variety` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `description` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Crop_status_deletedAt_idx`(`status`, `deletedAt`),
    UNIQUE INDEX `Crop_name_variety_key`(`name`, `variety`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CropAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `parcelId` VARCHAR(191) NOT NULL,
    `cropId` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `surfaceArea` DECIMAL(12, 4) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CropAssignment_parcelId_startsAt_endsAt_idx`(`parcelId`, `startsAt`, `endsAt`),
    INDEX `CropAssignment_cropId_startsAt_idx`(`cropId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `currentRate` DECIMAL(12, 2) NOT NULL,
    `paymentType` ENUM('HOUR', 'DAY', 'WAGE', 'WEEK', 'MONTH', 'OTHER') NOT NULL,
    `paymentUnit` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `hiredAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Employee_status_deletedAt_idx`(`status`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Unit` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `dimension` VARCHAR(191) NOT NULL,
    `baseUnit` BOOLEAN NOT NULL DEFAULT false,
    `multiplier` DECIMAL(16, 6) NOT NULL DEFAULT 1,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Unit_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationMethod` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ApplicationMethod_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkType` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `WorkType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('FERTILIZER', 'FUNGICIDE', 'INSECTICIDE', 'HERBICIDE', 'ADJUVANT', 'OTHER') NOT NULL,
    `baseUnitCode` VARCHAR(191) NOT NULL,
    `currentPrice` DECIMAL(12, 4) NULL,
    `supplier` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Product_code_key`(`code`),
    INDEX `Product_category_active_deletedAt_idx`(`category`, `active`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductPriceHistory` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 4) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductPriceHistory_productId_startsAt_endsAt_idx`(`productId`, `startsAt`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgriculturalActivity` (
    `id` VARCHAR(191) NOT NULL,
    `category` ENUM('PRACTICE', 'IRRIGATION', 'FERTILIZATION', 'FUMIGATION', 'HERBICIDE', 'OTHER') NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `lotId` VARCHAR(191) NOT NULL,
    `parcelId` VARCHAR(191) NULL,
    `cropId` VARCHAR(191) NULL,
    `cropAssignmentId` VARCHAR(191) NULL,
    `workTypeId` VARCHAR(191) NULL,
    `methodId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'PAID', 'PENDING_PAYMENT', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    `laborCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `productCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `applicationCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `irrigationCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `otherCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgriculturalActivity_occurredAt_category_status_idx`(`occurredAt`, `category`, `status`),
    INDEX `AgriculturalActivity_lotId_occurredAt_idx`(`lotId`, `occurredAt`),
    INDEX `AgriculturalActivity_parcelId_occurredAt_idx`(`parcelId`, `occurredAt`),
    INDEX `AgriculturalActivity_cropId_occurredAt_idx`(`cropId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LaborEntry` (
    `id` VARCHAR(191) NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `paymentType` ENUM('HOUR', 'DAY', 'WAGE', 'WEEK', 'MONTH', 'OTHER') NOT NULL,
    `rateSnapshot` DECIMAL(12, 2) NOT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL DEFAULT 1,
    `allocationPct` DECIMAL(5, 2) NULL,
    `individualCost` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LaborEntry_activityId_idx`(`activityId`),
    INDEX `LaborEntry_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductApplication` (
    `id` VARCHAR(191) NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(14, 4) NOT NULL,
    `unitCode` VARCHAR(191) NOT NULL,
    `unitPrice` DECIMAL(12, 4) NOT NULL,
    `productCost` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductApplication_activityId_idx`(`activityId`),
    INDEX `ProductApplication_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IrrigationDetail` (
    `id` VARCHAR(191) NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `durationHours` DECIMAL(10, 2) NOT NULL,
    `ratePerHour` DECIMAL(12, 4) NULL,
    `rateCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `waterCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `valveCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `operatorCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `otherCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `IrrigationDetail_activityId_key`(`activityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeatherCache` (
    `id` VARCHAR(191) NOT NULL,
    `latitude` DECIMAL(10, 7) NOT NULL,
    `longitude` DECIMAL(10, 7) NOT NULL,
    `queryType` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WeatherCache_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `WeatherCache_latitude_longitude_queryType_key`(`latitude`, `longitude`, `queryType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Lot` ADD CONSTRAINT `Lot_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `Farm`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Parcel` ADD CONSTRAINT `Parcel_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CropAssignment` ADD CONSTRAINT `CropAssignment_parcelId_fkey` FOREIGN KEY (`parcelId`) REFERENCES `Parcel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CropAssignment` ADD CONSTRAINT `CropAssignment_cropId_fkey` FOREIGN KEY (`cropId`) REFERENCES `Crop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductPriceHistory` ADD CONSTRAINT `ProductPriceHistory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgriculturalActivity` ADD CONSTRAINT `AgriculturalActivity_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgriculturalActivity` ADD CONSTRAINT `AgriculturalActivity_parcelId_fkey` FOREIGN KEY (`parcelId`) REFERENCES `Parcel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgriculturalActivity` ADD CONSTRAINT `AgriculturalActivity_cropId_fkey` FOREIGN KEY (`cropId`) REFERENCES `Crop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgriculturalActivity` ADD CONSTRAINT `AgriculturalActivity_cropAssignmentId_fkey` FOREIGN KEY (`cropAssignmentId`) REFERENCES `CropAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgriculturalActivity` ADD CONSTRAINT `AgriculturalActivity_workTypeId_fkey` FOREIGN KEY (`workTypeId`) REFERENCES `WorkType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgriculturalActivity` ADD CONSTRAINT `AgriculturalActivity_methodId_fkey` FOREIGN KEY (`methodId`) REFERENCES `ApplicationMethod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaborEntry` ADD CONSTRAINT `LaborEntry_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `AgriculturalActivity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaborEntry` ADD CONSTRAINT `LaborEntry_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductApplication` ADD CONSTRAINT `ProductApplication_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `AgriculturalActivity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductApplication` ADD CONSTRAINT `ProductApplication_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IrrigationDetail` ADD CONSTRAINT `IrrigationDetail_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `AgriculturalActivity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
