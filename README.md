# Student Result & Leaderboard System

A full-stack web application that lets an administrator manage **students**, **examinations** and **results**, and shows an accurate **exam-wise leaderboard**.

| | |
|---|---|
| **Frontend** | React 18 + Vite + React Router |
| **Backend** | Node.js + Express |
| **Database** | MongoDB + Mongoose |
| **Auth** | JWT in an httpOnly, SameSite=Strict cookie; bcrypt password hashing |
| **Tests** | Jest + Supertest + mongodb-memory-server |
| **Production** | Ubuntu VPS, Nginx (reverse proxy + static hosting), PM2, Let's Encrypt HTTPS |

- **Live application:** `https://<your-subdomain>` <!-- fill in after deployment -->
- **Public leaderboard:** `https://<your-subdomain>/leaderboard/public`

---

## Table of contents

1. [Features](#1-features)
2. [Architecture](#2-architecture)
3. [Project structure](#3-project-structure)
4. [Data model](#4-data-model)
5. [Business rules](#5-business-rules)
6. [API reference](#6-api-reference)
7. [Local development](#7-local-development)
8. [Running tests](#8-running-tests)
9. [Environment variables](#9-environment-variables)
10. [Production deployment (VPS)](#10-production-deployment-vps)
11. [Operating the system](#11-operating-the-system)
12. [Troubleshooting](#12-troubleshooting)
13. [Security notes](#13-security-notes)

---

## 1. Features

**Administrator access**
- Secure login (bcrypt-hashed password, rate-limited login endpoint, httpOnly cookie session).
- Every create / update / delete endpoint requires an authenticated administrator.

**Students** – create, view, update, delete. Each student has a unique registration number, name, email, batch/session, department/course and `createdAt`/`updatedAt` timestamps. The list supports **search** (name, reg. no, email, batch, department) and **pagination**.

**Examinations** – create, view, update, delete. Each exam has a title, date, total marks, status (`upcoming` / `ongoing` / `completed`) and timestamps. Search by title and filter by status.

**Results** – create, view, update, delete. Each result belongs to exactly one valid student and one valid exam. Filter the list by student and/or exam, with pagination.

**Leaderboard** – choose an exam and see rank, registration number, name, marks obtained, total marks and percentage. It is calculated live from the results, so it is always correct after any change. A read-only public version is at `/leaderboard/public`.

**Dashboard** – total students, exams and results, plus recent exams and recent result activity.

**Frontend quality**
- Responsive layout. On phones the sidebar collapses and tables become stacked cards.
- Clear loading, empty, success (toast), validation-error, authorization-error and server-error states.
- Forms validate on the client and show field-level server errors. The submit button is disabled while a request is running, which prevents duplicate submissions.
- Page, search and filter values are kept in the URL, so refreshing or opening a deep link (for example `/results?exam=<id>`) works. Nginx's SPA fallback makes this work in production too.
- No hardcoded `localhost`: the app calls the relative path `/api` (Vite proxy in development, Nginx in production).

---

## 2. Architecture

```
 Browser ──HTTPS──▶ Nginx (443)
                     ├── /            → static React build (/var/www/srls), SPA fallback to index.html
                     └── /api/*       → proxy → Node/Express (127.0.0.1:5000, managed by PM2)
                                                   └── MongoDB (127.0.0.1:27017)
```

The frontend and API share one origin (the subdomain). This means:
- no CORS configuration is needed,
- the auth cookie can be `SameSite=Strict` + `Secure` + `httpOnly`,
- the frontend never needs to know a server address.

Backend layers: `routes` → `validate` (zod) → `controllers` → `models` (Mongoose). Errors are handled centrally in `middleware/errorHandler.js`.

---

## 3. Project structure

```
.
├── backend/
│   ├── src/
│   │   ├── app.js                 # Express app (middleware, routes, error handling)
│   │   ├── server.js              # Starts the server, connects DB, graceful shutdown
│   │   ├── config/                # env loading, MongoDB connection
│   │   ├── models/                # Admin, Student, Exam, Result (schemas + indexes)
│   │   ├── validators/schemas.js  # zod request schemas
│   │   ├── middleware/            # auth, validation, error handler
│   │   ├── controllers/           # request handlers per resource
│   │   ├── services/              # ranking rule + leaderboard builder
│   │   ├── routes/index.js        # all API routes
│   │   ├── utils/                 # ApiError, asyncHandler, pagination helpers
│   │   └── scripts/seedAdmin.js   # creates / resets the administrator account
│   ├── tests/                     # unit + integration tests
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/client.js          # fetch wrapper, error normalisation
│   │   ├── context/               # AuthContext, ToastContext
│   │   ├── hooks/                 # useFetch, useDebounce, useUrlState
│   │   ├── components/            # Layout, Modal, Pagination, pickers, state views
│   │   ├── pages/                 # Login, Dashboard, Students, Exams, Results, Leaderboard
│   │   └── styles.css
│   ├── .env.example
│   ├── vite.config.js
│   └── package.json
├── deploy/
│   ├── nginx.conf                 # Nginx site config template
│   ├── ecosystem.config.cjs       # PM2 process config
│   └── deploy.sh                  # one-command redeploy on the VPS
├── .github/workflows/ci.yml       # runs backend tests + frontend build on push
└── README.md
```

---

## 4. Data model

| Collection | Fields | Constraints / indexes |
|---|---|---|
| **admins** | name, email, passwordHash, timestamps | `email` unique; hash never returned (`select: false`) |
| **students** | registrationNo, name, email, batch, department, timestamps | `registrationNo` **unique** (stored uppercase, so `cse-01` = `CSE-01`); index on `createdAt`, `name` |
| **exams** | title, examDate, totalMarks (1–10000), status (`upcoming`\|`ongoing`\|`completed`), timestamps | index on `examDate`, `createdAt` |
| **results** | student → Student, exam → Exam, marksObtained (≥ 0), remarks, timestamps | **unique compound index `{student, exam}`**; index `{exam, marksObtained}` for the leaderboard; index on `updatedAt` for recent activity |

---

## 5. Business rules

### Result integrity
1. A result must reference an **existing** student and an **existing** exam. Otherwise the API returns `400` with field errors.
2. `0 ≤ marksObtained ≤ exam.totalMarks`. Otherwise the API returns `400`.
3. Only **one result per student per exam**. The API checks this first and returns a friendly `409`. The unique compound index also enforces it at database level, which covers two requests arriving at the same moment.

### Reference safety
- **Deleting a student** also deletes that student's results.
- **Deleting an exam** also deletes that exam's results.
- In both cases the results are deleted *before* the parent record. If the process stops halfway, you never get a result pointing at a missing student or exam. The UI warns about this before deleting.
- **Lowering an exam's total marks** below the highest recorded mark is rejected with `409`, so no existing result can fall out of range.

### Ranking rule (leaderboard)
**Standard competition ranking ("1-2-2-4")**
1. Results are sorted by marks obtained, highest first.
2. Students with **equal marks get the same rank**.
3. The next distinct score skips the positions taken by the tie. Example: marks `95, 90, 90, 80` give ranks `1, 2, 2, 4`.
4. Within a tie, rows are listed by registration number (A→Z). This only fixes the display order; it does not change the rank.

The rule lives in one pure function, `backend/src/services/ranking.js`, which has unit tests. The leaderboard is computed on every request from the current results and is never stored, so it cannot go stale.

---

## 6. API reference

Base path: `/api`. Every response has the shape `{ success, data?, meta?, message?, errors? }`.
`errors` is an object that maps field names to messages, e.g. `{ "email": "Enter a valid email" }`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | API + DB health |
| POST | `/auth/login` | – | `{ email, password }` → sets cookie |
| POST | `/auth/logout` | – | clears cookie |
| GET | `/auth/me` | ✔ | current admin |
| GET | `/dashboard` | ✔ | totals + recent exams/results |
| GET | `/students?page&limit&search` | ✔ | paginated list |
| POST | `/students` | ✔ | create |
| GET / PUT / DELETE | `/students/:id` | ✔ | read / update / delete (+ its results) |
| GET | `/exams?page&limit&search&status` | ✔ | paginated list |
| POST | `/exams` | ✔ | create |
| GET / PUT / DELETE | `/exams/:id` | ✔ | read / update / delete (+ its results) |
| GET | `/results?page&limit&student&exam` | ✔ | paginated list, filter by student/exam |
| POST | `/results` | ✔ | create |
| GET / PUT / DELETE | `/results/:id` | ✔ | read / update / delete |
| GET | `/leaderboard/exams` | – | exam list for the selector |
| GET | `/leaderboard/:examId` | – | ranked leaderboard |

Status codes: `200` OK · `201` created · `400` validation · `401` not logged in / session expired · `404` not found · `409` conflict (duplicate reg. no, duplicate result, total-marks conflict) · `429` too many login attempts · `500` generic error (stack traces are logged on the server, never sent to the client) · `503` database unavailable.

Example:
```bash
curl -c cookies.txt -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"..."}' https://<subdomain>/api/auth/login
curl -b cookies.txt "https://<subdomain>/api/students?search=rahim&page=1&limit=10"
```

---

## 7. Local development

### Prerequisites
- **Node.js 18+** (20 LTS recommended) and npm
- **MongoDB 6+** running locally, **or** a MongoDB Atlas connection string, **or** Docker:
  ```bash
  docker run -d --name srls-mongo -p 27017:27017 mongo:7
  ```

### 1. Clone
```bash
git clone https://github.com/<your-username>/<repo>.git
cd <repo>
```

### 2. Backend
```bash
cd backend
cp .env.example .env          # then edit .env (see section 9)
npm install
npm run seed:admin            # creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                   # API on http://localhost:5000  (check /api/health)
```

### 3. Frontend (new terminal)
```bash
cd frontend
cp .env.example .env          # defaults are fine
npm install
npm run dev                   # app on http://localhost:5173
```
Open http://localhost:5173 and log in with the admin credentials from `backend/.env`.
Vite forwards `/api` to `http://127.0.0.1:5000`, so no CORS setup is needed.

### Suggested first-run check
1. Create two examinations.
2. Create three students.
3. Add results, including two students with **equal marks** in the same exam.
4. Open the Leaderboard. The tied students share a rank and the next rank is skipped.
5. Try adding a duplicate result or marks above the total. You should see the validation errors.

---

## 8. Running tests

```bash
cd backend
npm test
```
- `tests/ranking.test.js` – unit tests for the ranking rule (ties, skipped ranks, percentage rounding).
- `tests/api.test.js` – integration tests on an in-memory MongoDB:
  - auth required / wrong password,
  - duplicate registration number, validation errors, search + pagination,
  - **duplicate result rejected**, **marks out of range rejected**, non-existent student rejected,
  - total-marks reduction conflict, cascade delete leaves no orphans,
  - **leaderboard correct after create, update and delete**,
  - invalid IDs / unknown routes return clean JSON with no stack traces.

> The first test run downloads a MongoDB binary (~100 MB) for `mongodb-memory-server`, so it needs internet once.

GitHub Actions (`.github/workflows/ci.yml`) runs the backend tests and the frontend build on every push to `main`.

---

## 9. Environment variables

### `backend/.env`
| Variable | Required | Example | Purpose |
|---|---|---|---|
| `NODE_ENV` | yes | `production` | Enables secure cookies and production logging |
| `PORT` | no | `5000` | API port (Nginx proxies to it) |
| `MONGODB_URI` | yes | `mongodb://srls_user:***@127.0.0.1:27017/srls?authSource=srls` | Database connection |
| `JWT_SECRET` | yes | 96-char random hex | Signs session tokens |
| `JWT_EXPIRES_IN` | no | `8h` | Session lifetime |
| `CORS_ORIGIN` | no | *(empty)* | Only if frontend is on a different origin |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | for seeding | – | Used only by `npm run seed:admin` |

Generate a secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### `frontend/.env`
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | API base path. Keep `/api` when Nginx serves both apps on one domain |
| `VITE_DEV_API_TARGET` | `http://127.0.0.1:5000` | Dev-server proxy target (development only) |

`.env` files are git-ignored. Only the `.env.example` files are committed.

---

## 10. Production deployment (VPS)

These steps were written for **Ubuntu 22.04/24.04**. Replace `YOUR_SUBDOMAIN` with the subdomain you were given (e.g. `srls.example.com`) and `<repo-url>` with your GitHub repository.

### 10.1 Point DNS
Make sure the subdomain's **A record** points to the VPS IP address:
```bash
dig +short YOUR_SUBDOMAIN     # must print the VPS IP
```

### 10.2 Connect and prepare the server
```bash
ssh <user>@<vps-ip>
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx ufw rsync
```

Firewall:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```
Port 5000 (API) and 27017 (MongoDB) stay **closed** to the internet. Only Nginx can reach them, via localhost.

### 10.3 Install Node.js 20 and PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v && npm -v
```

### 10.4 Install MongoDB 7 and enable it on boot
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod        # starts now AND after every reboot
sudo systemctl status mongod --no-pager
```
> If `lsb_release -cs` returns `noble` (24.04) and the repo is not found, replace it with `jammy`.

**Create a database user** (recommended):
```bash
mongosh
```
```js
use srls
db.createUser({ user: "srls_user", pwd: "A-STRONG-PASSWORD", roles: [{ role: "readWrite", db: "srls" }] })
exit
```
Then turn on authentication in `/etc/mongod.conf`:
```yaml
security:
  authorization: enabled
```
```bash
sudo systemctl restart mongod
```
MongoDB listens on `127.0.0.1` by default. Keep it that way.

### 10.5 Get the code and configure the backend
```bash
sudo mkdir -p /opt/srls && sudo chown $USER:$USER /opt/srls
git clone <repo-url> /opt/srls
cd /opt/srls/backend
cp .env.example .env
nano .env
```
Set at least:
```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://srls_user:A-STRONG-PASSWORD@127.0.0.1:27017/srls?authSource=srls
JWT_SECRET=<output of the crypto command in section 9>
ADMIN_EMAIL=<admin email>
ADMIN_PASSWORD=<strong admin password>
```
```bash
chmod 600 .env
npm ci --omit=dev
npm run seed:admin              # → "Administrator ready: ..."
```

### 10.6 Start the API with PM2 (survives crashes, logouts and reboots)
```bash
cd /opt/srls
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd             # prints a command – copy & run it (starts with "sudo env PATH=...")
pm2 save
curl http://127.0.0.1:5000/api/health    # → {"success":true,"status":"ok",...}
```
Because PM2 runs as a system service, the API keeps running after you close SSH and starts again after a reboot.

### 10.7 Build and publish the frontend
```bash
cd /opt/srls/frontend
npm ci
npm run build
sudo mkdir -p /var/www/srls
sudo rsync -a --delete dist/ /var/www/srls/
```

### 10.8 Configure Nginx
```bash
sudo cp /opt/srls/deploy/nginx.conf /etc/nginx/sites-available/srls
sudo sed -i 's/YOUR_SUBDOMAIN/your.subdomain.com/' /etc/nginx/sites-available/srls
sudo ln -s /etc/nginx/sites-available/srls /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 10.9 Enable HTTPS (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.subdomain.com --redirect -m you@example.com --agree-tos -n
sudo certbot renew --dry-run           # auto-renewal check
```
Certbot adds the 443 server block and redirects HTTP to HTTPS.

### 10.10 Verify
- `https://your.subdomain.com` → login page with a valid padlock
- Log in, create data, refresh on `/students?page=2`. It should stay on the same page (SPA fallback).
- `https://your.subdomain.com/api/health` → `{"status":"ok"}`
- **Restart test:** `sudo reboot`, wait a minute, then open the site again. MongoDB (systemd), the API (PM2) and Nginx all start on their own.

### 10.11 Redeploying after changes
```bash
cd /opt/srls
bash deploy/deploy.sh      # git pull → install → build → publish → pm2 reload → health check
```

---

## 11. Operating the system

| Task | Command |
|---|---|
| API status / logs | `pm2 status` · `pm2 logs srls-api` |
| Restart API | `pm2 restart srls-api` |
| Nginx logs | `sudo tail -f /var/log/nginx/error.log` |
| MongoDB status | `sudo systemctl status mongod` |
| Reset admin password | edit `ADMIN_PASSWORD` in `backend/.env`, then `npm run seed:admin` |
| Backup database | `mongodump --uri "$MONGODB_URI" --out ~/backup-$(date +%F)` |
| Restore database | `mongorestore --uri "$MONGODB_URI" ~/backup-YYYY-MM-DD` |

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Missing required environment variables` on start | `.env` missing or incomplete | `cp .env.example .env` and fill in `MONGODB_URI`, `JWT_SECRET` |
| `MongoServerSelectionError` / `ECONNREFUSED 127.0.0.1:27017` | MongoDB not running | `sudo systemctl start mongod` (or start the Docker container) |
| `Authentication failed` (Mongo) | Wrong user/password or missing `?authSource=srls` | Check `MONGODB_URI` |
| `/api/health` returns `503` | API up but DB disconnected | Check `mongod` status and logs: `sudo journalctl -u mongod` |
| **502 Bad Gateway** from Nginx | API not running or wrong port | `pm2 status`, `pm2 logs srls-api`; make sure `PORT` matches `proxy_pass` |
| Refreshing `/students` gives **404** | SPA fallback missing | Make sure the `try_files $uri $uri/ /index.html;` line is in the Nginx config |
| Login succeeds but next request is `401` | Cookie not stored: `NODE_ENV=production` over plain HTTP, or frontend on a different origin | Use HTTPS in production; serve frontend and API on the same domain (`VITE_API_BASE_URL=/api`) |
| `Too many login attempts` | Login rate limit (10 per 15 min per IP) | Wait 15 minutes, or `pm2 restart srls-api` |
| Frontend shows "Cannot reach the server" in dev | Backend not running on port 5000 | Start the backend, or set `VITE_DEV_API_TARGET` |
| Port 5000 already in use | Another process is using it | `sudo lsof -i :5000`, or change `PORT` (and the Nginx `proxy_pass`) |
| Tests hang at the start | `mongodb-memory-server` is downloading MongoDB | Wait for the first download; needs internet |
| Certbot fails | DNS not pointing to VPS, or port 80 blocked | `dig +short` your subdomain; `sudo ufw allow 'Nginx Full'` |
| Site down after reboot | PM2 startup not saved | Run `pm2 startup`, run the printed command, then `pm2 save` |

---

## 13. Security notes

- Passwords are hashed with **bcrypt** (cost 12) and never returned by the API.
- The session JWT is in an **httpOnly, Secure, SameSite=Strict** cookie. JavaScript cannot read it, and the browser does not send it on cross-site requests.
- Login is **rate-limited**. Wrong email and wrong password return the same error, so the API does not reveal which accounts exist.
- All input is validated with **zod**. Unknown fields are rejected, and search text is regex-escaped (no ReDoS or operator injection).
- **Helmet** security headers are set, `x-powered-by` is disabled, and the JSON body size is limited.
- Errors never include stack traces, queries or credentials. Full details go only to the server logs.
- Secrets live only in `.env` files on the server. `.gitignore` excludes `.env*` (except the examples), keys and certificates.
- MongoDB and the API listen only on localhost; the firewall opens only SSH, HTTP and HTTPS.
