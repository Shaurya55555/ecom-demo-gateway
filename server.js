const { ApolloServer, gql } = require('apollo-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDb, writeDb, newId } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'ecom-demo-insecure-dev-secret';
const PUBLIC_ROLES = ['user', 'seller'];

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
    sellerId: ID
  }

  type Order {
    id: ID!
    productId: ID!
    userId: ID!
    quantity: Int!
    status: String!
  }

  type Account {
    id: ID!
    username: String!
    email: String!
    role: String!
    active: Boolean!
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
    role: String!
  }

  type Query {
    getUsers: [User]
    getUser(id: ID!): User
    getProducts: [Product]
    getProduct(id: ID!): Product
    getOrders: [Order]
    getOrder(id: ID!): Order
    getSellerOrders: [Order]
    getAccounts: [Account]
  }

  type Mutation {
    createUser(name: String!, email: String!): User
    createProduct(name: String!, description: String!, price: Float!): Product
    createOrder(productId: ID!, userId: ID!, quantity: Int!): Order
    respondToOrder(id: ID!, accept: Boolean!): Order
    register(username: String!, email: String!, password: String!, role: String): RegisterResult
    login(email: String!, password: String!): AuthPayload
    setAccountActive(userId: ID!, active: Boolean!): Account
  }
`;

function requireRole(context, roles) {
  if (!context.userId) throw new Error('Missing or invalid bearer token');
  if (!roles.includes(context.role)) {
    throw new Error(`Requires role: ${roles.join(' or ')}`);
  }
}

function accountView(a) {
  return { id: a.id, username: a.username, email: a.email, role: a.role || 'user', active: a.active !== false };
}

const resolvers = {
  Query: {
    getUsers: () => readDb().users,
    getUser: (_, { id }) => readDb().users.find((u) => u.id === id),
    getProducts: () => readDb().products,
    getProduct: (_, { id }) => readDb().products.find((p) => p.id === id),
    getOrders: () => readDb().orders,
    getOrder: (_, { id }) => readDb().orders.find((o) => o.id === id),
    getSellerOrders: (_, __, context) => {
      requireRole(context, ['seller']);
      const db = readDb();
      const myProductIds = new Set(
        db.products.filter((p) => p.sellerId === context.userId).map((p) => p.id)
      );
      return db.orders.filter((o) => myProductIds.has(o.productId));
    },
    getAccounts: (_, __, context) => {
      requireRole(context, ['admin']);
      return readDb().accounts.map(accountView);
    },
  },
  Mutation: {
    createUser: (_, { name, email }) => {
      const db = readDb();
      const user = { id: newId(), name, email };
      db.users.push(user);
      writeDb(db);
      return user;
    },
    createProduct: (_, { name, description, price }, context) => {
      requireRole(context, ['seller', 'admin']);
      const db = readDb();
      const product = { id: newId(), name, description, price, sellerId: context.userId };
      db.products.push(product);
      writeDb(db);
      return product;
    },
    createOrder: (_, { productId, userId, quantity }, context) => {
      requireRole(context, ['user']);
      const db = readDb();
      const order = { id: newId(), productId, userId, quantity, status: 'Pending' };
      db.orders.push(order);
      writeDb(db);
      return order;
    },
    respondToOrder: (_, { id, accept }, context) => {
      requireRole(context, ['seller', 'admin']);
      const db = readDb();
      const order = db.orders.find((o) => o.id === id);
      if (!order) throw new Error('Order not found');
      if (context.role === 'seller') {
        const product = db.products.find((p) => p.id === order.productId);
        if (!product || product.sellerId !== context.userId) {
          throw new Error('You can only respond to requests for your own products');
        }
      }
      order.status = accept ? 'Accepted' : 'Rejected';
      writeDb(db);
      return order;
    },
    register: async (_, { username, email, password, role }) => {
      if (role && !PUBLIC_ROLES.includes(role)) {
        throw new Error(`role must be one of: ${PUBLIC_ROLES.join(', ')}`);
      }
      const db = readDb();
      if (db.accounts?.some((a) => a.email === email)) {
        throw new Error('Email already in use');
      }
      const hashed = await bcrypt.hash(password, 10);
      const account = { id: newId(), username, email, password: hashed, role: role || 'user', active: true };
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
      if (account.active === false) {
        throw new Error('This account has been disabled');
      }
      const token = jwt.sign(
        { userId: account.id, username: account.username, role: account.role || 'user' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      return {
        token,
        userId: account.id,
        username: account.username,
        email: account.email,
        role: account.role || 'user',
      };
    },
    setAccountActive: (_, { userId, active }, context) => {
      requireRole(context, ['admin']);
      const db = readDb();
      const account = db.accounts.find((a) => a.id === userId);
      if (!account) throw new Error('Account not found');
      if (account.role === 'admin') throw new Error('Cannot deactivate an admin account');
      account.active = active;
      writeDb(db);
      return accountView(account);
    },
  },
};

async function ensureAdminSeeded() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin account seeded.');
    return;
  }
  const db = readDb();
  db.accounts = db.accounts || [];
  if (db.accounts.some((a) => a.email === email)) return;
  const hashed = await bcrypt.hash(password, 10);
  db.accounts.push({
    id: newId(),
    username: process.env.ADMIN_USERNAME || 'admin',
    email,
    password: hashed,
    role: 'admin',
    active: true,
  });
  writeDb(db);
  console.log(`Seeded admin account for ${email}`);
}

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
      return { userId: payload.userId, username: payload.username, role: payload.role };
    } catch {
      return {};
    }
  },
});

const port = process.env.PORT || 4000;
ensureAdminSeeded().then(() => {
  server.listen({ port }).then(({ url }) => {
    console.log(`Ecom demo GraphQL gateway ready at ${url}`);
  });
});
