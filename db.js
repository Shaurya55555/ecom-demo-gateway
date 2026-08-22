const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  sellerId: { type: String, default: null },
});

const orderSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    userId: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' },
  },
  { timestamps: true }
);

const accountSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'seller', 'admin'], default: 'user' },
  active: { type: Boolean, default: true },
});

const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Account = mongoose.model('Account', accountSchema);

const SEED_PRODUCTS = [
  { name: 'Wireless Mouse', description: 'Ergonomic 2.4GHz wireless mouse', price: 19.99, sellerId: null },
  { name: 'Mechanical Keyboard', description: 'Hot-swappable 75% mechanical keyboard', price: 89.5, sellerId: null },
  { name: 'USB-C Hub', description: '7-in-1 USB-C hub with HDMI and PD passthrough', price: 34.0, sellerId: null },
];

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany(SEED_PRODUCTS);
    console.log('Seeded initial products');
  }
}

module.exports = { connectDb, Product, Order, Account };
