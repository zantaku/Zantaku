import axios, { AxiosError, AxiosResponse } from 'axios';
import { ANILIST_GRAPHQL_ENDPOINT } from '../constants/auth';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const MAX_REQUESTS = 30; // ⚠️ AniList's rate limit is temporarily reduced to 30 requests per minute
let requestTimestamps: number[] = [];
let globalResetTime: number | null = null;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface GraphQLResponse {
  data?: {
    [key: string]: any;
  };
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
    status?: number;
  }>;
}

interface BatchedQuery {
  query: string;
  variables?: any;
  alias?: string;
}

// Cache storage
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Generate a cache key from query and variables
const generateCacheKey = (query: string, variables?: any): string => {
  return `${query}:${JSON.stringify(variables || {})}`;
};

/**
 * Batch multiple GraphQL queries into a single request to reduce API calls
 * Each query should have a unique alias in the format:
 * query GetData1 {...}, query GetData2 {...}, etc.
 */
export const batchQueries = async (
  queries: BatchedQuery[],
  token?: string,
  useCache = true
): Promise<Record<string, any>> => {
  if (queries.length === 0) return {};
  
  // Check if all queries are in cache
  if (useCache) {
    const allCachedData: Record<string, any> = {};
    let allCached = true;
    
    for (const { query, variables, alias } of queries) {
      const cacheKey = generateCacheKey(query, variables);
      const cachedItem = cache[cacheKey];
      
      if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_TTL) {
        // Extract just the data we need from the cached response
        const queryName = alias || Object.keys(cachedItem.data.data)[0];
        allCachedData[queryName] = cachedItem.data.data[queryName];
      } else {
        allCached = false;
        break;
      }
    }
    
    if (allCached) {
      console.log('Using cached responses for all batched queries');
      return { data: allCachedData };
    }
  }
  
  // Create combined query with aliases
  let combinedQuery = "";
  for (let i = 0; i < queries.length; i++) {
    const { query, alias } = queries[i];
    // Check if the query has an existing alias
    if (alias && !query.includes(alias + ':')) {
      // Add the alias before the first '{'
      const indexOfFirstBrace = query.indexOf('{');
      if (indexOfFirstBrace !== -1) {
        const queryWithAlias = 
          query.slice(0, indexOfFirstBrace) + 
          `{ ${alias}: ` + 
          query.slice(indexOfFirstBrace + 1);
        combinedQuery += queryWithAlias;
      } else {
        combinedQuery += query;
      }
    } else {
      combinedQuery += query;
    }
  }
  
  // Combine all variables
  const combinedVariables: Record<string, any> = {};
  for (let i = 0; i < queries.length; i++) {
    const { variables } = queries[i];
    if (variables) {
      Object.keys(variables).forEach(key => {
        // Add index to variable names to avoid conflicts
        combinedVariables[`${key}_${i}`] = variables[key];
      });
    }
  }
  
  // Execute the combined query
  const response = await rateLimitedAxios(combinedQuery, combinedVariables, token, 0, useCache);
  
  // Cache individual query results
  if (useCache && response.data) {
    for (const { query, variables } of queries) {
      const cacheKey = generateCacheKey(query, variables);
      cache[cacheKey] = {
        data: response,
        timestamp: Date.now()
      };
    }
  }
  
  return response;
};

export const rateLimitedAxios = async (
  query: string, 
  variables?: any, 
  token?: string,
  retryCount = 0,
  useCache = true
): Promise<GraphQLResponse> => {
  // Check if we're in a global cooling period due to rate limiting
  if (globalResetTime !== null) {
    const now = Date.now();
    if (now < globalResetTime) {
      const waitTime = globalResetTime - now;
      console.log(`Waiting for rate limit reset: ${waitTime}ms remaining`);
      await sleep(waitTime + 100); // Add a small buffer
      globalResetTime = null;
    }
  }

  // Check cache first
  if (useCache) {
    const cacheKey = generateCacheKey(query, variables);
    const cachedItem = cache[cacheKey];
    
    if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_TTL) {
      console.log('Using cached response');
      return cachedItem.data;
    }
  }

  // Remove timestamps older than the rate limit window
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(timestamp => 
    now - timestamp < RATE_LIMIT_WINDOW
  );

  // If we've hit the rate limit, wait until we can make another request
  if (requestTimestamps.length >= MAX_REQUESTS) {
    const oldestTimestamp = requestTimestamps[0];
    const timeToWait = RATE_LIMIT_WINDOW - (now - oldestTimestamp) + 100; // Add small buffer
    console.log(`Local rate limit reached, waiting ${timeToWait}ms`);
    await sleep(timeToWait);
    // Clear the timestamps after waiting
    requestTimestamps = [];
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios.post(
      ANILIST_GRAPHQL_ENDPOINT,
      {
        query,
        variables,
      },
      {
        headers,
        timeout: 10000, // 10 second timeout
      }
    );

    // Parse rate limit headers
    updateRateLimitFromHeaders(response);

    // Add current timestamp to the list
    requestTimestamps.push(now);

    // Cache the response if appropriate
    if (useCache) {
      const cacheKey = generateCacheKey(query, variables);
      cache[cacheKey] = {
        data: response.data,
        timestamp: Date.now()
      };
    }

    if (response.data.errors) {
      console.error('GraphQL Errors:', response.data.errors);
      throw new Error(response.data.errors[0]?.message || 'GraphQL Error');
    }

    // Return the entire response data - let the caller handle the structure
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // Handle 429 Too Many Requests errors
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
        const resetTime = parseInt(error.response.headers['x-ratelimit-reset'] || '0', 10);
        
        // Calculate how long to wait
        let waitTime = retryAfter * 1000;
        if (resetTime) {
          const resetDate = new Date(resetTime * 1000);
          waitTime = Math.max(waitTime, resetDate.getTime() - Date.now());
        }
        
        console.log(`Rate limited by server. Waiting ${waitTime}ms before retrying`);
        
        // Set a global cooldown period
        globalResetTime = Date.now() + waitTime + 1000; // Add 1 second buffer
        
        // Wait and retry
        await sleep(waitTime);
        return rateLimitedAxios(query, variables, token, retryCount + 1, useCache);
      }
      
      // Handle other network errors
      if ((error.code === 'ECONNABORTED' || error.message.includes('timeout') || error.message.includes('network')) 
          && retryCount < 3) {
        const waitTime = 1000 * Math.pow(2, retryCount); // Exponential backoff: 1s, 2s, 4s
        console.log(`Request failed (${error.message}), retrying in ${waitTime}ms (${retryCount + 1}/3)...`);
        await sleep(waitTime);
        return rateLimitedAxios(query, variables, token, retryCount + 1, useCache);
      }
    }
    throw error;
  }
};

// Helper function to parse and update rate limit information from response headers
function updateRateLimitFromHeaders(response: AxiosResponse) {
  try {
    const limit = parseInt(response.headers['x-ratelimit-limit'] || '30', 10);
    const remaining = parseInt(response.headers['x-ratelimit-remaining'] || '0', 10);
    
    // According to docs, when 'x-ratelimit-remaining' shows 60 but the limit is 30,
    // we've actually hit the temporary lower limit
    if (limit > 30 && remaining <= 60) {
      console.log('WARNING: Approaching AniList\'s temporary rate limit (30 req/min)');
    }
    
    console.log(`Rate limit: ${remaining}/${limit} remaining`);
  } catch (e) {
    console.error('Error parsing rate limit headers:', e);
  }
} 