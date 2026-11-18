const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string()
    .min(10)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes'),
}).strict();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
}).strict();

module.exports = { registerSchema, loginSchema };
