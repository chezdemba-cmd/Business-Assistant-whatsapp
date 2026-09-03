UPDATE "organizations"
SET "name" = 'FEREDRON DEMO COMMERCE',
    "slug" = 'feredron-demo-commerce'
WHERE "slug" = 'djeli-demo-commerce'
  AND "isDemo" = true;

UPDATE "whatsapp_connections"
SET "verifiedName" = 'FEREDRON DEMO COMMERCE'
WHERE "verifiedName" = 'DJELI DEMO COMMERCE';
