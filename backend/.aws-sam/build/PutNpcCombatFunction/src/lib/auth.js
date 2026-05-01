const bcrypt = require("bcryptjs");

async function verifyPassword(password, item) {
  if (password === undefined || password === null) return { valid: false };
  const [isOwner, isDM] = await Promise.all([
    bcrypt.compare(password, item.passwordHash),
    process.env.DM_PASSWORD_HASH
      ? bcrypt.compare(password, process.env.DM_PASSWORD_HASH)
      : Promise.resolve(false),
  ]);
  if (isDM) return { valid: true, role: "dm" };
  if (isOwner) return { valid: true, role: "owner" };
  return { valid: false };
}

module.exports = { verifyPassword };
