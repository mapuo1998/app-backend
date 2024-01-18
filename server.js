const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = 'mongodb+srv://ma3346:D0wHzljdSXYao0ht@cluster0.bb6skif.mongodb.net/afterschool_app?retryWrites=true&w=majority';

app.use(express.json());
app.use(cors());

const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

async function startServer() {
  try {
    await client.connect();
    const db = client.db('afterschool_app');

    app.get('/', (req, res) => {
      res.send('Welcome to the After School App API');
    });

    app.get('/api/classes', async (req, res) => {
      try {
        const classes = await db.collection('classes').find().toArray();
        res.json(classes);
      } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.get('/api/search', async (req, res) => {
      const { searchFor } = req.query;
    
      try {
        // Use a case-insensitive regular expression for a partial match on title or location
        const searchRegex = new RegExp(searchFor, 'i');
        
        const classes = await db.collection('classes')
          .find({
            $or: [
              { title: { $regex: searchRegex } },
              { location: { $regex: searchRegex } },
            ]
          })
          .toArray();
    
        res.json(classes);
      } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.get('/api/orders', async (req, res) => {
      try {
        const orders = await db.collection('orders').find().toArray();
        res.json(orders);
      } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.post('/api/orders', async (req, res) => {
      try {
        const newOrder = req.body;

        console.log('Received Order:', newOrder);

        if (!newOrder.name || !newOrder.phone || !newOrder.cartItems || !Array.isArray(newOrder.cartItems)) {
          return res.status(400).json({ error: 'Inserted order data is missing or invalid' });
        }

        // Convert phone to integer
        newOrder.phone = parseInt(newOrder.phone);

        // Convert spaces to integers in each cart item
        newOrder.cartItems.forEach(item => {
          item.spaces = parseInt(item.spaces);
        });

        // Insert the order into the 'orders' collection
        const result = await db.collection('orders').insertOne({
          name: newOrder.name,
          phone: newOrder.phone,
          cartItems: newOrder.cartItems,
        });

        // Update the corresponding classes in the 'classes' collection
        for (const item of newOrder.cartItems) {
          const filter = { title: item.title };
          const update = { $inc: { spaces: item.spaces - 1 } };
          await db.collection('classes').updateOne(filter, update);
        }

        res.status(201).json({ message: 'Order created successfully' });
      } catch (error) {
        return res.status(500).json({ error: `Internal Server Error: ${error.message}` });
      }
    });

    app.put('/api/orders/:orderId', async (req, res) => {
      try {
        const orderId = req.params.orderId;
        const updatedOrder = req.body;

        console.log(`Received update for Order ${orderId}:`, updatedOrder);

        if (!updatedOrder.cartItems || !Array.isArray(updatedOrder.cartItems)) {
          return res.status(400).json({ error: 'Updated order data is missing or invalid' });
        }

        // Convert spaces to integers in each cart item
        updatedOrder.cartItems.forEach(item => {
          item.spaces = parseInt(item.spaces);
        });

        // Update the corresponding classes in the "classes" collection
        for (const item of updatedOrder.cartItems) {
          const filter = { title: item.title }; // Assuming there is a "title" field in your classes
          const update = { $inc: { spaces: -item.spaces } };
          await db.collection('classes').updateOne(filter, update);
        }

        // Update the order in the "orders" collection
        const result = await db.collection('orders').updateOne({ _id: orderId }, { $set: updatedOrder });

        // Handle the result if needed

        res.status(200).json({ message: `Order ${orderId} updated successfully` });
      } catch (error) {
        return res.status(500).json({ error: `Internal Server Error: ${error.message}` });
      }
    });

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

startServer();
