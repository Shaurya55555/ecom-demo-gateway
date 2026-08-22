const { ApolloServer, gql } = require('apollo-server');
const { readDb, writeDb, newId } = require('./db');

const typeDefs = gql`
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Product {
    id: ID!
    name: String!
    description: String!
    price: Float!
  }

  type Order {
    id: ID!
    productId: ID!
    userId: ID!
    quantity: Int!
    status: String!
  }

  type Query {
    getUsers: [User]
    getUser(id: ID!): User
    getProducts: [Product]
    getProduct(id: ID!): Product
    getOrders: [Order]
    getOrder(id: ID!): Order
  }

  type Mutation {
    createUser(name: String!, email: String!): User
    createProduct(name: String!, description: String!, price: Float!): Product
    createOrder(productId: ID!, userId: ID!, quantity: Int!): Order
  }
`;

const resolvers = {
  Query: {
    getUsers: () => readDb().users,
    getUser: (_, { id }) => readDb().users.find((u) => u.id === id),
    getProducts: () => readDb().products,
    getProduct: (_, { id }) => readDb().products.find((p) => p.id === id),
    getOrders: () => readDb().orders,
    getOrder: (_, { id }) => readDb().orders.find((o) => o.id === id),
  },
  Mutation: {
    createUser: (_, { name, email }) => {
      const db = readDb();
      const user = { id: newId(), name, email };
      db.users.push(user);
      writeDb(db);
      return user;
    },
    createProduct: (_, { name, description, price }) => {
      const db = readDb();
      const product = { id: newId(), name, description, price };
      db.products.push(product);
      writeDb(db);
      return product;
    },
    createOrder: (_, { productId, userId, quantity }) => {
      const db = readDb();
      const order = { id: newId(), productId, userId, quantity, status: 'PENDING' };
      db.orders.push(order);
      writeDb(db);
      return order;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  cors: true,
});

const port = process.env.PORT || 4000;
server.listen({ port }).then(({ url }) => {
  console.log(`Ecom demo GraphQL gateway ready at ${url}`);
});
