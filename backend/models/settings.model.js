const Joi = require('joi');

const settingsSchema = Joi.object({
  businessName: Joi.string().min(2).max(80).required(),
  businessType: Joi.string()
    .valid('restaurant', 'cafe', 'bar', 'hotel', 'other')
    .default('restaurant'),
  address: Joi.string().allow('').max(200).optional(),
  phone: Joi.string().allow('').max(30).optional(),
  logoUrl: Joi.string().allow('').max(8_000_000).optional(),
  primaryColor: Joi.string()
    .pattern(/^#([0-9A-Fa-f]{6})$/)
    .default('#1F4D3A'),
  accentColor: Joi.string()
    .pattern(/^#([0-9A-Fa-f]{6})$/)
    .default('#C4A574'),
  timezone: Joi.string().default('America/Mexico_City'),
  initialTables: Joi.number().integer().min(0).max(100).default(0),
  setupCompleted: Joi.boolean().default(true),
  updatedAt: Joi.date().optional(),
  createdAt: Joi.date().optional(),
});

module.exports = settingsSchema;
