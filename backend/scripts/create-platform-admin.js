/**
 * Crea o actualiza el usuario platform_admin de MiRestaurante.
 * Uso:
 *   PLATFORM_ADMIN_EMAIL=ops@mirestaurante.com PLATFORM_ADMIN_PASSWORD='Secreta123!' node scripts/create-platform-admin.js
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = process.env.DATABASE_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DATABASE_NAME || 'mirestaurante';
const email = (process.env.PLATFORM_ADMIN_EMAIL || 'platform@mirestaurante.com').toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD || 'Platform123!';
const username = process.env.PLATFORM_ADMIN_USERNAME || 'platform';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');

  const hashed = await bcrypt.hash(password, 10);
  const existing = await users.findOne({
    $or: [{ email }, { username }, { role: 'platform_admin' }],
  });

  const doc = {
    name: 'MiRestaurante',
    lastName: 'Platform',
    email,
    username,
    password: hashed,
    cellphone: '0000000000',
    role: 'platform_admin',
    tenantId: null,
    updatedAt: new Date(),
  };

  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      { $set: doc }
    );
    console.log(`Platform admin actualizado: ${username} / ${email}`);
  } else {
    await users.insertOne({ ...doc, createdAt: new Date() });
    console.log(`Platform admin creado: ${username} / ${email}`);
  }

  console.log(`Password: ${password}`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
