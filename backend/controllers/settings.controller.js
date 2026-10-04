const settingsSchema = require('../models/settings.model');
const db = require('../database/mongodb');

async function GetSettings(req, res) {
  try {
    const settings = await db.GetSettings(req.tenantId);
    if (!settings) {
      return res.status(404).send({ setupCompleted: false });
    }
    return res.status(200).send(settings);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al obtener la configuración');
  }
}

async function SaveSettings(req, res) {
  try {
    const { error, value } = settingsSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).send(error.details.map((d) => d.message).join(', '));
    }

    const payload = {
      ...value,
      tenantId: req.tenantId,
      setupCompleted: true,
      updatedAt: new Date(),
    };

    const existing = await db.GetSettings(req.tenantId);
    if (!existing) {
      payload.createdAt = new Date();
      const created = await db.CreateSettings(payload);
      return res.status(201).send(created);
    }

    const updated = await db.UpdateSettings(payload, req.tenantId);
    return res.status(200).send(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al guardar la configuración');
  }
}

module.exports = {
  GetSettings,
  SaveSettings,
};
