/**
 * auth.js — password hashing (bcrypt), JWT sessions, and role guards.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const TOKEN_TTL = '7d';

if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET not set — using an insecure dev secret. Set JWT_SECRET in production.');
}

function hashPassword(plain) { return bcrypt.hashSync(plain, 10); }
function verifyPassword(plain, hash) { return bcrypt.compareSync(plain, hash); }

/** Token carries role + client_id so every request knows the actor's tenant. */
function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, client_id: user.client_id || null }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
function verifyToken(token) { try { return jwt.verify(token, JWT_SECRET); } catch (e) { return null; } }

/** Require a valid Bearer token; sets req.userId, req.role, req.clientId. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const p = token && verifyToken(token);
  if (!p) return res.status(401).json({ error: 'Not authenticated.' });
  req.userId = p.sub;
  req.role = p.role;
  req.clientId = p.client_id;
  next();
}

/** Require the actor to hold one of the given roles. Assumes requireAuth ran first. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.role)) return res.status(403).json({ error: 'Forbidden.' });
    next();
  };
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const p = token && verifyToken(token);
  if (p) { req.userId = p.sub; req.role = p.role; req.clientId = p.client_id; }
  next();
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, requireAuth, optionalAuth, requireRole };
