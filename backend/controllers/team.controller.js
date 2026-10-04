const Joi = require('joi');
const db = require('../database/mongodb');
const bcrypt = require('../utils/bcrypt.utils');
const { TENANT_ROLES } = require('../models/tenant.model');
const { ROLE_DEFS, normalizeRole } = require('../models/roles');

const passwordRule = Joi.string().min(8).max(72).required().messages({
  'string.min': 'La contraseña debe tener al menos 8 caracteres',
  'string.max': 'La contraseña es demasiado larga (máximo 72 caracteres)',
  'any.required': 'La contraseña es obligatoria',
  'string.empty': 'La contraseña es obligatoria',
});

const roleRule = Joi.string()
  .valid(...TENANT_ROLES)
  .required()
  .messages({ 'any.only': 'Rol inválido', 'any.required': 'El rol es obligatorio' });

const createSchema = Joi.object({
  name: Joi.string().trim().min(1).max(60).required().messages({ 'any.required': 'El nombre es obligatorio', 'string.empty': 'El nombre es obligatorio' }),
  lastName: Joi.string().trim().min(1).max(60).required().messages({ 'any.required': 'El apellido es obligatorio', 'string.empty': 'El apellido es obligatorio' }),
  username: Joi.string()
    .trim()
    .min(3)
    .max(30)
    .pattern(/^[a-zA-Z0-9._-]+$/)
    .required()
    .messages({
      'string.min': 'El usuario debe tener al menos 3 caracteres',
      'string.max': 'El usuario es demasiado largo (máximo 30 caracteres)',
      'string.pattern.base': 'El usuario solo puede llevar letras, números, punto, guion y guion bajo',
      'any.required': 'El usuario es obligatorio',
      'string.empty': 'El usuario es obligatorio',
    }),
  password: passwordRule,
  role: roleRule,
  email: Joi.string().trim().lowercase().email().allow('', null).optional().messages({ 'string.email': 'Correo inválido' }),
  cellphone: Joi.when('role', {
    is: 'waiter',
    then: Joi.string().pattern(/^\d{10}$/).required(),
    otherwise: Joi.string().pattern(/^\d{10}$/).allow('', null).optional(),
  }).messages({
    'string.pattern.base': 'El celular debe tener 10 dígitos',
    'any.required': 'El celular es obligatorio para meseros (10 dígitos)',
    'string.empty': 'El celular es obligatorio para meseros (10 dígitos)',
  }),
}).options({ stripUnknown: true });

function publicUser(u) {
  return {
    id: String(u.id || u._id),
    name: u.name,
    lastName: u.lastName,
    username: u.username,
    email: u.email || '',
    cellphone: u.cellphone || '',
    role: normalizeRole(u.role),
    createdAt: u.createdAt || null,
  };
}

function badRequest(res, error) {
  return res.status(400).send(error.details?.[0]?.message || 'Datos inválidos');
}

function isSelf(req, target) {
  return target.username === req.user?.username;
}

/** Evita dejar el negocio sin ningún administrador. */
async function isLastAdmin(req, target) {
  if (normalizeRole(target.role) !== 'admin') return false;
  return (await db.CountUsersByRole(req.tenantId, 'admin')) <= 1;
}

async function list(req, res) {
  try {
    const users = await db.GetUsersByTenant(req.tenantId);
    return res.status(200).json({ members: users.map(publicUser), roles: ROLE_DEFS });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al listar el equipo');
  }
}

async function create(req, res) {
  try {
    const { error, value } = createSchema.validate(req.body || {}, { abortEarly: true });
    if (error) return badRequest(res, error);

    if (await db.FindUserByUsername(value.username)) {
      return res.status(400).send('Ese usuario ya existe, elige otro');
    }
    if (value.email && (await db.FindUserByEmail(value.email))) {
      return res.status(400).send('Ese correo ya está registrado');
    }
    if (value.role === 'waiter' && (await db.GetWaiterByCellphone(value.cellphone, req.tenantId))) {
      return res.status(400).send('Ya hay un mesero con ese celular');
    }

    const doc = {
      name: value.name,
      lastName: value.lastName,
      username: value.username,
      password: await bcrypt.hashPassword(value.password),
      role: value.role,
      tenantId: req.tenantId,
      createdAt: new Date(),
      createdBy: req.user?.username || null,
    };
    if (value.email) doc.email = value.email;
    if (value.cellphone) doc.cellphone = value.cellphone;

    const result = await db.CreateUser(doc);

    if (value.role === 'waiter') {
      await db.AddWaiter({
        name: value.name,
        lastName: value.lastName,
        birthDate: new Date(),
        startDate: new Date(),
        cellphone: value.cellphone,
        mesa: [],
        role: 'waiter',
        workSchedule: 'morning',
        status: 'rest',
        tenantId: req.tenantId,
      });
    }

    return res.status(201).json(publicUser({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al crear el usuario');
  }
}

async function changeRole(req, res) {
  try {
    const { error, value } = Joi.object({ role: roleRule }).validate(req.body || {});
    if (error) return badRequest(res, error);

    const target = await db.GetUserByIdAndTenant(req.params.id, req.tenantId);
    if (!target) return res.status(404).send('Usuario no encontrado');
    if (isSelf(req, target)) return res.status(400).send('No puedes cambiar tu propio rol');
    if (value.role !== 'admin' && (await isLastAdmin(req, target))) {
      return res.status(400).send('Debe quedar al menos un administrador');
    }

    const updated = await db.UpdateUserById(String(target._id), { role: value.role, updatedAt: new Date() });
    return res.status(200).json(publicUser(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al cambiar el rol');
  }
}

async function resetPassword(req, res) {
  try {
    const { error, value } = Joi.object({ password: passwordRule }).validate(req.body || {});
    if (error) return badRequest(res, error);

    const target = await db.GetUserByIdAndTenant(req.params.id, req.tenantId);
    if (!target) return res.status(404).send('Usuario no encontrado');

    await db.UpdateUserById(String(target._id), {
      password: await bcrypt.hashPassword(value.password),
      resetToken: null,
      resetExpires: null,
      updatedAt: new Date(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al cambiar la contraseña');
  }
}

async function remove(req, res) {
  try {
    const target = await db.GetUserByIdAndTenant(req.params.id, req.tenantId);
    if (!target) return res.status(404).send('Usuario no encontrado');
    if (isSelf(req, target)) return res.status(400).send('No puedes eliminar tu propia cuenta');
    if (await isLastAdmin(req, target)) {
      return res.status(400).send('Debe quedar al menos un administrador');
    }

    await db.DeleteUserByIdAndTenant(String(target._id), req.tenantId);
    if (normalizeRole(target.role) === 'waiter' && target.cellphone) {
      await db.DeleteWaiter(target.cellphone, req.tenantId).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || 'Error al eliminar el usuario');
  }
}

module.exports = { list, create, changeRole, resetPassword, remove };
