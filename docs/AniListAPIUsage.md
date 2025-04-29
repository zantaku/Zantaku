# AniList API Usage Guide

## Rate Limiting Issue

AniList API has imposed rate limits to ensure fair usage of their service:

- **Current temporary limit:** 30 requests per minute (reduced from normal 90 req/min)
- When this limit is exceeded, you'll receive a 429 (Too Many Requests) response
- The response includes headers like `Retry-After` and `X-RateLimit-Reset` to tell you when to try again

This is especially important for client-side applications where many users might be sharing the same API credentials, causing collective rate limiting issues.

## Improved API Utilities

We've implemented several improvements to handle these rate limits properly:

### 1. Rate Limited Axios

The `rateLimitedAxios` function in `utils/api.ts` handles:

- Client-side rate limiting to avoid hitting server limits
- Proper handling of 429 responses with respect for the `Retry-After` header
- Automatic retries with exponential backoff
- Response caching to avoid redundant requests
- Parsing of rate limit headers to provide debug information

```typescript
// Example usage
import { rateLimitedAxios } from '../utils/api';

const query = `query { Viewer { name } }`;
const response = await rateLimitedAxios(query, {}, token);
```

### 2. Batched Queries

Rather than making multiple separate requests, use the `batchQueries` function to combine multiple queries into a single request:

```typescript
import { batchQueries } from '../utils/api';

const userQuery = `query { Viewer { name } }`;
const trendingQuery = `query { Page { media(sort: TRENDING_DESC) { id title { userPreferred } } } }`;

const batchedQueries = [
  { query: userQuery, alias: 'user' },
  { query: trendingQuery, alias: 'trending' }
];

const { data } = await batchQueries(batchedQueries, token);

// Access data with aliases
console.log(data.user.Viewer.name);
console.log(data.trending.Page.media);
```

### 3. Response Caching

Both functions implement response caching to avoid redundant API calls:

- Default cache duration is 5 minutes
- Cached by query and variables
- Automatically used unless disabled

## Best Practices

1. **Use Batched Queries:** Always combine related queries into a single request
2. **Cache Appropriately:** Enable caching for non-volatile data
3. **Implement Pagination:** Only request what you need initially, then fetch more as needed
4. **Avoid Redundant Fields:** Only request the fields you actually need
5. **Add Delays Between User Actions:** Implement debounce for search inputs and user interactions
6. **Handle Errors Gracefully:** Show friendly messages when rate limits are hit

## Example Implementation

Check `utils/apiUsageExample.ts` for complete examples of:

- Single queries with rate limiting
- Batched queries for dashboard data
- API status checking

## Monitoring Usage

You can monitor rate limit status through the console logs which will show:

```
Rate limit: 25/30 remaining
```

If you see:

```
WARNING: Approaching AniList's temporary rate limit (30 req/min)
```

It means you're close to hitting the limit and should consider optimizing your queries further.

## Fallback Strategy

When rate limiting occurs, implement a graceful fallback:

1. Show cached data if available
2. Display a friendly message to the user
3. Implement a retry mechanism with increasing delays
4. Provide alternative content while waiting

By following these guidelines, you'll provide a better user experience and avoid disruptions due to rate limiting. 