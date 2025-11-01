import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';

/**
 * Polymarket Trading Client
 * Wrapper for the Polymarket CLOB API to enable programmatic trading
 */

export interface MarketOrder {
  tokenId: string;
  amount: number; // Dollar amount
  side: 'BUY' | 'SELL';
}

export interface LimitOrder {
  tokenId: string;
  price: number; // Between 0.00 and 1.00
  size: number; // Number of shares
  side: 'BUY' | 'SELL';
}

export interface Market {
  condition_id: string;
  question: string;
  market_slug: string;
  end_date_iso: string;
  game_start_time: string;
  question_id: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
  }>;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

export interface TradeParams {
  market_slug: string;
  side: 'BUY' | 'SELL';
  outcome: 'Yes' | 'No';
  amount?: number; // For market orders (dollars)
  price?: number; // For limit orders (0-1)
  size?: number; // For limit orders (shares)
}

export class PolymarketTradingClient {
  private client: ClobClient;
  private wallet: ethers.Wallet;
  private chainId: number = 137; // Polygon mainnet
  private initialized: boolean = false;

  /**
   * Initialize the Polymarket trading client
   * @param privateKey - Ethereum private key for signing transactions
   * @param host - CLOB API endpoint (default: https://clob.polymarket.com)
   */
  constructor(privateKey: string, host: string = 'https://clob.polymarket.com') {
    this.wallet = new ethers.Wallet(privateKey);
    this.client = new ClobClient(
      host,
      this.chainId,
      this.wallet
    );
  }

  /**
   * Initialize API credentials
   * Must be called before trading operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.client.createOrDeriveAPIKey();
      this.initialized = true;
      console.log('✓ Polymarket trading client initialized');
    } catch (error) {
      throw new Error(`Failed to initialize trading client: ${error}`);
    }
  }

  /**
   * Get all available markets
   */
  async getMarkets(): Promise<Market[]> {
    try {
      const markets = await this.client.getSimplifiedMarkets();
      return markets as Market[];
    } catch (error) {
      throw new Error(`Failed to fetch markets: ${error}`);
    }
  }

  /**
   * Get a specific market by slug
   */
  async getMarket(marketSlug: string): Promise<Market | null> {
    try {
      const markets = await this.getMarkets();
      return markets.find((m) => m.market_slug === marketSlug) || null;
    } catch (error) {
      throw new Error(`Failed to fetch market ${marketSlug}: ${error}`);
    }
  }

  /**
   * Get order book for a specific token
   */
  async getOrderBook(tokenId: string): Promise<OrderBook> {
    try {
      const orderBook = await this.client.getOrderBook(tokenId);
      return orderBook as OrderBook;
    } catch (error) {
      throw new Error(`Failed to fetch order book for ${tokenId}: ${error}`);
    }
  }

  /**
   * Get current price for a token
   */
  async getPrice(tokenId: string, side: 'BUY' | 'SELL' = 'BUY'): Promise<number> {
    try {
      const price = await this.client.getPrice(tokenId, side);
      return parseFloat(price);
    } catch (error) {
      throw new Error(`Failed to fetch price for ${tokenId}: ${error}`);
    }
  }

  /**
   * Get midpoint price for a token
   */
  async getMidpoint(tokenId: string): Promise<number> {
    try {
      const midpoint = await this.client.getMidpoint(tokenId);
      return parseFloat(midpoint);
    } catch (error) {
      throw new Error(`Failed to fetch midpoint for ${tokenId}: ${error}`);
    }
  }

  /**
   * Place a market order (executes immediately at current price)
   * @param order - Market order details
   */
  async placeMarketOrder(order: MarketOrder): Promise<any> {
    await this.ensureInitialized();

    try {
      const marketOrder = await this.client.createMarketOrder({
        tokenID: order.tokenId,
        amount: order.amount,
        side: order.side,
      });

      const signedOrder = await this.client.signOrder(marketOrder);
      const result = await this.client.postOrder(signedOrder, 'FOK'); // Fill or Kill

      console.log(`✓ Market order placed: ${order.side} ${order.amount} USD`);
      return result;
    } catch (error) {
      throw new Error(`Failed to place market order: ${error}`);
    }
  }

  /**
   * Place a limit order (only executes at specified price)
   * @param order - Limit order details
   */
  async placeLimitOrder(order: LimitOrder): Promise<any> {
    await this.ensureInitialized();

    try {
      const limitOrder = await this.client.createOrder({
        tokenID: order.tokenId,
        price: order.price,
        size: order.size,
        side: order.side,
      });

      const signedOrder = await this.client.signOrder(limitOrder);
      const result = await this.client.postOrder(signedOrder, 'GTC'); // Good till cancelled

      console.log(`✓ Limit order placed: ${order.side} ${order.size} shares @ $${order.price}`);
      return result;
    } catch (error) {
      throw new Error(`Failed to place limit order: ${error}`);
    }
  }

  /**
   * Simplified trade method - handles token lookup and order placement
   * @param params - Trade parameters
   */
  async trade(params: TradeParams): Promise<any> {
    await this.ensureInitialized();

    try {
      // Find the market
      const market = await this.getMarket(params.market_slug);
      if (!market) {
        throw new Error(`Market not found: ${params.market_slug}`);
      }

      // Find the token for the specified outcome
      const token = market.tokens.find(
        (t) => t.outcome.toLowerCase() === params.outcome.toLowerCase()
      );

      if (!token) {
        throw new Error(`Outcome "${params.outcome}" not found in market`);
      }

      // Place market order if amount is specified
      if (params.amount) {
        return await this.placeMarketOrder({
          tokenId: token.token_id,
          amount: params.amount,
          side: params.side,
        });
      }

      // Place limit order if price and size are specified
      if (params.price && params.size) {
        return await this.placeLimitOrder({
          tokenId: token.token_id,
          price: params.price,
          size: params.size,
          side: params.side,
        });
      }

      throw new Error('Must specify either amount (market order) or price+size (limit order)');
    } catch (error) {
      throw new Error(`Trade failed: ${error}`);
    }
  }

  /**
   * Cancel a specific order by ID
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.client.cancelOrder(orderId);
      console.log(`✓ Order cancelled: ${orderId}`);
    } catch (error) {
      throw new Error(`Failed to cancel order: ${error}`);
    }
  }

  /**
   * Cancel all open orders
   */
  async cancelAllOrders(): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.client.cancelAll();
      console.log('✓ All orders cancelled');
    } catch (error) {
      throw new Error(`Failed to cancel all orders: ${error}`);
    }
  }

  /**
   * Get all open orders for the current account
   */
  async getOpenOrders(): Promise<any[]> {
    await this.ensureInitialized();

    try {
      const orders = await this.client.getOrders();
      return orders;
    } catch (error) {
      throw new Error(`Failed to fetch open orders: ${error}`);
    }
  }

  /**
   * Get trade history for the current account
   */
  async getTradeHistory(): Promise<any[]> {
    await this.ensureInitialized();

    try {
      const trades = await this.client.getTrades();
      return trades;
    } catch (error) {
      throw new Error(`Failed to fetch trade history: ${error}`);
    }
  }

  /**
   * Get the last trade price for a token
   */
  async getLastTradePrice(tokenId: string): Promise<number> {
    try {
      const price = await this.client.getLastTradePrice(tokenId);
      return parseFloat(price);
    } catch (error) {
      throw new Error(`Failed to fetch last trade price: ${error}`);
    }
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Ensure client is initialized before trading
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/**
 * Factory function to create and initialize a trading client
 */
export async function createTradingClient(
  privateKey: string,
  host?: string
): Promise<PolymarketTradingClient> {
  const client = new PolymarketTradingClient(privateKey, host);
  await client.initialize();
  return client;
}
