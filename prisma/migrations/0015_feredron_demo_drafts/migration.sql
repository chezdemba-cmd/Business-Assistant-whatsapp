UPDATE "marketing_campaigns"
SET "message" = replace("message", 'DJELI DEMO COMMERCE', 'FEREDRON DEMO COMMERCE')
WHERE "status" = 'DRAFT'
  AND "organizationId" IN (
    SELECT "id" FROM "organizations" WHERE "slug" = 'feredron-demo-commerce'
  );
