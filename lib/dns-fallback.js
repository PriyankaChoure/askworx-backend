const dns = require('dns');
const dnsPromises = dns.promises;

async function ensureSrvResolvable(hostname, options = {}) {
  const servers = options.servers || ['8.8.8.8', '1.1.1.1'];
  const srvName = `_mongodb._tcp.${hostname}`;
  try {
    await dnsPromises.resolveSrv(srvName);
    return { ok: true, usedFallback: false };
  } catch (err) {
    if (err && err.code === 'ECONNREFUSED') {
      // set public DNS and retry once
      try {
        dns.setServers(servers);
        await dnsPromises.resolveSrv(srvName);
        return { ok: true, usedFallback: true };
      } catch (err2) {
        return { ok: false, error: err2 };
      }
    }
    return { ok: false, error: err };
  }
}

module.exports = { ensureSrvResolvable };
