import axios, { AxiosInstance } from 'axios';

/**
 * Manifold Markets Trading Client
 * Wrapper for the Manifold Markets API to enable programmatic trading
 * Note: Manifold uses play money (Mana) - not real currency
 */

export interface ManifoldBet {
  amount: number; // Mana amount (before fees)
  contractId: string; // Market ID
  outcome?: 'YES' | 'NO'; // Default: YES
  limitProb?: number; // For limit orders: 0.01-0.99
  expiresAt?: number; // Unix timestamp for expiration
  expiresMillisAfter?: number; // Milliseconds until expiration
  dryRun?: boolean; // Simulate without placing
}

export interface ManifoldMarket {
  id: string;
  creatorId: string;
  creatorUsername: string;
  creatorName: string;
  createdTime: number;
  creatorAvatarUrl?: string;
  closeTime?: number;
  question: string;
  tags: string[];
  url: string;
  outcomeType: 'BINARY' | 'FREE_RESPONSE' | 'MULTIPLE_CHOICE' | 'NUMERIC' | 'PSEUDO_NUMERIC';
  mechanism: string;
  probability?: number; // For binary markets
  pool?: Record<string, number>;
  volume: number;
  volume24Hours: number;
  isResolved: boolean;
  resolution?: string;
  resolutionTime?: number;
  lastUpdatedTime?: number;
}

export interface ManifoldUser {
  id: string;
  createdTime: number;
  name: string;
  username: string;
  url: string;
  avatarUrl?: string;
  bio?: string;
  balance: number;
  totalDeposits: number;
  profitCached?: {
    daily: number;
    weekly: number;
    monthly: number;
    allTime: number;
  };
}

export interface ManifoldBetResult {
  betId: string;
  contractId: string;
  amount: number;
  shares: number;
  probBefore: number;
  probAfter: number;
  fees: {
    creatorFee: number;
    platformFee: number;
    liquidityFee: number;
  };
}

export class ManifoldTradingClient {
  private apiKey: string;
  private client: AxiosInstance;
  private baseUrl: string = 'https://api.manifold.markets/v0';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✓ Manifold trading client initialized');
  }

  async getMarkets(params?: {
    limit?: number;
    before?: string;
    userId?: string;
    groupId?: string;
  }): Promise<ManifoldMarket[]> {
    try {
      const response = await this.client.get('/markets', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch markets: ${error}`);
    }
  }

  async getMarket(marketId: string): Promise<ManifoldMarket> {
    try {
      const response = await this.client.get(`/market/${marketId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch market ${marketId}: ${error}`);
    }
  }

  async searchMarkets(
    query: string,
    params?: {
      limit?: number;
      offset?: number;
      filter?: 'all' | 'open' | 'closed' | 'resolved';
      sort?: 'newest' | 'score' | 'liquidity' | 'volume';
    }
  ): Promise<ManifoldMarket[]> {
    try {
      const response = await this.client.get('/search-markets', {
        params: { term: query, ...params },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search markets: ${error}`);
    }
  }

  async getUser(username: string): Promise<ManifoldUser> {
    try {
      const response = await this.client.get(`/user/${username}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch user ${username}: ${error}`);
    }
  }

  async getMe(): Promise<ManifoldUser> {
    try {
      const response = await this.client.get('/me');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch user info: ${error}`);
    }
  }

  async placeBet(bet: ManifoldBet): Promise<ManifoldBetResult> {
    try {
      const response = await this.client.post('/bet', bet);
      console.log(`✓ Bet placed: ${bet.outcome || 'YES'} M$${bet.amount} on ${bet.contractId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to place bet: ${error.response?.data?.message || error.message}`);
    }
  }

  async placeMultiBet(contractId: string, answers: string[], amount: number): Promise<any> {
    try {
      const response = await this.client.post('/multi-bet', {
        contractId,
        answers,
        amount,
      });
      console.log(`✓ Multi-bet placed: M$${amount} on ${answers.length} answers`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to place multi-bet: ${error.response?.data?.message || error.message}`);
    }
  }

  async cancelBet(betId: string): Promise<void> {
    try {
      await this.client.post(`/bet/cancel/${betId}`);
      console.log(`✓ Bet cancelled: ${betId}`);
    } catch (error: any) {
      throw new Error(`Failed to cancel bet: ${error.response?.data?.message || error.message}`);
    }
  }

  async sellShares(
    marketId: string,
    outcome?: 'YES' | 'NO',
    shares?: number
  ): Promise<any> {
    try {
      const payload: any = {};
      if (outcome) payload.outcome = outcome;
      if (shares !== undefined) payload.shares = shares;

      const response = await this.client.post(`/market/${marketId}/sell`, payload);
      console.log(`✓ Shares sold in market ${marketId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to sell shares: ${error.response?.data?.message || error.message}`);
    }
  }

  async getBets(
    marketId?: string,
    params?: {
      userId?: string;
      username?: string;
      contractSlug?: string;
      limit?: number;
      before?: string;
    }
  ): Promise<any[]> {
    try {
      const endpoint = marketId ? `/bets?contractId=${marketId}` : '/bets';
      const response = await this.client.get(endpoint, { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch bets: ${error}`);
    }
  }

  async getUserPositions(userId: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/user/${userId}/positions`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch positions: ${error}`);
    }
  }

  async bet(
    marketSlug: string,
    outcome: 'YES' | 'NO',
    amount: number,
    limitProb?: number
  ): Promise<ManifoldBetResult> {
    try {
      let market: ManifoldMarket;
      try {
        market = await this.getMarket(marketSlug);
      } catch {
        const markets = await this.searchMarkets(marketSlug, { limit: 1 });
        if (markets.length === 0) {
          throw new Error(`Market not found: ${marketSlug}`);
        }
        market = markets[0];
      }

      if (market.isResolved) {
        throw new Error(`Market is already resolved: ${market.question}`);
      }

      if (market.closeTime && market.closeTime < Date.now()) {
        throw new Error(`Market is closed: ${market.question}`);
      }

      return await this.placeBet({
        contractId: market.id,
        outcome,
        amount,
        limitProb,
      });
    } catch (error) {
      throw new Error(`Bet failed: ${error}`);
    }
  }

  async getBalance(): Promise<number> {
    try {
      const user = await this.getMe();
      return user.balance;
    } catch (error) {
      throw new Error(`Failed to fetch balance: ${error}`);
    }
  }

  async getProfitStats(): Promise<ManifoldUser['profitCached']> {
    try {
      const user = await this.getMe();
      return user.profitCached;
    } catch (error) {
      throw new Error(`Failed to fetch profit stats: ${error}`);
    }
  }
}

export function createManifoldClient(apiKey: string): ManifoldTradingClient {
  return new ManifoldTradingClient(apiKey);
}
