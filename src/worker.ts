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

// Process one job and exit
worker.on('completed', async (job) => {
  console.log(`Job ${job.id} completed, exiting...`);
  await worker.close();
  process.exit(0);
});

worker.on('failed', async (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
  await worker.close();
  process.exit(1);
});

console.log('Worker started...'); 