-- Prospective per-appliance units. Historical financial amounts remain untouched.
BEGIN;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM "ServiceExtra" WHERE code IN ('fridge','oven') AND (unit NOT IN ('service','item') OR "unitPrice"<>1000)) THEN
  RAISE EXCEPTION 'APPLIANCE_UNIT_OWNER_CONFLICT';
 END IF;
END $$;
UPDATE "ServiceExtra" SET unit='item',"updatedAt"=CURRENT_TIMESTAMP WHERE code IN ('fridge','oven');
COMMIT;
