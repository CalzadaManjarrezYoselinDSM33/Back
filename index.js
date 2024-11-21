const cors = require('cors');
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(cors());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to MySQL database');
});
app.get('/api/movies', (req, res) => {
    const category = req.query.category; 
    
    let sql = 'SELECT id, title, price, category,price, image FROM movies';  
    if (category) {
        sql += ` WHERE category = ?`;  
    }

    db.query(sql, [category], (err, results) => {
        if (err) {
            console.error('Error fetching movies:', err);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
        res.json(results);  
    });
});


app.post('/api/users', (req, res) => {
  const { name, email, role } = req.body;

  const query = `INSERT INTO users (name, email, role) VALUES (?, ?, ?)`;
  db.query(query, [name, email, role], (err, result) => {
    if (err) {
      console.error('Error inserting data:', err);
      res.status(500).send('Error saving user');
    } else {
      res.status(201).send('User saved successfully');
    }
  });
});
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;

  const sql = 'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)';
  db.query(sql, [name, email, message], (err, result) => {
    if (err) {
      console.error('Error al insertar datos:', err);
      res.status(500).send('Error al guardar el mensaje.');
    } else {
      res.status(200).send('Mensaje guardado exitosamente.');
    }
  });
});

app.post('/login', (req, res) => {
    const { name, email } = req.body;
  
    const query = 'SELECT * FROM users WHERE name = ? AND email = ?';
    db.query(query, [name, email], (err, results) => {
      if (err) {
        console.error('Error querying database:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
      }
  
      if (results.length > 0) {
        const user = results[0];
        res.status(200).json({ message: 'User found', role: user.role }); 
      } else {
        res.status(404).json({ message: 'Invalid credentials' });
      }
    });
  });
  

  app.post('/api/movies', upload.single('image'), (req, res) => {
    const { title, description, genre, releaseDate, rating, category, price } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
    const query = `INSERT INTO movies (title, description, image, genre, releaseDate, rating, category, price) VALUES (?, ?, ?, ?, ?, ?,?,?)`;
    db.query(query, [title, description, imageUrl, genre, releaseDate, rating, category, price], (err, result) => {
      if (err) {
        console.error('Error inserting movie:', err);
        res.status(500).send('Error saving movie');
      } else {
        res.status(201).send('Movie saved successfully');
      }
    });
  });

app.get('/api/users/:email', (req, res) => {
    const { email } = req.params;
  
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], (err, results) => {
      if (err) {
        console.error('Error querying database:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
      }
  
      if (results.length > 0) {
        res.status(200).json(results[0]);
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    });
  }); 
app.get('/api/cart/:email', (req, res) => {
    const { email } = req.params;
  
    const queryUser = 'SELECT id FROM users WHERE email = ?';
    db.query(queryUser, [email], (err, results) => {
      if (err) {
        console.error('Error querying user:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
      }
  
      if (results.length > 0) {
        const userId = results[0].id;
  
        const queryCart = 'SELECT c.quantity, m.title, m.image FROM cart c JOIN movies m ON c.movie_id = m.id WHERE c.user_id = ?';
        db.query(queryCart, [userId], (err, cartItems) => {
          if (err) {
            console.error('Error querying cart:', err);
            return res.status(500).json({ message: 'Internal Server Error' });
          }
  
          res.status(200).json(cartItems);
        });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    });
  });
  
  app.post('/api/cart/:email', (req, res) => {
    const { email } = req.params;
    const { movieId, quantity } = req.body;
  
    const queryUser = 'SELECT id FROM users WHERE email = ?';
    db.query(queryUser, [email], (err, results) => {
      if (err) {
        console.error('Error querying user:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
      }
  
      if (results.length > 0) {
        const userId = results[0].id;
  
        const queryCartItem = 'SELECT * FROM cart WHERE user_id = ? AND movie_id = ?';
        db.query(queryCartItem, [userId, movieId], (err, cartItem) => {
          if (err) {
            console.error('Error querying cart item:', err);
            return res.status(500).json({ message: 'Internal Server Error' });
          }
  
          if (cartItem.length > 0) {
            const queryUpdateCart = 'UPDATE cart SET quantity = ? WHERE user_id = ? AND movie_id = ?';
            db.query(queryUpdateCart, [cartItem[0].quantity + quantity, userId, movieId], (err, result) => {
              if (err) {
                console.error('Error updating cart:', err);
                return res.status(500).json({ message: 'Internal Server Error' });
              }
  
              res.status(200).json({ message: 'Cart updated successfully' });
            });
          } else {
            const queryAddToCart = 'INSERT INTO cart (user_id, movie_id, quantity) VALUES (?, ?, ?)';
            db.query(queryAddToCart, [userId, movieId, quantity], (err, result) => {
              if (err) {
                console.error('Error adding to cart:', err);
                return res.status(500).json({ message: 'Internal Server Error' });
              }
  
              res.status(201).json({ message: 'Movie added to cart' });
            });
          }
        });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    });
  });
  
  app.delete('/api/cart/:email/:movieId', (req, res) => {
    const { email, movieId } = req.params;
  
    const queryUser = 'SELECT id FROM users WHERE email = ?';
    db.query(queryUser, [email], (err, results) => {
      if (err) {
        console.error('Error querying user:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
      }
  
      if (results.length > 0) {
        const userId = results[0].id;
  
        const queryDelete = 'DELETE FROM cart WHERE user_id = ? AND movie_id = ?';
        db.query(queryDelete, [userId, movieId], (err, result) => {
          if (err) {
            console.error('Error deleting from cart:', err);
            return res.status(500).json({ message: 'Internal Server Error' });
          }
  
          res.status(200).json({ message: 'Movie removed from cart' });
        });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    });
  });
  app.post('/api/generate-barcode', (req, res) => {
    const { email, amount } = req.body;
    if (!email || !amount) {
      return res.status(400).json({ message: 'Email y monto son requeridos.' });
    }
    bwipjs.toBuffer(
      {
        bcid: 'code128',
        text: `OXXO-${email}-${amount}`,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
      },
      (err, png) => {
        if (err) {
          console.error('Error generando el código de barras:', err);
          return res.status(500).json({ message: 'Error generando el código de barras.' });
        }
        const doc = new PDFDocument();
        const filePath = `barcode-${Date.now()}.pdf`;
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);
        doc.fontSize(20).text(`Paga ${amount} MXN en OXXO`, { align: 'center' });
        doc.image(png, { align: 'center', fit: [300, 150] });
        doc.end();
        writeStream.on('finish', () => {
          res.download(filePath, () => {
            fs.unlinkSync(filePath);
          });
        });
      }
    );
  });
  app.post('/create-order', (req, res) => {
    const { items, totalAmount } = req.body;
  
    console.log(`Total a cobrar: ${totalAmount}`);
  });
  
  
app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
