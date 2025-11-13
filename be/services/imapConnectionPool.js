const imap = require('imap-simple');

/**
 * Connection pool để reuse IMAP connections
 * Giảm overhead của việc connect/disconnect mỗi lần scan
 */
class ImapConnectionPool {
  constructor() {
    this.connections = new Map(); // Map<email, {connection, lastUsed, inUse}>
    this.cleanupInterval = null;
    this.MAX_IDLE_TIME = 5 * 60 * 1000; // 5 phút
    this.CLEANUP_INTERVAL = 60 * 1000; // Cleanup mỗi phút
  }

  /**
   * Lấy hoặc tạo connection cho email
   */
  async getConnection(email, appPassword) {
    const poolKey = `${email}`;
    let poolEntry = this.connections.get(poolKey);

    // Nếu có connection và đang không được dùng, reuse nó
    if (poolEntry && !poolEntry.inUse && poolEntry.connection) {
      // Kiểm tra connection còn sống không
      // Nếu connection còn valid, reuse nó (sẽ được kiểm tra khi dùng)
      poolEntry.lastUsed = Date.now();
      poolEntry.inUse = true;
      console.log(`♻️  [${email}] Reusing existing IMAP connection`);
      return poolEntry.connection;
    }

    // Tạo connection mới
    const config = {
      imap: {
        user: email,
        password: appPassword,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 30000,
        connTimeout: 30000,
        keepalive: true, // Bật keepalive để giữ connection sống
      },
    };

    try {
      const connection = await imap.connect(config);
      await connection.openBox('INBOX', true);

      poolEntry = {
        connection,
        lastUsed: Date.now(),
        inUse: true,
      };
      this.connections.set(poolKey, poolEntry);

      console.log(`🆕 [${email}] Created new IMAP connection`);
      return connection;
    } catch (error) {
      console.error(`❌ [${email}] Failed to create IMAP connection:`, error.message);
      throw error;
    }
  }

  /**
   * Release connection sau khi dùng xong
   */
  releaseConnection(email) {
    const poolKey = `${email}`;
    const poolEntry = this.connections.get(poolKey);
    if (poolEntry) {
      poolEntry.inUse = false;
      poolEntry.lastUsed = Date.now();
    }
  }

  /**
   * Đóng connection cho email
   */
  async closeConnection(email) {
    const poolKey = `${email}`;
    const poolEntry = this.connections.get(poolKey);
    if (poolEntry && poolEntry.connection) {
      try {
        await poolEntry.connection.end();
      } catch (error) {
        console.error(`❌ [${email}] Error closing connection:`, error.message);
      }
      this.connections.delete(poolKey);
    }
  }

  /**
   * Cleanup connections idle quá lâu
   */
  startCleanup() {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [email, entry] of this.connections.entries()) {
        if (!entry.inUse && (now - entry.lastUsed) > this.MAX_IDLE_TIME) {
          console.log(`🧹 Cleaning up idle connection for: ${email}`);
          this.closeConnection(email).catch(() => {});
        }
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Dừng cleanup
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Đóng tất cả connections
   */
  async closeAll() {
    this.stopCleanup();
    const promises = [];
    for (const [email] of this.connections.entries()) {
      promises.push(this.closeConnection(email));
    }
    await Promise.all(promises);
    this.connections.clear();
  }
}

// Singleton instance
const connectionPool = new ImapConnectionPool();
connectionPool.startCleanup();

module.exports = connectionPool;

