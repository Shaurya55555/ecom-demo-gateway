# ecom-demo-gateway

A live, single-service GraphQL demo backing the hosted showcase for
[`ecom-microservice-graphql`](https://github.com/Shaurya55555/ecom-microservice-graphql).

The real project splits users/products/orders across three Node/Express
microservices behind a GraphQL gateway, wired together with Kafka and
MongoDB (see the main repo's `docker-compose.yml`). Running that full stack
needs paid infra, so this demo exposes the **same GraphQL schema** the
gateway defines — `getProducts`, `createProduct`, `register`, `login`,
`createOrder`, etc. — from one process, backed by MongoDB (via Mongoose)
instead of the three-service/Kafka setup. Also backs the
[`frontend/`](https://github.com/Shaurya55555/ecom-microservice-graphql/tree/main/frontend)
Next.js app when it's deployed against this gateway instead of a local
`docker-compose` stack.

`register`/`login` use bcrypt + a real signed JWT (set `JWT_SECRET` in
production — falls back to an insecure dev default otherwise), and
`createOrder`/`createProduct`/`respondToOrder` require a valid bearer token
with the right role, matching the auth added to the real
`user-service`/`product-service`/`order-service`. One admin account is
seeded at startup from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars (never
hardcoded — set these in your deployment platform's dashboard).

Deployed on Render's free tier — the first request after idling can take
~30s to wake up, but data now persists in MongoDB (a free Atlas cluster)
rather than resetting on every restart.

## Environment variables

- `MONGODB_URI` — MongoDB connection string (e.g. a free MongoDB Atlas
  cluster). Required.
- `JWT_SECRET` — secret used to sign JWTs. Falls back to an insecure dev
  default if unset; always set this in production.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — seeds one admin account at startup if
  it doesn't already exist. `ADMIN_USERNAME` is optional (defaults to
  `admin`).
- `PORT` — defaults to `4000`.

## Run locally

```bash
npm install
MONGODB_URI="mongodb://localhost:27017/ecom-demo" npm start
```

Serves a GraphQL endpoint at `http://localhost:4000/`.
