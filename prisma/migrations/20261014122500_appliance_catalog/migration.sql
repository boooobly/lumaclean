-- Explicitly authorized prospective catalogue update. No Order, OrderExtra,
-- LeadExtra, Quote or finance snapshots are modified.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ServiceExtra" WHERE
    (code='fridge' AND "unitPrice" NOT IN (900,1000)) OR
    (code='oven' AND "unitPrice" NOT IN (1100,1000)) OR
    (code IN ('microwave','hood','dishwasher','washingMachine') AND ("unitPrice"<>1000 OR NOT active))) THEN
    RAISE EXCEPTION 'APPLIANCE_CATALOG_OWNER_CONFLICT';
  END IF;
END $$;

UPDATE "ServiceExtra" SET "unitPrice"=1000,"updatedAt"=CURRENT_TIMESTAMP
WHERE code IN ('fridge','oven');

INSERT INTO "ServiceExtra" (id,code,name,unit,"unitPrice",active,"createdAt","updatedAt") VALUES
 ('catalog-microwave','microwave','Микроволновка внутри','item',1000,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
 ('catalog-hood','hood','Вытяжка внутри','item',1000,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
 ('catalog-dishwasher','dishwasher','Посудомоечная машина внутри','item',1000,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
 ('catalog-washing-machine','washingMachine','Стиральная машина внутри','item',1000,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;
COMMIT;
