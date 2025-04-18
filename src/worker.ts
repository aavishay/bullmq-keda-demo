import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

const worker = new Worker(
  'test-queue',
  async (job) => {
    console.log(`Processing job ${job.id}`);
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 60*1000));
    console.log(`Completed job ${job.id}`);
    return { status: 'completed' };
  },
  { 
    connection,
    concurrency: 1
  }
);

console.log('Worker started...'); 