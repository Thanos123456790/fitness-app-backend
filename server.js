const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

const uri = process.env.MONGO_URL;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();

        const db = client.db("fitness-server");
        const usersCollection = db.collection("users");
        const dailyTargetCollection = db.collection("dailytarget");
        const favouritesCollection = db.collection("favourites");

        // Route to create a user
        app.post('/user-create', async (req, res) => {
            try {
                const { name, email, clerkId } = req.body;

                // Validate required fields
                if (!name || !email || !clerkId) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                // Insert data into MongoDB
                const result = await usersCollection.insertOne({ name, email, clerkId });
                res.status(201).json({ message: 'User created successfully', data: result });
            } catch (error) {
                console.error('Error creating user:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Route to update BMI
        app.put('/update-bmi', async (req, res) => {
            try {
                const { clerkId, age, weight, height } = req.body;

                // Validate required fields
                if (!clerkId || !age || !weight || !height) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                // Calculate BMI
                const bmi = (weight / ((height / 100) ** 2)).toFixed(2);

                // Update or insert BMI field in the database
                const result = await usersCollection.updateOne(
                    { clerkId },
                    {
                        $set: { age, weight, height, bmi },
                    },
                    { upsert: true } // Insert document if it doesn't exist
                );

                res.status(200).json({ message: 'BMI updated successfully', data: result });
            } catch (error) {
                console.error('Error updating BMI:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Route to get daily data
        app.get('/daily-data', async (req, res) => {
            try {
                const { clerkId } = req.query;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing clerkId' });
                }

                const response = await dailyTargetCollection.find({ clerkId }).sort({ created_at: -1 }).limit(7).toArray();
                const averageSteps = response.reduce((acc, curr) => acc + (curr.dailySteps || 0), 0) / response.length;

                res.status(200).json({ data: response, averageSteps });
            } catch (error) {
                console.error('Error fetching daily data:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Route to insert daily usage data
        app.post('/daily-usage', async (req, res) => {
            try {
                const { clerkId, dailyUse, isDailyGoalAchieved, dailySteps } = req.body;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const result = await dailyTargetCollection.insertOne({
                    clerkId,
                    dailyUse,
                    isDailyGoalAchieved,
                    dailySteps,
                    created_at: new Date(),
                });

                res.status(201).json({ data: result });
            } catch (error) {
                console.error('Error inserting daily usage:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Routes to manage favourites
        app.post('/favourites', async (req, res) => {
            try {
                const { clerkId, recommendation_id } = req.body;

                if (!clerkId || !recommendation_id) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const result = await favouritesCollection.insertOne({ clerkId, favourite_id: recommendation_id });
                res.status(201).json({ data: result });
            } catch (error) {
                console.error('Error creating favourite:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.delete('/favourites', async (req, res) => {
            try {
                const { clerkId, recommendation_id } = req.body;

                if (!clerkId || !recommendation_id) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const result = await favouritesCollection.deleteOne({ clerkId, favourite_id: recommendation_id });
                res.status(200).json({ data: result });
            } catch (error) {
                console.error('Error deleting favourite:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.get('/favourites', async (req, res) => {
            try {
                const { clerkId } = req.query;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing clerkId' });
                }

                const favourites = await favouritesCollection.find({ clerkId }).toArray();
                res.status(200).json(favourites);
            } catch (error) {
                console.error('Error fetching favourites:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Route to get monthly data
        app.get('/monthly-data', async (req, res) => {
            try {
                const { clerkId } = req.query;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing clerkId' });
                }

                const response = await dailyTargetCollection.find({
                    clerkId,
                    created_at: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) },
                }).toArray();

                const averageSteps = response.reduce((acc, curr) => acc + (curr.dailySteps || 0), 0) / response.length;
                res.status(200).json({ data: response, averageSteps });
            } catch (error) {
                console.error('Error fetching monthly data:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Route to update user goal
        app.put('/update-goal', async (req, res) => {
            try {
                const { clerkId, goal } = req.body;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const result = await usersCollection.updateOne(
                    { clerkId },
                    { $set: { goal } }
                );
                res.status(201).json({ message: 'Goal updated successfully', data: result });
            } catch (error) {
                console.error('Error updating goal:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Route to update user gender
        app.put('/update-gender', async (req, res) => {
            try {
                const { clerkId, gender } = req.body;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const result = await usersCollection.updateOne(
                    { clerkId },
                    { $set: { gender } }
                );
                res.status(201).json({ message: 'Gender updated successfully', data: result });
            } catch (error) {
                console.error('Error updating gender:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Route to get favourite IDs
        app.post('/favourite-ids', async (req, res) => {
            try {
                const { clerkId } = req.body;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const response = await favouritesCollection.find({ clerkId }).project({ favourite_id: 1 }).toArray();
                res.status(201).json({ data: response });
            } catch (error) {
                console.error('Error fetching favourite IDs:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Route to get user details
        app.post('/user-details', async (req, res) => {
            try {
                const { clerkId } = req.body;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const response = await usersCollection.findOne({ clerkId });
                res.status(201).json({ data: response });
            } catch (error) {
                console.error('Error fetching user details:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        console.log("Connected to MongoDB successfully!");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

run().catch(console.error);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});