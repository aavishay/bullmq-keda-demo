# BullMQ KEDA Playground

This is a playground project to test KEDA (Kubernetes Event-driven Autoscaling) with BullMQ.

## Prerequisites

- Node.js 18+
- Docker
- Minikube
- kubectl configured to access your cluster
- Helm

## Minikube Setup

1. Install Minikube:
   ```bash
   # For Arch Linux
   sudo pacman -S minikube
   
   # Or download directly
   curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
   sudo install minikube-linux-amd64 /usr/local/bin/minikube
   ```

2. Start Minikube:
   ```bash
   minikube start
   ```

3. Install KEDA:
   ```bash
   helm repo add kedacore https://kedacore.github.io/charts
   helm repo update
   helm install keda kedacore/keda --namespace keda --create-namespace
   ```

## Kubernetes Deployment

1. Build the Docker image and make it available to Minikube:
   ```bash
   eval $(minikube docker-env)
   docker build -t bullmq-worker:latest .
   ```

2. Create the namespace:
   ```bash
   kubectl create namespace bullmq-test
   ```

3. Apply the Kubernetes manifests:
   ```bash
   kubectl apply -f k8s/redis.yaml -n bullmq-test
   kubectl apply -f k8s/keda-scaledjob.yaml -n bullmq-test
   kubectl apply -f k8s/producer-job.yaml -n bullmq-test
   ```

4. Monitor the scaling:
   ```bash
   kubectl get pods -n bullmq-test -w
   ```

## Updating Components

### After Code Changes

1. Rebuild and redeploy the worker:
   ```bash
   # Rebuild the Docker image
   eval $(minikube docker-env)
   docker build -t bullmq-worker:latest .
   
   # Delete old worker jobs
   kubectl delete job -l scaledjob.keda.sh/name=bullmq-scaledjob -n bullmq-test
   ```

2. Run the producer to add jobs:
   ```bash
   # Delete the old producer job if it exists
   kubectl delete job bullmq-producer -n bullmq-test
   
   # Create a new producer job
   kubectl apply -f k8s/producer-job.yaml -n bullmq-test
   ```

### After Configuration Changes

1. Update KEDA configuration:
   ```bash
   kubectl apply -f k8s/keda-scaledjob.yaml -n bullmq-test
   ```

## How it Works

- The producer adds jobs to a BullMQ queue
- The worker processes these jobs with a concurrency of 1 (one job at a time)
- KEDA monitors the queue length and creates new worker jobs based on the number of pending jobs
- When there is 1 or more jobs in the wait queue, KEDA will create new worker jobs
- Each worker job processes one job and then exits
- When the queue is empty, no new worker jobs are created

## Configuration

- The worker processes each job for 60 seconds to simulate work
- Worker concurrency is set to 1 (one job at a time)
- KEDA is configured to:
  - Scale up when there is 1 or more jobs in the wait queue
  - Scale between 0 and 10 replicas
  - Poll the queue every 10 seconds
  - Keep history of 100 successful and failed jobs

## Troubleshooting

1. If the worker jobs are not starting, check the logs:
   ```bash
   kubectl logs -l scaledjob.keda.sh/name=bullmq-scaledjob -n bullmq-test
   ```

2. To check the Redis queue lengths:
   ```bash
   kubectl exec -it $(kubectl get pod -l app=redis -n bullmq-test -o jsonpath='{.items[0].metadata.name}') -n bullmq-test -- redis-cli LLEN bull:test-queue:wait
   kubectl exec -it $(kubectl get pod -l app=redis -n bullmq-test -o jsonpath='{.items[0].metadata.name}') -n bullmq-test -- redis-cli LLEN bull:test-queue:active
   ```

3. To check KEDA scaling status:
   ```bash
   kubectl get scaledjob -n bullmq-test
   ```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start Redis locally:
   ```bash
   docker run -p 6379:6379 redis:alpine
   ```

3. Start the worker:
   ```bash
   npm run start:worker
   ```

4. In another terminal, start the producer:
   ```bash
   npm run start:producer
   ```

