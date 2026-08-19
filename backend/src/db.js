import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('\n  MONGODB_URI is not set. Copy .env.example to .env and paste your connection string.\n');
    process.exit(1);
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('  mongo   connected to', mongoose.connection.name);
}
