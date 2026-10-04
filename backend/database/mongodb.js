require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { createTenantDoc } = require('../models/tenant.model');

const _url = process.env.DATABASE_URI || 'mongodb://127.0.0.1:27017';
const _dbName = process.env.DATABASE_NAME || 'mirestaurante';

const connection = new MongoClient(_url);
let dbConnection = connection.db(_dbName);
let connected = false;

function withId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id), _id };
}

function withMesaId(doc) {
  return withId(doc);
}

function oidFilter(id, tenantId) {
  if (!ObjectId.isValid(id) || String(new ObjectId(id)) !== String(id)) return null;
  const filter = { _id: new ObjectId(id) };
  if (tenantId) filter.tenantId = tenantId;
  return filter;
}

let connecting = null;

// Comparte una sola conexión entre peticiones concurrentes (serverless en Vercel)
async function ensureConnection() {
  if (connected) return;
  if (!connecting) {
    connecting = (async () => {
      await connection.connect();
      dbConnection = connection.db(_dbName);
      await migrateLegacyTenant();
      await migrateLegacyRoles();
      connected = true;
      console.log(`MongoDB connected → ${_dbName}`);
    })().finally(() => {
      connecting = null;
    });
  }
  await connecting;
}

// 'hosstess' (typo) pasó a 'host'; actualiza usuarios e invitaciones existentes.
async function migrateLegacyRoles() {
  await dbConnection.collection('users').updateMany({ role: 'hosstess' }, { $set: { role: 'host' } });
  await dbConnection.collection('invites').updateMany({ role: 'hosstess' }, { $set: { role: 'host' } });
}

async function migrateLegacyTenant() {
  const tenants = dbConnection.collection('tenants');
  let defaultTenant = await tenants.findOne({ slug: 'default' });
  if (!defaultTenant) {
    const needs =
      (await dbConnection.collection('users').countDocuments({ tenantId: { $exists: false } })) > 0 ||
      (await dbConnection.collection('settings').countDocuments({ tenantId: { $exists: false } })) > 0 ||
      (await dbConnection.collection('orders').countDocuments({ tenantId: { $exists: false } })) > 0 ||
      (await dbConnection.collection('mesas').countDocuments({ tenantId: { $exists: false } })) > 0;

    if (needs) {
      const insert = await tenants.insertOne({
        ...createTenantDoc('Negocio migrado'),
        slug: 'default',
      });
      defaultTenant = await tenants.findOne({ _id: insert.insertedId });

      const tenantId = String(defaultTenant._id);
      const collections = [
        'users', 'mesas', 'menus', 'foods', 'waiters', 'waitlist', 'settings', 'orders', 'invites',
      ];
      for (const name of collections) {
        await dbConnection.collection(name).updateMany(
          { tenantId: { $exists: false } },
          { $set: { tenantId } }
        );
      }
      console.log(`MongoDB migration: legacy docs → tenant ${tenantId}`);
    }
  }

  await migrateTenantBilling();
}

async function migrateTenantBilling() {
  const { trialEndsFrom } = require('../models/tenant.model');
  const now = new Date();
  const result = await dbConnection.collection('tenants').updateMany(
    { billingStatus: { $exists: false } },
    {
      $set: {
        plan: 'basic',
        billingStatus: 'trialing',
        trialEndsAt: trialEndsFrom(now),
        mpPreapprovalId: null,
        mpPayerEmail: null,
        currentPeriodEnd: null,
        suspendedAt: null,
        suspendedReason: null,
        updatedAt: now,
      },
    }
  );
  if (result.modifiedCount > 0) {
    console.log(`MongoDB migration: billing fields → ${result.modifiedCount} tenants`);
  }
}

ensureConnection().catch((err) => {
  console.error('MongoDB connection error:', err.message);
});

async function CreateTenant(data) {
  const result = await dbConnection.collection('tenants').insertOne(data);
  return withId(await dbConnection.collection('tenants').findOne({ _id: result.insertedId }));
}
async function GetTenantById(id) {
  if (!ObjectId.isValid(id)) return null;
  return withId(await dbConnection.collection('tenants').findOne({ _id: new ObjectId(id) }));
}
async function UpdateTenant(id, data) {
  if (!ObjectId.isValid(id)) return null;
  const clean = { ...data, updatedAt: new Date() };
  delete clean.id;
  delete clean._id;
  await dbConnection.collection('tenants').updateOne(
    { _id: new ObjectId(id) },
    { $set: clean }
  );
  return GetTenantById(id);
}
async function ListTenants() {
  const list = await dbConnection.collection('tenants').find({}).sort({ createdAt: -1 }).toArray();
  return list.map(withId);
}
async function CountUsersByTenant(tenantId) {
  return dbConnection.collection('users').countDocuments({ tenantId: String(tenantId) });
}
async function GetTenantByMpPreapprovalId(preapprovalId) {
  if (!preapprovalId) return null;
  return withId(
    await dbConnection.collection('tenants').findOne({ mpPreapprovalId: String(preapprovalId) })
  );
}

async function CreateUser(data) {
  return await dbConnection.collection('users').insertOne(data);
}
async function FindUserByEmail(email, tenantId = null) {
  const filter = { email };
  if (tenantId) filter.tenantId = tenantId;
  return await dbConnection.collection('users').findOne(filter);
}
async function FindUserByUsername(username, tenantId = null) {
  const filter = { username };
  if (tenantId) filter.tenantId = tenantId;
  return await dbConnection.collection('users').findOne(filter);
}
async function LoginUsuario(data) {
  let find = await FindUserByUsername(data);
  if (find) return find;
  find = await FindUserByEmail(data);
  if (find) return find;
  return null;
}
async function UpdateUserById(id, data) {
  if (!ObjectId.isValid(id)) return null;
  const clean = { ...data };
  delete clean.id;
  delete clean._id;
  await dbConnection.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: clean });
  return await dbConnection.collection('users').findOne({ _id: new ObjectId(id) });
}
const USER_PUBLIC_FIELDS = { password: 0, resetToken: 0, resetExpires: 0 };

async function GetUsersByTenant(tenantId) {
  const users = await dbConnection
    .collection('users')
    .find({ tenantId: String(tenantId) }, { projection: USER_PUBLIC_FIELDS })
    .sort({ createdAt: 1, name: 1 })
    .toArray();
  return users.map((u) => ({ ...u, id: String(u._id) }));
}
async function GetUserByIdAndTenant(id, tenantId) {
  if (!ObjectId.isValid(id)) return null;
  return await dbConnection
    .collection('users')
    .findOne({ _id: new ObjectId(id), tenantId: String(tenantId) });
}
async function CountUsersByRole(tenantId, role) {
  return dbConnection.collection('users').countDocuments({ tenantId: String(tenantId), role });
}
async function DeleteUserByIdAndTenant(id, tenantId) {
  if (!ObjectId.isValid(id)) return { deletedCount: 0 };
  return await dbConnection
    .collection('users')
    .deleteOne({ _id: new ObjectId(id), tenantId: String(tenantId) });
}
async function FindUserByResetToken(token) {
  return await dbConnection.collection('users').findOne({
    resetToken: token,
    resetExpires: { $gt: new Date() },
  });
}

// ——— Sincronización en vivo ———
// Un contador por canal y por negocio. Cada escritura de pedidos, mesas o lista de espera
// lo incrementa; las pantallas consultan GET /sync (una sola lectura barata) y recargan
// solo lo que cambió. Un fallo aquí nunca debe romper la operación que lo originó.
async function touchSync(tenantId, ...channels) {
  if (!tenantId || !channels.length) return;
  try {
    await dbConnection.collection('sync').updateOne(
      { _id: String(tenantId) },
      { $inc: Object.fromEntries(channels.map((c) => [c, 1])), $set: { updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[sync] no se pudo registrar el cambio:', err.message);
  }
}
async function GetSyncVersions(tenantId) {
  const doc = await dbConnection
    .collection('sync')
    .findOne({ _id: String(tenantId) }, { projection: { _id: 0, orders: 1, tables: 1, waitlist: 1 } });
  return { orders: doc?.orders || 0, tables: doc?.tables || 0, waitlist: doc?.waitlist || 0 };
}

async function AddMesa(data) {
  const result = await dbConnection.collection('mesas').insertOne(data);
  await touchSync(data.tenantId, 'tables');
  return withMesaId(await dbConnection.collection('mesas').findOne({ _id: result.insertedId }));
}
async function UpdateStatusMesa(id, data, tenantId) {
  const clean = { ...data };
  delete clean.id;
  delete clean._id;
  let filter = oidFilter(id, tenantId);
  if (!filter) {
    filter = { numero: parseInt(id, 10), ...(tenantId ? { tenantId } : {}) };
  }
  let result = await dbConnection.collection('mesas').updateOne(filter, { $set: clean });
  if (result.matchedCount === 0 && tenantId) {
    result = await dbConnection.collection('mesas').updateOne(
      { nombre: String(id), tenantId },
      { $set: clean }
    );
  }
  if (result.matchedCount) await touchSync(tenantId, 'tables');
  return result;
}
async function Getmesas(tenantId) {
  const filter = tenantId ? { tenantId } : {};
  return (await dbConnection.collection('mesas').find(filter).toArray()).map(withMesaId);
}
async function GetMesaById(id, tenantId) {
  const byOid = oidFilter(id, tenantId);
  if (byOid) {
    const doc = await dbConnection.collection('mesas').findOne(byOid);
    if (doc) return withMesaId(doc);
  }
  const base = tenantId ? { tenantId } : {};
  let result = await dbConnection.collection('mesas').findOne({ ...base, nombre: id });
  if (!result) {
    result = await dbConnection.collection('mesas').findOne({ ...base, numero: parseInt(id, 10) });
  }
  return withMesaId(result);
}
async function GetNextMesaNumero(tenantId) {
  const filter = tenantId ? { tenantId } : {};
  const last = await dbConnection.collection('mesas').find(filter).sort({ numero: -1 }).limit(1).toArray();
  return last.length ? (last[0].numero || 0) + 1 : 1;
}
async function GetMesaFreeWaiter(tenantId) {
  const filter = { disponible: true, ...(tenantId ? { tenantId } : {}) };
  return (await dbConnection.collection('mesas').find(filter).toArray()).map(withMesaId);
}
async function DeleteMesa(id, tenantId) {
  const byOid = oidFilter(id, tenantId);
  if (byOid) {
    const byOidRes = await dbConnection.collection('mesas').deleteOne(byOid);
    if (byOidRes.deletedCount) {
      await touchSync(tenantId, 'tables');
      return byOidRes;
    }
  }
  const result = await dbConnection.collection('mesas').deleteOne({
    numero: parseInt(id, 10),
    ...(tenantId ? { tenantId } : {}),
  });
  if (result.deletedCount) await touchSync(tenantId, 'tables');
  return result;
}
async function CloseMesas(tenantId) {
  const filter = tenantId ? { tenantId } : {};
  const result = await dbConnection.collection('mesas').updateMany(filter, { $set: { disponible: false, personaTitular: null } });
  await touchSync(tenantId, 'tables');
  return result;
}

async function GetMenus(tenantId) {
  const filter = tenantId ? { tenantId } : {};
  return (await dbConnection.collection('menus').find(filter).toArray()).map(withId);
}
async function GetMenuById(id, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return null;
  const menu = await dbConnection.collection('menus').findOne(filter);
  if (!menu) return null;
  const foodFilter = { menuId: String(id), ...(tenantId ? { tenantId } : {}) };
  const foods = await dbConnection.collection('foods').find(foodFilter).toArray();
  return { ...withId(menu), foods: foods.map(withId) };
}
async function CreateMenu(data) {
  const result = await dbConnection.collection('menus').insertOne(data);
  return withId(await dbConnection.collection('menus').findOne({ _id: result.insertedId }));
}
async function UpdateMenu(id, data, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return null;
  const clean = { ...data };
  delete clean.id; delete clean._id; delete clean.foods;
  await dbConnection.collection('menus').updateOne(filter, { $set: clean });
  return GetMenuById(id, tenantId);
}
async function DeleteMenu(id, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return { deletedCount: 0 };
  await dbConnection.collection('foods').deleteMany({ menuId: String(id), ...(tenantId ? { tenantId } : {}) });
  return await dbConnection.collection('menus').deleteOne(filter);
}
async function GetFoods(tenantId) {
  const filter = tenantId ? { tenantId } : {};
  return (await dbConnection.collection('foods').find(filter).toArray()).map(withId);
}
async function GetFoodById(id, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return null;
  return withId(await dbConnection.collection('foods').findOne(filter));
}
async function CreateFood(data) {
  const result = await dbConnection.collection('foods').insertOne(data);
  return withId(await dbConnection.collection('foods').findOne({ _id: result.insertedId }));
}
async function UpdateFood(id, data, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return null;
  const clean = { ...data };
  delete clean.id; delete clean._id;
  await dbConnection.collection('foods').updateOne(filter, { $set: clean });
  return GetFoodById(id, tenantId);
}
async function DeleteFood(id, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return { deletedCount: 0 };
  return await dbConnection.collection('foods').deleteOne(filter);
}

async function AddWaiter(data) {
  return await dbConnection.collection('waiters').insertOne(data);
}
async function GetWaiters(tenantId) {
  const filter = tenantId ? { tenantId } : {};
  return await dbConnection.collection('waiters').find(filter).toArray();
}
async function GetWaiterByCellphone(id, tenantId) {
  return await dbConnection.collection('waiters').findOne({ cellphone: id, ...(tenantId ? { tenantId } : {}) });
}
async function GetWaiterByDisponibility(disponibility, tenantId) {
  return await dbConnection.collection('waiters').findOne({ status: disponibility, ...(tenantId ? { tenantId } : {}) });
}
async function DeleteWaiter(id, tenantId) {
  return await dbConnection.collection('waiters').deleteOne({ cellphone: id, ...(tenantId ? { tenantId } : {}) });
}
async function UpdateWaiter(id, data, tenantId) {
  return await dbConnection.collection('waiters').updateOne({ cellphone: id, ...(tenantId ? { tenantId } : {}) }, { $set: data });
}

async function AddWaitList(data) {
  const result = await dbConnection.collection('waitlist').insertOne(data);
  await touchSync(data.tenantId, 'waitlist');
  return result;
}
async function GetWaitList(tenantId) {
  const filter = tenantId ? { tenantId } : {};
  return await dbConnection.collection('waitlist').find(filter).toArray();
}
async function GetWaitListByNumber(number, tenantId) {
  return await dbConnection.collection('waitlist').findOne({ cellphone: parseInt(number, 10), ...(tenantId ? { tenantId } : {}) });
}
async function DeleteWaitList(id, tenantId) {
  const result = await dbConnection.collection('waitlist').deleteOne({ telefono: id, ...(tenantId ? { tenantId } : {}) });
  if (result.deletedCount) await touchSync(tenantId, 'waitlist');
  return result;
}

async function GetSettings(tenantId) {
  if (!tenantId) return await dbConnection.collection('settings').findOne({});
  return await dbConnection.collection('settings').findOne({ tenantId });
}
async function CreateSettings(data) {
  await dbConnection.collection('settings').insertOne(data);
  return await GetSettings(data.tenantId);
}
async function UpdateSettings(data, tenantId) {
  const tid = tenantId || data.tenantId;
  await dbConnection.collection('settings').updateOne({ tenantId: tid }, { $set: data }, { upsert: true });
  return await GetSettings(tid);
}

async function GetOrders(tenantId) {
  const filter = tenantId ? { tenantId } : {};
  return (await dbConnection.collection('orders').find(filter).sort({ createdAt: -1 }).toArray()).map(withId);
}
async function GetOrderById(id, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return null;
  return withId(await dbConnection.collection('orders').findOne(filter));
}
async function CreateOrder(data) {
  const result = await dbConnection.collection('orders').insertOne(data);
  await touchSync(data.tenantId, 'orders');
  return withId(await dbConnection.collection('orders').findOne({ _id: result.insertedId }));
}
async function UpdateOrder(id, data, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return null;
  const clean = { ...data };
  delete clean.id; delete clean._id;
  await dbConnection.collection('orders').updateOne(filter, { $set: clean });
  await touchSync(tenantId, 'orders');
  return GetOrderById(id, tenantId);
}
async function GetOrdersByCashSession(sessionId, tenantId) {
  return (await dbConnection.collection('orders').find({ cashSessionId: sessionId, ...(tenantId ? { tenantId } : {}) }).toArray()).map(withId);
}

async function GetInvites(tenantId) {
  const filter = tenantId ? { tenantId } : {};
  return (await dbConnection.collection('invites').find(filter).sort({ createdAt: -1 }).toArray()).map(withId);
}
async function GetInviteByToken(token) {
  return withId(await dbConnection.collection('invites').findOne({ token }));
}
async function CreateInvite(data) {
  const result = await dbConnection.collection('invites').insertOne(data);
  return withId(await dbConnection.collection('invites').findOne({ _id: result.insertedId }));
}
async function UpdateInvite(id, data, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return null;
  const clean = { ...data };
  delete clean.id; delete clean._id;
  await dbConnection.collection('invites').updateOne(filter, { $set: clean });
  return withId(await dbConnection.collection('invites').findOne(filter));
}
async function DeleteInvite(id, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return { deletedCount: 0 };
  return await dbConnection.collection('invites').deleteOne(filter);
}

async function GetOpenCashSession(tenantId) {
  return withId(await dbConnection.collection('cash_sessions').findOne({ tenantId, status: 'open' }));
}
async function GetCashSessionById(id, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return null;
  return withId(await dbConnection.collection('cash_sessions').findOne(filter));
}
async function CreateCashSession(data) {
  const result = await dbConnection.collection('cash_sessions').insertOne(data);
  await touchSync(data.tenantId, 'orders');
  return withId(await dbConnection.collection('cash_sessions').findOne({ _id: result.insertedId }));
}
async function UpdateCashSession(id, data, tenantId) {
  const filter = oidFilter(id, tenantId);
  if (!filter) return null;
  const clean = { ...data };
  delete clean.id; delete clean._id;
  await dbConnection.collection('cash_sessions').updateOne(filter, { $set: clean });
  await touchSync(tenantId, 'orders');
  return GetCashSessionById(id, tenantId);
}

module.exports = {
  ensureConnection,
  CreateTenant, GetTenantById, UpdateTenant, ListTenants, CountUsersByTenant, GetTenantByMpPreapprovalId,
  CreateUser, FindUserByEmail, LoginUsuario, FindUserByUsername, UpdateUserById, FindUserByResetToken,
  touchSync, GetSyncVersions,
  GetUsersByTenant, GetUserByIdAndTenant, CountUsersByRole, DeleteUserByIdAndTenant,
  AddMesa, UpdateStatusMesa, Getmesas, GetMesaFreeWaiter, GetMesaById, DeleteMesa, CloseMesas, GetNextMesaNumero,
  AddWaiter, GetWaiters, GetWaiterByCellphone, GetWaiterByDisponibility, DeleteWaiter, UpdateWaiter,
  AddWaitList, GetWaitList, GetWaitListByNumber, DeleteWaitList,
  GetSettings, CreateSettings, UpdateSettings,
  GetMenus, GetMenuById, CreateMenu, UpdateMenu, DeleteMenu,
  GetFoods, GetFoodById, CreateFood, UpdateFood, DeleteFood,
  GetOrders, GetOrderById, CreateOrder, UpdateOrder, GetOrdersByCashSession,
  GetInvites, GetInviteByToken, CreateInvite, UpdateInvite, DeleteInvite,
  GetOpenCashSession, GetCashSessionById, CreateCashSession, UpdateCashSession,
};
