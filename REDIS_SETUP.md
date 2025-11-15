# Redis Setup Guide

This application uses Redis to manage documents before they are published to Arweave. This ensures that documents are immediately accessible even if Arweave hasn't published them yet.

## Environment Variables

Add the following environment variables to your `.env.local` file:

### Option 1: Redis URL (Recommended)
```env
REDIS_URL=redis://username:password@host:port
```

### Option 2: Individual Connection Parameters (Redis Cloud format)
```env
REDIS_USERNAME=default
REDIS_PASSWORD=your-password
REDIS_HOST=redis-xxxxx.c14.us-east-1-2.ec2.cloud.redislabs.com
REDIS_PORT=11474
```

Example for Redis Cloud:
```env
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-password
REDIS_HOST=redis-11474.c14.us-east-1-2.ec2.cloud.redislabs.com
REDIS_PORT=11474
```

### Optional: Cleanup API Token
```env
CLEANUP_API_TOKEN=your-secret-token-here
```

## How It Works

1. **Document Upload**: When a document is saved, it's immediately stored in Redis with the transaction ID as the key.

2. **Document Access**: When accessing a document via `/document/[txid]`:
   - First checks Redis for the document
   - If not found in Redis, checks Arweave
   - This ensures documents are accessible immediately, even before Arweave publishes them

3. **Publish Status Checking**: The system periodically checks if documents in Redis have been published to Arweave:
   - When a document is confirmed published, it's marked as published in Redis
   - Documents remain in Redis for 7 days after publishing for redundancy
   - After 30 days, unpublished documents expire from Redis

4. **User Transaction IDs**: All transaction IDs for each user (wallet address) are stored separately in Redis for easy retrieval.

## API Endpoints

### Get User Transaction IDs
```
GET /api/user/txids?walletAddress=<wallet_address>
```

### Check Publish Status
```
GET /api/check-publish?transactionId=<txid>
POST /api/check-publish
Body: { "transactionId": "<txid>" }
```

### Cleanup (Check All Pending Documents)
```
POST /api/cleanup
Headers: Authorization: Bearer <CLEANUP_API_TOKEN>
```

## Setting Up Redis

### Local Development
1. Install Redis: https://redis.io/download
2. Start Redis: `redis-server`
3. Configure environment variables (use localhost defaults)

### Production (Cloud Providers)
- **Redis Cloud**: https://redis.com/try-free/
- **Upstash**: https://upstash.com/
- **AWS ElastiCache**: https://aws.amazon.com/elasticache/
- **DigitalOcean**: https://www.digitalocean.com/products/managed-databases

## Scheduled Cleanup

To automatically check and mark documents as published, set up a cron job or scheduled task to call:

```
POST /api/cleanup
Authorization: Bearer <CLEANUP_API_TOKEN>
```

Recommended frequency: Every 5-10 minutes

### Example with Vercel Cron
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cleanup",
    "schedule": "*/10 * * * *"
  }]
}
```

## Troubleshooting

- **Connection Errors**: Verify your Redis connection details and ensure Redis is running
- **Documents Not Found**: Check if documents are in Redis using Redis CLI: `KEYS doc:*`
- **Publish Status**: Use `/api/check-publish` to manually check if a document is published

