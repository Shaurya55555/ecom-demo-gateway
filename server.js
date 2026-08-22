const { ApolloServer, gql } = require('apollo-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { connectDb, Product, Order, Account } = require('./db');

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

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

const resolvers = {
  Product: { id: (p) => String(p._id) },
  Order: { id: (o) => String(o._id) },
  Account: { id: (a) => String(a._id), active: (a) => a.active !== false },

  Query: {
    getUsers: () => [],
    getUser: () => null,
    getProducts: async () => Product.find().exec(),
    getProduct: async (_, { id }) => (isValidId(id) ? await Product.findById(id).exec() : null),
    getOrders: async () => Order.find().exec(),
    getOrder: async (_, { id }) => (isValidId(id) ? await Order.findById(id).exec() : null),
    getSellerOrders: async (_, __, context) => {
      requireRole(context, ['seller']);
      const myProducts = await Product.find({ sellerId: context.userId }).select('_id').exec();
      const myProductIds = myProducts.map((p) => String(p._id));
      return Order.find({ productId: { $in: myProductIds } }).exec();
    },
    getAccounts: async (_, __, context) => {
      requireRole(context, ['admin']);
      return Account.find().exec();
    },
  },

  Mutation: {
    createUser: () => {
      throw new Error('Not supported in this demo');
    },
    createProduct: (_, { name, description, price }, context) => {
      requireRole(context, ['seller', 'admin']);
      return Product.create({ name, description, price, sellerId: context.userId });
    },
    createOrder: (_, { productId, userId, quantity }, context) => {
      requireRole(context, ['user']);
      return Order.create({ productId, userId, quantity, status: 'Pending' });
    },
    respondToOrder: async (_, { id, accept }, context) => {
      requireRole(context, ['seller', 'admin']);
      const order = await Order.findById(id);
      if (!order) throw new Error('Order not found');
      if (context.role === 'seller') {
        const product = await Product.findById(order.productId);
        if (!product || product.sellerId !== context.userId) {
          throw new Error('You can only respond to requests for your own products');
        }
      }
      order.status = accept ? 'Accepted' : 'Rejected';
      await order.save();
      return order;
    },
    register: async (_, { username, email, password, role }) => {
      if (role && !PUBLIC_ROLES.includes(role)) {
        throw new Error(`role must be one of: ${PUBLIC_ROLES.join(', ')}`);
      }
      const existing = await Account.findOne({ email });
      if (existing) throw new Error('Email already in use');
      const hashed = await bcrypt.hash(password, 10);
      const account = await Account.create({ username, email, password: hashed, role: role || 'user' });
      return { message: 'User registered successfully', userId: String(account._id) };
    },
    login: async (_, { email, password }) => {
      const account = await Account.findOne({ email });
      if (!account || !(await bcrypt.compare(password, account.password))) {
        throw new Error('Invalid credentials');
      }
      if (account.active === false) {
        throw new Error('This account has been disabled');
      }
      const token = jwt.sign(
        { userId: String(account._id), username: account.username, role: account.role || 'user' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      return {
        token,
        userId: String(account._id),
        username: account.username,
        email: account.email,
        role: account.role || 'user',
      };
    },
    setAccountActive: async (_, { userId, active }, context) => {
      requireRole(context, ['admin']);
      const account = await Account.findById(userId);
      if (!account) throw new Error('Account not found');
      if (account.role === 'admin') throw new Error('Cannot deactivate an admin account');
      account.active = active;
      await account.save();
      return account;
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
  const existing = await Account.findOne({ email });
  if (existing) return;
  const hashed = await bcrypt.hash(password, 10);
  await Account.create({
    username: process.env.ADMIN_USERNAME || 'admin',
    email,
    password: hashed,
    role: 'admin',
    active: true,
  });
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
connectDb()
  .then(ensureAdminSeeded)
  .then(() => server.listen({ port }))
  .then(({ url }) => {
    console.log(`Ecom demo GraphQL gateway ready at ${url}`);
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
