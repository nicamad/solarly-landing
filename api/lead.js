module.exports = async function handler(req, res) {
  // Back-compat endpoint: forward to /api/subscribe behavior.
  // Keep this so old clients don't break.
  const subscribe = require("./subscribe.js");
  return subscribe(req, res);
};
