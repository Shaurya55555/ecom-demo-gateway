const { ApolloServer, gql } = require('apollo-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDb, writeDb, newId } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'ecom-demo-insecure-dev-secret';

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

  type RegisterResult {
    message: String!
    userId: ID!
  }

  type AuthPayload {
    token: String!
    userId: ID!
    username: String!
    email: String!
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
    register(username: String!, email: String!, password: String!): RegisterResult
    login(email: String!, password: String!): AuthPayload
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
    createOrder: (_, { productId, userId, quantity }, context) => {
      if (!context.userId) {
        throw new Error('Missing or invalid bearer token');
      }
      const db = readDb();
      const order = { id: newId(), productId, userId, quantity, status: 'Pending' };
      db.orders.push(order);
      writeDb(db);
      return order;
    },
    register: async (_, { username, email, password }) => {
      const db = readDb();
      if (db.accounts?.some((a) => a.email === email)) {
        throw new Error('Email already in use');
      }
      const hashed = await bcrypt.hash(password, 10);
      const account = { id: newId(), username, email, password: hashed };
      db.accounts = db.accounts || [];
      db.accounts.push(account);
      writeDb(db);
      return { message: 'User registered successfully', userId: account.id };
    },
    login: async (_, { email, password }) => {
      const db = readDb();
      const account = (db.accounts || []).find((a) => a.email === email);
      if (!account || !(await bcrypt.compare(password, account.password))) {
        throw new Error('Invalid credentials');
      }
      const token = jwt.sign(
        { userId: account.id, username: account.username },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      return { token, userId: account.id, username: account.username, email: account.email };
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  cors: true,
  context: ({ req }) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return {};
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { userId: payload.userId, username: payload.username };
    } catch {
      return {};
    }
  },
});

const port = process.env.PORT || 4000;
server.listen({ port }).then(({ url }) => {
  console.log(`Ecom demo GraphQL gateway ready at ${url}`);
});
