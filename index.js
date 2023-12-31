const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT","PATCH", "DELETE"],
};
app.use(cors(corsConfig));
// app.use(cors())
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
    const enrolledCollection = client.db("sportsDB").collection("enrolled");
    const selectedClassCollection = client
      .db("sportsDB")
      .collection("selectedClass");
    const usersCollection = client.db("sportsDB").collection("users");
    const instructorsCollection = client
      .db("sportsDB")
      .collection("instructor");
    const reviewCollection = client.db("sportsDB").collection("review");
    const categoryCollection = client.db("sportsDB").collection("sports");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send(token);
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access!" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access!" });
      }
      next();
    };

    // sports class related api
    app.get("/classes", async (req, res) => {
      const result = await sportsCollection
        .find()
        .sort({ students: -1 })
        .toArray();
      res.send(result);
    });

    app.get('/category', async (req, res) => {
      let query = {};
      if (req.query?.category) {
        query = { category: req.query.category };
      }
      const result = await categoryCollection.find(query).toArray();
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

    app.get("/getClasses/:email", verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await allClassesCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/updateClasses/:id", verifyJWT, verifyInstructor, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          name: body.name,
          price: body.price,
          available_set: body.available_set,
        },
      };
      const result = await allClassesCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // allClasses related api
    app.get("/getClasses", verifyJWT, async (req, res) => {
      const result = await allClassesCollection.find().toArray();
      res.send(result);
    });

    app.get("/allClasses", async (req, res) => {
      const query = { status: "approved" };
      const result = await allClassesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/createClasses", verifyJWT, verifyInstructor, async (req, res) => {
      const addClass = req.body;
      const result = await allClassesCollection.insertOne(addClass);
      res.send(result);
    });

    app.put("/sendFeedback/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          feedback: body.feedback,
        },
      };
      const result = await allClassesCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    app.patch("/approveClass/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: body.status,
        },
      };
      const result = await allClassesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // selected class related api
    app.get("/selectedClass", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.render([]);
      }
      if (email !== req.decoded.email) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access!" });
      }
      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/addToCarts", verifyJWT, async (req, res) => {
      const classes = req.body;
      const result = await selectedClassCollection.insertOne(classes);
      res.send(result);
    });

    app.delete("/removeClasses/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });

    // users related api
    app.get("/findUsers", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/userRole/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role });
    });

    app.post("/addUsers", verifyJWT, async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // make user role admin
    app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // make user role instructor
    app.patch("/users/instructor/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // review related api
    app.get('/reviews', async(req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })

    // payment intent
    app.post("/create_payment_intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // enrolled related api
    app.post("/enrolled", verifyJWT, async (req, res) => {
      const payment = req.body;
      const { itemId, _id } = payment;
      console.log(_id, itemId)
      const query = { _id: new ObjectId(_id) };
      const result = await enrolledCollection.insertOne(payment);
      if (result.insertedId) {
        const deleteResult = await selectedClassCollection.deleteOne(query);
       const increment = await allClassesCollection.updateOne(
          { itemId },
          {
            $inc: {
              enroll_count: 1,
              available_set: -1,
            },
          }
        );
        console.log(increment)
      }
      res.send(result);
    });


    app.get('/getEnrolledClasses',verifyJWT, async (req, res) => {
      const email = req.query.email;
       if (!email) {
         res.render([]);
       }
       if (email !== req.decoded.email) {
         return res
           .status(403)
           .send({ error: true, message: "forbidden access!" });
       }
      const query = { email: email }
      const result = await enrolledCollection.find(query).sort({date: -1}).toArray();
      res.send(result);
    })

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











