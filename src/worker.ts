import { Worker } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

// Safe sleep function that yields every few seconds to avoid being marked as stalled
async function safeSleep(ms: number) {
  const interval = 5000; // 5 seconds
  let elapsed = 0;
  while (elapsed < ms) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    elapsed += interval;
  }
}

// Track if we're processing a job to ensure only one job is processed
let isProcessingJob = false;

const worker = new Worker(
  "test-queue",
  async (job) => {
    // Immediately pause the worker to prevent picking up additional jobs
    if (!isProcessingJob) {
      isProcessingJob = true;
      await worker.pause();
      console.log("Worker paused to process only one job");
    }

    console.log(`Processing job ${job.id}`);
    await safeSleep(5 * 1000); // Simulate 5s of work
    console.log(`Completed job ${job.id}`);
    return { status: "completed" };
  },
  {
    connection,
    concurrency: 1,
    lockDuration: 10 * 1000, // Optional: 10s lock to align with safeSleep
  },
);

// Shared exit function to ensure we exit after processing exactly 1 job
async function exitAfterJob(
  jobId: string | undefined,
  success: boolean,
  error?: Error,
) {
  console.log(`Processed 1 job (${jobId}), exiting...`);
  if (!success && error) {
    console.error(`Job failed:`, error);
  }
  await worker.close();
  process.exit(success ? 0 : 1);
}

// Process one job and exit regardless of outcome
worker.on("completed", async (job) => {
  console.log(`Job ${job.id} completed successfully`);
  await exitAfterJob(job.id, true);
});

worker.on("failed", async (job, err) => {
  await exitAfterJob(job?.id, false, err);
});

console.log("Worker started...");
