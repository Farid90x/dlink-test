// src/websocket-price-monitor.ts
import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';
import { logger } from './logger';

interface PriceUpdate {
  tokenMint: string;
  priceInSol: number;
  timestamp: number;
  liquidity?: number;
}

type PriceCallback = (update: PriceUpdate) => void;

export class WebSocketPriceMonitor {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, PriceCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private isConnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private wsUrl: string;
  private latestPrices: Map<string, PriceUpdate> = new Map();

  constructor(wsUrl?: string) {
    // Use PumpSwap WebSocket endpoint (adjust if needed)
    this.wsUrl = wsUrl || 'wss://pumpswap.io/api/ws';
  }


  getCurrentPrice(tokenMint: string): number | null {
    const update = this.latestPrices.get(tokenMint);
    return update ? update.priceInSol : null;
  }

  /**
   * Connect to WebSocket and start monitoring
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        logger.info(`[WS] Connecting to ${this.wsUrl}...`);

        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          logger.info('✅ [WS] Connected to price feed');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve(true);
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            logger.error(`[WS] Failed to parse message: ${error}`);
          }
        });

        this.ws.on('error', (error) => {
          logger.error(`[WS] Error: ${error.message}`);
        });

        this.ws.on('close', () => {
          logger.warn('[WS] Connection closed');
          this.isConnected = false;
          this.stopHeartbeat();
          this.attemptReconnect();
        });

        // Timeout if connection takes too long
        setTimeout(() => {
          if (!this.isConnected) {
            logger.error('[WS] Connection timeout');
            resolve(false);
          }
        }, 10000);

      } catch (error: any) {
        logger.error(`[WS] Connection error: ${error?.message ?? error}`);
        resolve(false);
      }
    });
  }

  /**
   * Subscribe to price updates for a specific token
   */
  subscribe(tokenMint: string, callback: PriceCallback): void {
    logger.info(`[WS] Subscribing to price updates for ${tokenMint}`);

    if (!this.subscribers.has(tokenMint)) {
      this.subscribers.set(tokenMint, []);
    }

    this.subscribers.get(tokenMint)!.push(callback);

    // Send subscription message to WebSocket
    if (this.isConnected && this.ws) {
      const subscribeMessage = {
        action: 'subscribe',
        token: tokenMint,
        interval: 200, // 200ms updates as requested
      };

      this.ws.send(JSON.stringify(subscribeMessage));
    }
  }

  /**
   * Unsubscribe from price updates
   */
  unsubscribe(tokenMint: string): void {
    logger.info(`[WS] Unsubscribing from ${tokenMint}`);

    if (this.subscribers.has(tokenMint)) {
      this.subscribers.delete(tokenMint);

      // Send unsubscribe message
      if (this.isConnected && this.ws) {
        const unsubscribeMessage = {
          action: 'unsubscribe',
          token: tokenMint,
        };

        this.ws.send(JSON.stringify(unsubscribeMessage));
      }
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    // Handle different message types
    if (message.type === 'price_update') {
      const update: PriceUpdate = {
        tokenMint: message.token,
        priceInSol: message.price || 0,
        timestamp: message.timestamp || Date.now(),
        liquidity: message.liquidity,
      };
      this.latestPrices.set(update.tokenMint, update); // ذخیره آخرین قیمت
      const callbacks = this.subscribers.get(update.tokenMint);
      if (callbacks && callbacks.length > 0) {
        callbacks.forEach(callback => callback(update));
      }
    } else if (message.type === 'heartbeat' || message.type === 'pong') {
      // Heartbeat response, connection is alive
    } else {
      // Unknown message type, log for debugging
      logger.debug(`[WS] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        const ping = { type: 'ping', timestamp: Date.now() };
        this.ws.send(JSON.stringify(ping));
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect after connection loss
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[WS] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`[WS] Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Gracefully close WebSocket connection
   */
  close(): void {
    logger.info('[WS] Closing WebSocket connection...');
    
    this.isConnected = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscribers.clear();
  }

  /**
   * Check if connected
   */
  isConnectionActive(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
let priceMonitorInstance: WebSocketPriceMonitor | null = null;

export function getPriceMonitor(wsUrl?: string): WebSocketPriceMonitor {
  if (!priceMonitorInstance) {
    priceMonitorInstance = new WebSocketPriceMonitor(wsUrl);
  }
  return priceMonitorInstance;
}
