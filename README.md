# ecom-demo-gateway

A live, single-service GraphQL demo backing the hosted showcase for
[`ecom-microservice-graphql`](https://github.com/Shaurya55555/ecom-microservice-graphql).

The real project splits users/products/orders across three Node/Express
microservices behind a GraphQL gateway, wired together with Kafka and
MongoDB (see the main repo's `docker-compose.yml`). Running that full stack
needs paid infra, so this demo exposes the **same GraphQL schema** the
gateway defines — `getProducts`, `createProduct`, `register`, `login`,
`createOrder`, etc. — from one process with file-based storage instead of
Mongo/Kafka. Also backs the [`frontend/`](https://github.com/Shaurya55555/ecom-microservice-graphql/tree/main/frontend)
Next.js app when it's deployed against this gateway instead of a local
`docker-compose` stack.

`register`/`login` use bcrypt + a real signed JWT (set `JWT_SECRET` in
production — falls back to an insecure dev default otherwise), and
`createOrder` requires a valid bearer token, matching the auth added to the
real `user-service`/`order-service`. Deployed on Render's free tier — data
resets periodically and the first request after idling can take ~30s to
wake up.

## Run locally

```bash
npm install
npm start
```

Serves a GraphQL endpoint at `http://localhost:4000/`.
