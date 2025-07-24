# Kubernetes Resources for BullMQ KEDA Demo

This directory contains all the Kubernetes resources needed to deploy and run the BullMQ KEDA autoscaling demonstration.

## 📁 Resource Files Overview

| File | Resource Type | Purpose |
|------|---------------|---------|
| `namespace.yaml` | Namespace | Creates the `bullmq-test` namespace for resource isolation |
| `redis-deployment.yaml` | Deployment | Redis database for queue storage |
| `redis-service.yaml` | Service | Internal service for Redis connectivity |
| `deployment.yaml` | Deployment | Worker deployment (reference only - not used with ScaledJob) |
| `keda-scaledjob.yaml` | ScaledJob | KEDA autoscaling configuration for workers |
| `producer-job.yaml` | Job | One-time job to populate queue with test data |

## 🚀 Deployment Guide

### Prerequisites

1. **KEDA installed** in your cluster:
   ```bash
   helm repo add kedacore https://kedacore.github.io/charts
   helm repo update
   helm install keda kedacore/keda --namespace keda --create-namespace
   ```

2. **Docker image built** and available to your cluster:
   ```bash
   # For Minikube
   eval $(minikube docker-env)
   docker build -t bullmq-worker:latest .
   
   # For other clusters, push to a registry
   docker tag bullmq-worker:latest your-registry/bullmq-worker:latest
   docker push your-registry/bullmq-worker:latest
   ```

### Step-by-Step Deployment

#### Method 1: Deploy All at Once (Recommended)

```bash
# Deploy all resources
kubectl apply -f .

# Verify deployment
kubectl get all -n bullmq-test
```

#### Method 2: Step-by-Step Deployment

1. **Create Namespace**:
   ```bash
   kubectl apply -f namespace.yaml
   kubectl get namespace bullmq-test
   ```

2. **Deploy Redis**:
   ```bash
   kubectl apply -f redis-deployment.yaml
   kubectl apply -f redis-service.yaml
   
   # Wait for Redis to be ready
   kubectl wait --for=condition=available deployment/redis -n bullmq-test --timeout=60s
   ```

3. **Deploy KEDA ScaledJob**:
   ```bash
   kubectl apply -f keda-scaledjob.yaml
   
   # Verify ScaledJob creation
   kubectl get scaledjobs -n bullmq-test
   ```

4. **Run Producer to Add Jobs**:
   ```bash
   kubectl apply -f producer-job.yaml
   
   # Watch job completion
   kubectl get job bullmq-producer -n bullmq-test -w
   ```

## 📊 Monitoring and Verification

### Check Deployment Status

```bash
# Overview of all resources
kubectl get all -n bullmq-test

# Detailed status
kubectl get pods,jobs,scaledjobs,services -n bullmq-test -o wide
```

### Monitor Auto-scaling

```bash
# Watch worker pods being created/destroyed
kubectl get pods -n bullmq-test -w

# Monitor ScaledJob status
kubectl get scaledjobs -n bullmq-test -w

# Check KEDA metrics
kubectl describe scaledjob bullmq-scaledjob -n bullmq-test
```

### Check Queue Status

```bash
# Get Redis pod name
REDIS_POD=$(kubectl get pod -l app=redis -n bullmq-test -o jsonpath='{.items[0].metadata.name}')

# Check queue lengths
echo "Jobs waiting: $(kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli LLEN bull:test-queue:wait)"
echo "Jobs active: $(kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli LLEN bull:test-queue:active)"

# List all Bull queues
kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli KEYS "bull:*"
```

## 📝 View Logs

### Worker Logs
```bash
# All worker jobs
kubectl logs -l scaledjob.keda.sh/name=bullmq-scaledjob -n bullmq-test

# Specific worker job
kubectl logs job/bullmq-scaledjob-xxxxx -n bullmq-test

# Follow logs in real-time
kubectl logs -f -l scaledjob.keda.sh/name=bullmq-scaledjob -n bullmq-test
```

### Producer Logs
```bash
kubectl logs job/bullmq-producer -n bullmq-test
```

### Redis Logs
```bash
kubectl logs deployment/redis -n bullmq-test
```

### KEDA Logs
```bash
kubectl logs -l app=keda-operator -n keda
kubectl logs -l app=keda-metrics-apiserver -n keda
```

## 🔧 Configuration Details

### KEDA ScaledJob Configuration

The `keda-scaledjob.yaml` configures:

- **Scaling Range**: 0-50 worker pods
- **Polling Interval**: 10 seconds
- **Job History**: 10 successful, 10 failed jobs kept
- **Scaling Strategy**: Sum of all trigger metrics
- **Triggers**:
  - `bull:test-queue:wait` - Jobs waiting to be processed
  - `bull:test-queue:active` - Jobs currently being processed

### Resource Limits

Each worker pod has:
- **CPU**: 100m request, 500m limit
- **Memory**: 128Mi request, 256Mi limit
- **Restart Policy**: Never (jobs exit after processing one job)

## 🔄 Common Operations

### Restart Producer
```bash
# Delete existing producer job
kubectl delete job bullmq-producer -n bullmq-test

# Create new producer job
kubectl apply -f producer-job.yaml

# Or do both in one command
kubectl delete job bullmq-producer -n bullmq-test && kubectl apply -f producer-job.yaml
```

### Clear All Jobs
```bash
# Delete all worker jobs
kubectl delete jobs -l scaledjob.keda.sh/name=bullmq-scaledjob -n bullmq-test

# Clear Redis queues
REDIS_POD=$(kubectl get pod -l app=redis -n bullmq-test -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli FLUSHALL
```

### Update ScaledJob Configuration
```bash
# Edit the configuration
kubectl apply -f keda-scaledjob.yaml

# Check if changes took effect
kubectl describe scaledjob bullmq-scaledjob -n bullmq-test
```

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### 1. Workers Not Scaling Up

**Symptoms**: Jobs in queue but no worker pods created

**Diagnosis**:
```bash
# Check KEDA operator logs
kubectl logs -l app=keda-operator -n keda

# Check ScaledJob status
kubectl describe scaledjob bullmq-scaledjob -n bullmq-test

# Verify Redis connectivity
kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli ping
```

**Solutions**:
- Ensure KEDA is running: `kubectl get pods -n keda`
- Check Redis service is accessible
- Verify queue names match in ScaledJob configuration

#### 2. Image Pull Errors

**Symptoms**: `ImagePullBackOff` or `ErrImagePull` status

**Diagnosis**:
```bash
kubectl describe pod <pod-name> -n bullmq-test
```

**Solutions**:
- For Minikube: Ensure using Minikube's Docker daemon
- For other clusters: Push image to accessible registry
- Update image name in YAML files if using external registry

#### 3. Jobs Failing to Complete

**Symptoms**: Worker jobs fail or get stuck

**Diagnosis**:
```bash
# Check worker logs
kubectl logs -l scaledjob.keda.sh/name=bullmq-scaledjob -n bullmq-test

# Check Redis connectivity from worker
kubectl exec -it <worker-pod> -n bullmq-test -- nc -zv redis-service 6379
```

**Solutions**:
- Verify Redis service is running
- Check environment variables in worker pods
- Ensure network policies allow communication

#### 4. Redis Connection Issues

**Symptoms**: Workers can't connect to Redis

**Diagnosis**:
```bash
# Test Redis service resolution
kubectl run test-pod --image=busybox -n bullmq-test --rm -it -- nslookup redis-service

# Test Redis port
kubectl run test-pod --image=busybox -n bullmq-test --rm -it -- nc -zv redis-service 6379
```

**Solutions**:
- Check Redis pod status: `kubectl get pods -l app=redis -n bullmq-test`
- Verify service configuration: `kubectl get svc redis-service -n bullmq-test`
- Check DNS resolution in cluster

#### 5. KEDA Not Responding to Queue Changes

**Symptoms**: Queue has jobs but KEDA doesn't scale

**Diagnosis**:
```bash
# Check KEDA metrics server
kubectl get apiservice v1beta1.external.metrics.k8s.io

# Test KEDA scaler directly
kubectl logs -l app=keda-operator -n keda | grep redis
```

**Solutions**:
- Restart KEDA operator: `kubectl rollout restart deployment/keda-operator -n keda`
- Check ScaledJob triggers configuration
- Verify Redis authentication (if enabled)

### Health Check Commands

```bash
# Complete system health check
echo "=== Namespace ==="
kubectl get namespace bullmq-test

echo "=== Pods ==="
kubectl get pods -n bullmq-test

echo "=== Services ==="
kubectl get svc -n bullmq-test

echo "=== ScaledJobs ==="
kubectl get scaledjobs -n bullmq-test

echo "=== Jobs ==="
kubectl get jobs -n bullmq-test

echo "=== KEDA Status ==="
kubectl get pods -n keda

echo "=== Queue Status ==="
REDIS_POD=$(kubectl get pod -l app=redis -n bullmq-test -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli LLEN bull:test-queue:wait
kubectl exec -it $REDIS_POD -n bullmq-test -- redis-cli LLEN bull:test-queue:active
```

## 🧹 Cleanup

### Remove All Resources
```bash
# Delete the entire namespace (removes everything)
kubectl delete namespace bullmq-test

# Or delete resources individually
kubectl delete -f .
```

### Remove KEDA (if needed)
```bash
helm uninstall keda -n keda
kubectl delete namespace keda
```

## 🔍 Understanding the Flow

1. **Producer Job** runs once and adds 100 jobs to Redis queue
2. **KEDA** detects jobs in `bull:test-queue:wait` list
3. **ScaledJob** creates worker Job pods based on queue length
4. **Worker pods** process one job each (5-second simulation) then exit
5. **KEDA** continues monitoring and scaling as needed
6. **Cleanup** happens automatically as jobs complete

## 📚 Additional Resources

- [KEDA ScaledJob Documentation](https://keda.sh/docs/2.12/concepts/scaling-jobs/)
- [KEDA Redis Scaler](https://keda.sh/docs/2.12/scalers/redis/)
- [BullMQ Queue Patterns](https://docs.bullmq.io/patterns/producer-consumer)
- [Kubernetes Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)