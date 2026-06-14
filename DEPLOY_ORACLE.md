# Oracle VM Deployment

This setup is the best fit for the current backend because it keeps the API, Redis, and prefetch worker running on one always-on machine.

## 1. Create the VM

- Create an Oracle Cloud Always Free Ubuntu VM.
- Open inbound ports `22` and `5001` in the Oracle security list / network security group.
- If you plan to use a domain with HTTPS later, also open `80` and `443`.

## 2. Install Docker

```bash
chmod +x scripts/install-docker-ubuntu.sh
./scripts/install-docker-ubuntu.sh
newgrp docker
```

## 3. Upload the project

```bash
git clone <your-repo-url>
cd manga
cp mangaApp-backend/.env.example mangaApp-backend/.env
```

Edit `mangaApp-backend/.env` if you want to change cache TTLs, CORS, or rate limits.

## 4. Start the stack

```bash
chmod +x scripts/deploy-backend.sh
./scripts/deploy-backend.sh
docker compose logs -f backend
```

## 5. Configure GitHub Actions CI/CD

The workflow in `.github/workflows/ci-cd.yml` runs app and backend checks for every pull request and push. A successful push to `main` deploys the backend automatically.

Add these repository secrets in GitHub under **Settings > Secrets and variables > Actions**:

| Secret | Value |
| --- | --- |
| `OCI_HOST` | The VM reserved public IP |
| `OCI_USER` | `ubuntu` |
| `OCI_SSH_PRIVATE_KEY` | A dedicated private deployment key |
| `OCI_KNOWN_HOSTS` | The VM's pinned SSH host-key line |

The deployment:

- uploads only Docker/backend files;
- keeps `mangaApp-backend/.env` on the VM;
- keeps the existing `manga_redis-data` Docker volume;
- builds before switching the running container;
- checks `/health` and rolls back the source if deployment fails.

You can also run it manually from the GitHub **Actions** tab using **Run workflow**.

## 6. Publish Android updates

The **Publish Android update** workflow creates a signed APK and publishes it through GitHub Releases. Add these repository secrets once:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded permanent Android signing keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Signing-key alias |
| `ANDROID_KEY_PASSWORD` | Signing-key password |
| `APP_AD_UNIT_BANNER` | Production banner ad unit |
| `APP_AD_UNIT_OPEN` | Production app-open ad unit |
| `APP_MANGA_URL` | Optional external manga URL |

To publish:

1. Open **Actions > Publish Android update > Run workflow**.
2. Enter a semantic version such as `1.1.0`.
3. Enter a `version_code` greater than every previous release.
4. Set `minimum_supported_version_code` to force older builds to update.
5. Add one release note per line.

The workflow uploads `mangafy.apk`, updates `/api/app-update`, and installed Android apps offer the download on their next launch. Android still asks the user to approve the APK installation.

Keep the signing keystore backed up permanently. Future APKs signed with a different key cannot update existing installations.

## 7. Verify it is healthy

```bash
curl http://127.0.0.1:5001/health
curl http://127.0.0.1:5001/api/manga/status/source
curl "http://127.0.0.1:5001/api/manga?page=1"
```

## 8. Point the mobile app to the server

Set your app backend URL to:

```text
http://YOUR_VM_PUBLIC_IP:5001
```

If you later add a domain and reverse proxy, switch the app to:

```text
https://api.yourdomain.com
```

## Notes

- Redis data is persisted in the Docker volume `redis-data`.
- The backend now exposes `GET /health`.
- The prefetch worker is enabled by default and can be disabled with `ENABLE_PREFETCH_WORKER=false`.
- For production browser clients, replace `CORS_ORIGIN=*` with a comma-separated allowlist.
