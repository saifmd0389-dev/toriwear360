-- Distinguish forward and reverse logistics records without overwriting the original AWB.
ALTER TABLE `shipments` ADD COLUMN `shipmentType` VARCHAR(20) NOT NULL DEFAULT 'FORWARD';
CREATE INDEX `shipments_orderId_shipmentType_idx` ON `shipments` (`orderId`, `shipmentType`);
