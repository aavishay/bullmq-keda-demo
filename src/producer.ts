import { Queue } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

const queue = new Queue("test-queue", { connection });

async function addJobs() {
  for (let i = 0; i < 100; i++) {
    await queue.add("test-job", { index: i });
    console.log(`Added job ${i}`);
  }
}

addJobs()
  .then(() => {
    console.log("All jobs added");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error adding jobs:", err);
    process.exit(1);
  });
