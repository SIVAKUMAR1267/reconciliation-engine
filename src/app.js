const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const apiRoutes = require('./routes');

dotenv.config();
connectDB();
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);
app.use((err, req, res, next) => {
  console.error(`Unhandled Exception: ${err.stack}`);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Reconciliation Engine Server active on port ${PORT}`);
});

module.exports = app;