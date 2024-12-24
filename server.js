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
        const userDailyStepsCollection = db.collection("userdailysteps");


        // Route to create a user
        app.post('/user-create', async (req, res) => {
            try {
                console.log('user-create route');
                const { name, email, clerkId } = req.body;
                console.log(req.body);


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
                console.log('update-bmi route');
                const { clerkId, age, weight, height } = req.body;

                // Validate required fields
                if (!clerkId || !age || !weight || !height) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                // Calculate BMI
                const bmi = (weight / ((height * 0.3048) ** 2)).toFixed(2);

                // Update or insert BMI field in the database
                const result = await usersCollection.updateOne(
                    { clerkId },
                    {
                        $set: { age, weight, height, bmi },
                    },
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
                console.log('daily-data route');
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
                console.log('daily-usage route');
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
                console.log('monthly-data route');
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
                console.log('update-goal route');
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
                console.log('update-gender route');
                const { clerkId, gender } = req.body;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const result = await usersCollection.updateOne(
                    { clerkId },
                    { $set: { gender } },
                    { upsert: true }
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
                console.log('favourite-ids route');
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
                console.log('user-details route');
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


        // API to update user data like the POST request with SQL

        app.get('/yearly-data', async (req, res) => {
            try {
                const { clerkId } = req.query;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing clerkId' });
                }

                const targetData = await dailyTargetCollection.find({
                    clerkId: clerkId,
                    created_at: { $gte: new Date(new Date() - 365 * 24 * 60 * 60 * 1000) } // past 365 days
                }).toArray();

                const averageSteps = targetData.reduce((acc, curr) => acc + curr.daily_steps, 0) / targetData.length;
                res.status(200).json({ data: targetData, averageSteps });
            } catch (error) {
                console.error('Error fetching yearly data:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.post('/user-update', async (req, res) => {
            try {
                const { field, value, clerkId } = req.body;

                if (!clerkId || !field || typeof value === 'undefined') {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                // Validate that the field is a valid column
                const allowedFields = ["name", "email", "gender", "weight", "height", "age"];
                if (!allowedFields.includes(field)) {
                    return res.status(400).json({ error: 'Invalid field' });
                }

                // Dynamically build the query using the validated field
                const updateResult = await usersCollection.updateOne(
                    { clerkId: clerkId },
                    { $set: { [field]: value } }
                );

                res.status(200).json({ data: updateResult });
            } catch (error) {
                console.error('Error updating user:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // API to set the user target steps like the PUT request with SQL
        app.put('/user-target-steps', async (req, res) => {
            try {
                console.log('user-target-steps route');
                const { clerkId, goal } = req.body;

                if (!clerkId || !goal) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const updateResult = await usersCollection.updateOne(
                    { clerkId: clerkId },
                    { $set: { targetSteps: goal } }
                );

                res.status(201).json({ data: updateResult });
            } catch (error) {
                console.error('Error setting user target steps:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // API to fetch user target steps (like the second GET request with SQL)
        app.get('/user-target-steps', async (req, res) => {
            try {
                console.log('user-target-steps route');
                const { clerkId } = req.query;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing clerkId' });
                }

                const targetSteps = await usersCollection.findOne({ clerkId: clerkId });

                if (!targetSteps) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.status(200).json(targetSteps);
            } catch (error) {
                console.error('Error fetching target steps:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.post('/current-steps', async (req, res) => {
            try {
                const { clerkId, steps, calories, date } = req.body;
        
                // Validate required fields
                if (!clerkId || steps === undefined || calories === undefined) {
                    return res.status(400).json({ message: 'Missing required fields' });
                }
        
                // Use current date and time if no date is provided
                const recordDate = date ? new Date(date) : new Date();
        
                // Insert record into the collection
                const result = await userDailyStepsCollection.insertOne({
                    clerkId,
                    steps,
                    calories,
                    kilometers,
                    date: recordDate,
                });
        
                res.status(201).json({
                    message: 'Steps and calories saved successfully',
                    data: result,
                });
            } catch (error) {
                console.error('Error saving steps:', error);
                res.status(500).json({ message: 'Internal Server Error', error: error.message });
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
