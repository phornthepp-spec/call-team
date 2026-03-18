#!/usr/bin/env bash
#
# Deploy Trading System to GCP (Cloud Run + Cloud SQL)
# Usage: ./scripts/deploy-gcp.sh
#
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
PROJECT_ID="trade-490609"
REGION="asia-southeast1"
SQL_INSTANCE="trading-db"
DB_NAME="trading"
DB_USER="trading_user"
AR_REPO="trading-repo"
SERVICE_NAME="trading-api"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${SERVICE_NAME}"

echo "=== Trading System GCP Deployment ==="
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo ""

# ── Step 1: Set project ──────────────────────────────────────
echo "[1/7] Setting active project..."
gcloud config set project "${PROJECT_ID}"

# ── Step 2: Enable APIs ──────────────────────────────────────
echo "[2/7] Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT_ID}"

echo "      APIs enabled."

# ── Step 3: Create Artifact Registry repo ─────────────────────
echo "[3/7] Creating Artifact Registry repository..."
if gcloud artifacts repositories describe "${AR_REPO}" \
    --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "      Repository already exists."
else
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Trading system Docker images" \
    --project="${PROJECT_ID}"
  echo "      Repository created."
fi

# ── Step 4: Create Cloud SQL instance ────────────────────────
echo "[4/7] Creating Cloud SQL instance (this may take a few minutes)..."
if gcloud sql instances describe "${SQL_INSTANCE}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "      Instance already exists."
else
  gcloud sql instances create "${SQL_INSTANCE}" \
    --database-version=POSTGRES_16 \
    --edition=ENTERPRISE \
    --tier=db-f1-micro \
    --region="${REGION}" \
    --storage-type=HDD \
    --storage-size=10GB \
    --project="${PROJECT_ID}"
  echo "      Instance created."
fi

# ── Step 5: Create database and user ─────────────────────────
echo "[5/7] Setting up database and user..."

# Generate a random password
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

# Create database (ignore error if exists)
gcloud sql databases create "${DB_NAME}" \
  --instance="${SQL_INSTANCE}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "      Database '${DB_NAME}' already exists."

# Create user
gcloud sql users create "${DB_USER}" \
  --instance="${SQL_INSTANCE}" \
  --password="${DB_PASSWORD}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "      User '${DB_USER}' already exists."

# Store password in Secret Manager
echo "[5/7] Storing DB password in Secret Manager..."
if gcloud secrets describe db-password --project="${PROJECT_ID}" &>/dev/null; then
  echo -n "${DB_PASSWORD}" | gcloud secrets versions add db-password \
    --data-file=- --project="${PROJECT_ID}"
else
  echo -n "${DB_PASSWORD}" | gcloud secrets create db-password \
    --data-file=- --replication-policy=automatic --project="${PROJECT_ID}"
fi
echo "      Secret stored."

# ── Step 6: Grant Cloud Run access to secret ─────────────────
echo "[6/7] Granting IAM permissions..."
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="${PROJECT_ID}" --quiet

# Grant Cloud Build permission to deploy to Cloud Run
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin" --quiet

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" --quiet

echo "      IAM configured."

# ── Step 7: Build and deploy via Cloud Build ──────────────────
echo "[7/7] Triggering Cloud Build (build + deploy)..."
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA="$(date +%Y%m%d-%H%M%S)" \
  --project="${PROJECT_ID}" \
  --region="${REGION}"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "=== Deployment Complete ==="
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --format='value(status.url)' 2>/dev/null || echo "(run 'gcloud run services describe ${SERVICE_NAME} --region=${REGION}' to get URL)")

echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Next steps:"
echo "  1. Initialize the database:"
echo "     gcloud run jobs create init-db \\"
echo "       --image ${IMAGE}:latest \\"
echo "       --region ${REGION} \\"
echo "       --set-cloudsql-instances ${PROJECT_ID}:${REGION}:${SQL_INSTANCE} \\"
echo "       --set-env-vars INSTANCE_CONNECTION_NAME=${PROJECT_ID}:${REGION}:${SQL_INSTANCE},DB_USER=${DB_USER},DB_NAME=${DB_NAME},MT5_SIMULATION_MODE=true \\"
echo "       --set-secrets DB_PASSWORD=db-password:latest \\"
echo "       --command python,-m,app.db.init_db \\"
echo "       --project ${PROJECT_ID}"
echo "     gcloud run jobs execute init-db --region ${REGION} --project ${PROJECT_ID}"
echo ""
echo "  2. Verify deployment:"
echo "     curl ${SERVICE_URL}/docs"
echo "     curl ${SERVICE_URL}/api/system/health"
echo "     curl ${SERVICE_URL}/api/system/ping"
