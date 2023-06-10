const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access!!!" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access!!!" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vuuhbip.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const sportsCollection = client.db("sportsDB").collection("classes");
    const allClassesCollection = client.db("sportsDB").collection("allClasses");
    const selectedClassCollection = client
      .db("sportsDB")
      .collection("selectedClass");
    const usersCollection = client.db("sportsDB").collection("users");
    const instructorsCollection = client
      .db("sportsDB")
      .collection("instructor");
    
      app.post("/jwt", (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1d",
        });
        res.send(token);
      });

    // sports class related api
    app.get("/classes", async (req, res) => {
      const result = await sportsCollection
        .find()
        .sort({ students: -1 })
        .toArray();
      res.send(result);
    });

    // instructor related api
    app.get("/instructors", async (req, res) => {
      const result = await instructorsCollection
        .find()
        .sort({ Number_of_Courses: -1 })
        .toArray();
      res.send(result);
    });

    // allClasses related api
    app.get("/allClasses", async (req, res) => {
      const result = await allClassesCollection.find().toArray();
      res.send(result);
    });

    app.get("/selectedClass", async (req, res) => {
      const result = await selectedClassCollection.find().toArray();
      res.send(result);
    });

    app.post("/addToCarts", async (req, res) => {
      const classes = req.body;
      const result = await selectedClassCollection.insertOne(classes);
      res.send(result);
    });

    app.delete('/removeClasses/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    })

    // users related api
    app.get('/findUsers', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.post("/addUsers", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });


     
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("sports is running");
});

app.listen(port, (req, res) => {
  console.log(`sports is running on port: ${port}`);
});
