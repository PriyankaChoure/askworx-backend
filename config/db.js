const mongoose = require("mongoose");
const { ensureSrvResolvable } = require('../lib/dns-fallback');

const connectDB = async () => {
  try {
    // If using mongodb+srv, ensure SRV can be resolved; fallback to public DNS on ECONNREFUSED
    try {
      let isSrv = false;
      try {
        const parsed = new URL(process.env.MONGO_URI);
        isSrv = parsed.protocol === 'mongodb+srv:';
        if (isSrv) {
          const host = parsed.hostname;
          const res = await ensureSrvResolvable(host);
          if (!res.ok) {
            console.warn('dns-fallback: SRV resolution failed:', res.error && res.error.message);
          } else if (res.usedFallback) {
            console.info('dns-fallback: used public DNS servers as fallback');
          }
        }
      } catch (e) {
        // ignore parse errors
      }

    } catch (e) {
      console.warn('dns-fallback encountered an error:', e && e.message);
    }

    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
