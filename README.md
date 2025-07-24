# BullMQ KEDA Demo

A comprehensive demonstration of Kubernetes Event-driven Autoscaling (KEDA) with BullMQ, showcasing how to automatically scale worker pods based on Redis queue metrics.

## 🏗️ Architecture

This project demonstrates a typical job processing architecture:

- **Producer**: Adds jobs to a BullMQ queue stored in Redis
- **Worker**: Processes jobs from the queue (each worker processes exactly one job then exits)
- **KEDA**: Monitors Redis queue metrics and automatically scales worker jobs
- **Redis**: Message broker and queue storage

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+**
- **Docker**
- **Kubernetes cluster** (Minikube, Docker Desktop, or cloud provider)
- **kubectl** configured to access your cluster
- **Helm 3.x**

## 🚀 Quick Start

### 1. Environment Setup

#### Option A: Minikube
```bash
# Install and start Minikube
minikube start

# Enable Docker environment
eval $(minikube docker-env)
```

#### Option B: Docker Desktop
Enable Kubernetes in Docker Desktop settings.

### 2. Install KEDA

```bash
# Add KEDA Helm repository
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

# Install KEDA
helm install keda kedacore/keda --namespace keda --create-namespace

# Verify KEDA installation
kubectl get pods -n keda
```

### 3. Build and Deploy

```bash
# Build the application Docker image
docker build -t bullmq-worker:latest .

# Deploy all Kubernetes resources
kubectl apply -f k8s/

# Verify deployment
kubectl get all -n bullmq-test
```

### 4. Watch the Magic

```bash
# Monitor scaling in real-time
kubectl get pods -n bullmq-test -w

# In another terminal, check ScaledJob status
kubectl get scaledjobs -n bullmq-test -w
```

## 📁 Project Structure

```
bullmq-keda-demo/
├── src/
│   ├── worker.ts          # BullMQ worker implementation
│   └── producer.ts        # Job producer
├── k8s/
│   ├── namespace.yaml           # Kubernetes namespace
│   ├── redis-deployment.yaml   # Redis database
│   ├── redis-service.yaml      # Redis service
│   ├── deployment.yaml         # Worker deployment (unused - kept for reference)
│   ├── keda-scaledjob.yaml     # KEDA auto-scaling configuration
│   ├── producer-job.yaml       # Producer job
│   └── README.md               # K8s deployment guide
├── Dockerfile                  # Container image definition
├── package.json               # Node.js dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## 🔧 Configuration

### KEDA ScaledJob Configuration

The KEDA ScaledJob is configured to:
- **Scale Range**: 0-50 worker pods
- **Polling Interval**: 10 seconds
- **Triggers**: Both `wait` and `active` Redis lists
- **Scaling Strategy**: Sum of all triggers

### Worker Behavior

Each worker:
- Processes exactly **one job** then exits
- Simulates **5 seconds** of work per job
- Uses **concurrency of 1** (one job at a time)
- Automatically pauses to prevent processing multiple jobs

### Producer Configuration

The producer:
- Adds **100 test jobs** to the queue
- Each job contains an index for identification

## 🧑‍💻 Local Development

### Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Running Locally

```bash
# Start Redis
docker run -d -p 6379:6379 --name redis redis:alpine

# Start worker (in one terminal)
npm run start:worker

# Start producer (in another terminal)
npm run start:producer
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start:worker` - Run worker locally
- `npm run start:producer` - Run producer locally

## 📊 Monitoring and Debugging

### Check Queue Status

```bash
# Get Redis pod name
REDIS_POD=$(kubectl get pod -l app=redis -n bullmq-test -o jsonpath='{.items[0].metadata.name}')

# Check queue lengths
kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli LLEN bull:test-queue:wait
kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli LLEN bull:test-queue:active
```

### View Logs

```bash
# Worker logs
kubectl logs -l scaledjob.keda.sh/name=bullmq-scaledjob -n bullmq-test

# Producer logs
kubectl logs job/bullmq-producer -n bullmq-test

# Redis logs
kubectl logs deployment/redis -n bullmq-test

# KEDA operator logs
kubectl logs -l app=keda-operator -n keda
```

### Monitor Scaling

```bash
# Watch pods being created/destroyed
kubectl get pods -n bullmq-test -w

# Check ScaledJob status
kubectl describe scaledjob bullmq-scaledjob -n bullmq-test

# View KEDA metrics
kubectl get hpa -n bullmq-test
```

## 🔄 Development Workflow

### After Code Changes

```bash
# Rebuild Docker image
docker build -t bullmq-worker:latest .

# Clean up existing jobs (if any)
kubectl delete jobs -l scaledjob.keda.sh/name=bullmq-scaledjob -n bullmq-test

# Restart producer to add new jobs
kubectl delete job bullmq-producer -n bullmq-test
kubectl apply -f k8s/producer-job.yaml
```

### After K8s Configuration Changes

```bash
# Apply updated configurations
kubectl apply -f k8s/

# Or apply specific files
kubectl apply -f k8s/keda-scaledjob.yaml
```

## 🧪 Testing Scenarios

### Test Auto-scaling

1. **Scale Up Test**:
   ```bash
   # Add jobs to trigger scaling
   kubectl apply -f k8s/producer-job.yaml
   
   # Watch workers scale up
   kubectl get pods -n bullmq-test -w
   ```

2. **Scale Down Test**:
   ```bash
   # Wait for queue to empty
   # Workers should automatically scale down to 0
   ```

3. **Load Test**:
   ```bash
   # Modify producer.ts to add more jobs
   # Observe scaling behavior under high load
   ```

## 🛠️ Troubleshooting

### Common Issues

1. **Workers not scaling**:
   - Check KEDA operator logs: `kubectl logs -l app=keda-operator -n keda`
   - Verify Redis connectivity: `kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli ping`
   - Check ScaledJob configuration: `kubectl describe scaledjob -n bullmq-test`

2. **Jobs not being processed**:
   - Check worker logs for errors
   - Verify Docker image is available: `kubectl describe pod -n bullmq-test`
   - Ensure Redis service is accessible

3. **Image pull errors** (Minikube):
   - Ensure you're using Minikube's Docker daemon: `eval $(minikube docker-env)`
   - Rebuild the image after switching Docker context

### Reset Everything

```bash
# Delete all resources
kubectl delete namespace bullmq-test

# Redeploy
kubectl apply -f k8s/
```

## 🏗️ How It Works

1. **Job Creation**: Producer adds 100 jobs to the `test-queue`
2. **Queue Monitoring**: KEDA monitors Redis lists (`bull:test-queue:wait` and `bull:test-queue:active`)
3. **Auto-scaling**: When jobs are detected, KEDA creates worker Job pods
4. **Job Processing**: Each worker processes exactly one job (5-second simulation) then exits
5. **Scale Down**: When queue is empty, no new workers are created
6. **Cleanup**: Kubernetes automatically removes completed Job pods

## 📚 Learn More

- [KEDA Documentation](https://keda.sh/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Kubernetes Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [Redis Lists](https://redis.io/docs/data-types/lists/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License - see the package.json file for details.