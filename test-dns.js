// test-dns.js
// Resolves SRV and TXT for the Atlas cluster and builds a non-SRV mongodb:// URI
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const dns = require('dns');
// Force Node resolver to use public DNS servers (helps when local resolver/proxy blocks port 53)
dns.setServers(['8.8.8.8', '1.1.1.1']);
const dnsPromises = dns.promises;
const { URL } = require('url');

const srvName = '_mongodb._tcp.askworx-cluster.dhb5lfv.mongodb.net';

async function main() {
  try {
    console.log('Reading MONGO_URI from backend/.env');
    const raw = process.env.MONGO_URI;
    if (!raw) throw new Error('MONGO_URI not set in backend/.env');

    let username = '';
    let password = '';
    let dbname = '';

    try {
      const parsed = new URL(raw);
      username = decodeURIComponent(parsed.username);
      password = decodeURIComponent(parsed.password);
      dbname = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
    } catch (e) {
      // ignore
    }

    console.log('\nResolving SRV for', srvName);
    const srv = await dnsPromises.resolveSrv(srvName);
    console.log('SRV records:');
    srv.forEach((r) => console.log(` - target=${r.name} port=${r.port} priority=${r.priority} weight=${r.weight}`));

    console.log('\nResolving TXT for', srvName);
    const txt = await dnsPromises.resolveTxt(srvName);
    console.log('TXT records:');
    txt.forEach((t, i) => console.log(` - [${i}] ${t.join('')}`));

    // Parse TXT params (take first TXT string)
    const txtJoined = txt.length ? txt[0].join('') : '';
    const params = {};
    if (txtJoined) {
      const afterQ = txtJoined.includes('?') ? txtJoined.split('?')[1] : txtJoined;
      afterQ.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) params[k] = v || '';
      });
    }

    // Resolve A records for each SRV target (best-effort)
    console.log('\nResolving A records for SRV targets:');
    const hosts = [];
    for (const r of srv) {
      try {
        const addrs = await dnsPromises.resolve4(r.name);
        console.log(` - ${r.name} -> ${addrs.join(',')}`);
      } catch (e) {
        console.log(` - ${r.name} -> (A lookup failed) ${e.code || e.message}`);
      }
      hosts.push(`${r.name}:${r.port}`);
    }

    // Build non-SRV mongodb:// URI
    const userinfo = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
    const hostsPart = hosts.join(',');
    const replicaSet = params.replicaSet || params.replica_set || '';
    const ssl = params.ssl || params.tls || 'true';
    const authSource = params.authSource || 'admin';

    let options = `authSource=${authSource}&retryWrites=true&w=majority`;
    if (replicaSet) options = `replicaSet=${replicaSet}&` + options;
    if (ssl) options = `ssl=${ssl}&` + options;

    const nonSrv = `mongodb://${userinfo}${hostsPart}/${dbname || ''}?${options}`;

    console.log('\nConstructed non-SRV URI (password included if present in env):');
    console.log(nonSrv);

  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 2;
  }
}

main();
