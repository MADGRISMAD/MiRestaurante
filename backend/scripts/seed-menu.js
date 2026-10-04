/**
 * Seed demo menu: 5 categorías × 3 platillos con imágenes.
 * Uso: node scripts/seed-menu.js
 * Opcional: TENANT_ID=<id> para forzar tenant.
 */
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { createTenantDoc } = require('../models/tenant.model');

const uri = process.env.DATABASE_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DATABASE_NAME || 'mirestaurante';

/** Imágenes Unsplash (comida) — URLs estables con w=800 */
const img = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

const CATALOG = [
  {
    name: 'Entradas',
    description: 'Para empezar',
    foods: [
      {
        name: 'Guacamole con totopos',
        price: 95,
        description: 'Aguacate, cilantro, limón y chips de maíz',
        imgUrl: img('photo-1615873968403-89e068629265'),
      },
      {
        name: 'Queso fundido',
        price: 110,
        description: 'Queso Oaxaca derretido con chorizo',
        imgUrl: img('photo-1628088062854-d1870b4553da'),
      },
      {
        name: 'Sopa de tortilla',
        price: 85,
        description: 'Caldo de jitomate, tiras de tortilla y aguacate',
        imgUrl: img('photo-1547592166-23ac45744acd'),
      },
    ],
  },
  {
    name: 'Tacos',
    description: 'De la plancha',
    foods: [
      {
        name: 'Tacos al pastor',
        price: 75,
        description: '3 pzas. con piña y cilantro',
        imgUrl: img('photo-1565299585323-38d6b0865b47'),
      },
      {
        name: 'Tacos de carnitas',
        price: 80,
        description: '3 pzas. cerdo confitado',
        imgUrl: img('photo-1551504734-5ee1c36a3990'),
      },
      {
        name: 'Tacos de camarón',
        price: 120,
        description: '3 pzas. camarón empanizado y salsa chipotle',
        imgUrl: img('photo-1512838243191-e81e8d866b1e'),
      },
    ],
  },
  {
    name: 'Platos fuertes',
    description: 'Especialidades de la casa',
    foods: [
      {
        name: 'Enchiladas verdes',
        price: 145,
        description: 'Pollo, crema y queso fresco',
        imgUrl: img('photo-1534352956036-cd81e027ced9'),
      },
      {
        name: 'Mole poblano',
        price: 175,
        description: 'Pollo bañado en mole tradicional',
        imgUrl: img('photo-1599974579688-8dbdd335c77f'),
      },
      {
        name: 'Arrachera a la parrilla',
        price: 220,
        description: 'Con guacamole y frijoles charros',
        imgUrl: img('photo-1544025162-d76694265947'),
      },
    ],
  },
  {
    name: 'Bebidas',
    description: 'Refrescantes y de la casa',
    foods: [
      {
        name: 'Agua de horchata',
        price: 45,
        description: 'Vaso 500 ml',
        imgUrl: img('photo-1623065422902-30a2d94aea75'),
      },
      {
        name: 'Michelada clásica',
        price: 85,
        description: 'Cerveza, limón, salsa y chile',
        imgUrl: img('photo-1514362545857-3bc16c4c7d1b'),
      },
      {
        name: 'Café de olla',
        price: 40,
        description: 'Canela y piloncillo',
        imgUrl: img('photo-1495474472287-4d71bcdd2085'),
      },
    ],
  },
  {
    name: 'Postres',
    description: 'Dulce final',
    foods: [
      {
        name: 'Flan napolitano',
        price: 65,
        description: 'Caramelo casero',
        imgUrl: img('photo-1488477181946-6428a0291777'),
      },
      {
        name: 'Churros con chocolate',
        price: 70,
        description: 'Porción de 4 con salsa de chocolate',
        imgUrl: img('photo-1482049016688-2d3e1b311543'),
      },
      {
        name: 'Pastel de tres leches',
        price: 75,
        description: 'Rebanada individual',
        imgUrl: img('photo-1578985545062-69928b1d9587'),
      },
    ],
  },
];

async function resolveTenantId(db) {
  if (process.env.TENANT_ID && ObjectId.isValid(process.env.TENANT_ID)) {
    return String(process.env.TENANT_ID);
  }

  const tenants = db.collection('tenants');
  let tenant =
    (await tenants.findOne({ slug: 'default' })) ||
    (await tenants.findOne({})) ||
    null;

  if (!tenant) {
    const insert = await tenants.insertOne({
      ...createTenantDoc('MiRestaurante Demo'),
      slug: 'default',
    });
    tenant = await tenants.findOne({ _id: insert.insertedId });
    console.log('Tenant demo creado');
  }

  return String(tenant._id);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const tenantId = await resolveTenantId(db);

  const menusCol = db.collection('menus');
  const foodsCol = db.collection('foods');

  // Idempotente: quita catálogo demo previo marcado
  await foodsCol.deleteMany({ tenantId, seedTag: 'demo-menu-v1' });
  await menusCol.deleteMany({ tenantId, seedTag: 'demo-menu-v1' });

  let foodCount = 0;
  for (const cat of CATALOG) {
    const menuRes = await menusCol.insertOne({
      name: cat.name,
      description: cat.description,
      tenantId,
      seedTag: 'demo-menu-v1',
      createdAt: new Date(),
    });
    const menuId = String(menuRes.insertedId);

    for (const food of cat.foods) {
      await foodsCol.insertOne({
        name: food.name,
        price: food.price,
        description: food.description,
        imgUrl: food.imgUrl,
        menuId,
        tenantId,
        seedTag: 'demo-menu-v1',
        createdAt: new Date(),
      });
      foodCount += 1;
    }
  }

  console.log(
    `Seed OK: ${CATALOG.length} categorías, ${foodCount} platillos (tenant listo)`
  );
  await client.close();
}

main().catch((err) => {
  console.error('Seed falló:', err.message);
  process.exit(1);
});
