// testConnection.js
const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '.env') });
const dns = require('dns');
const dnsPromises = dns.promises;
const { MongoClient } = require("mongodb");
const { URL } = require('url');

const client = new MongoClient(process.env.MONGO_URI);

async function connectClient() {
  console.log('mongo ', process.env.MONGO_URI);
  await client.connect();
  console.log('Connected successfully!');
  await client.close();
}

async function test() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not set in backend/.env');

    // If using mongodb+srv, try one SRV lookup first. On ECONNREFUSED, set public DNS servers and retry.
    let isSrv = false;
    let host = null;
    try {
      const parsed = new URL(uri);
      isSrv = parsed.protocol === 'mongodb+srv:';
      host = parsed.hostname;
    } catch (e) {
      // leave as non-SRV if parsing fails
    }

    if (!isSrv) {
      await connectClient();
      return;
    }

    const srvName = `_mongodb._tcp.${host}`;
    try {
      await dnsPromises.resolveSrv(srvName);
      // SRV resolution works, proceed
      await connectClient();
      return;
    } catch (e) {
      if (e && e.code === 'ECONNREFUSED') {
        console.warn('SRV lookup ECONNREFUSED; setting public DNS servers and retrying DNS lookup');
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        // retry once
        await dnsPromises.resolveSrv(srvName);
        await connectClient();
        return;
      }
      throw e;
    }
  } catch (err) {
    console.error('Connection failed:', err);
    process.exitCode = 2;
  }
}

test();