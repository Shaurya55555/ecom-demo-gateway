# ecom-demo-gateway

A live, single-service GraphQL demo backing the hosted showcase for
[`ecom-microservice-graphql`](https://github.com/Shaurya55555/ecom-microservice-graphql).

The real project splits users/products/orders across three Node/Express
microservices behind a GraphQL gateway, wired together with Kafka and
MongoDB (see the main repo's `docker-compose.yml`). Running that full stack
needs paid infra, so this demo exposes the **same GraphQL schema** the
gateway defines (`Query.getProducts`, `Mutation.createProduct`, etc.) from
one process with file-based storage, so the live demo page on GitHub Pages
has something real to query. Deployed on Render's free tier — data resets
periodically and the first request after idling can take ~30s to wake up.

## Run locally

```bash
npm install
npm start
```

Serves a GraphQL endpoint at `http://localhost:4000/`.
