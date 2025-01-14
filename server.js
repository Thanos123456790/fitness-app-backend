const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
const uri = process.env.MONGO_URL;
if (!uri) {
    console.error("Error: MONGO_URL is not set in environment variables");
    process.exit(1);
}
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

// Main app logic
async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully!");

        const db = client.db("fitness-server");
        const usersCollection = db.collection("users");
        const dailyTargetCollection = db.collection("dailytarget");
        const favouritesCollection = db.collection("favourites");
        const userDailyStepsCollection = db.collection("userdailysteps");
        const adminCredentials = db.collection("adminCredentials");
        const exercisesCollection = db.collection("exercises");

        // Endpoint to validate email and password
        app.post('/', async ( req,res) => {
            try{
                console.log("Backend starting...");
                res.status(201).json({ message: 'Backend successfully' });
            }catch(error){
                console.log("backend not starting...");
                res.status(500).json({ message: 'Internal server error' });
            }
        })
        
        app.get("/fetch-excersies",async (req,res) => {
            try{
                const data = await exercisesCollection.find().toArray();
                if(data){
                    res.send(data);
                }else{
                    return res.status(401).json({
                    success: false,
                    message: "Unable to find excersies",
                });

                }
            }catch (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                });
            }
        })

        app.post("/validate-login", async (req, res) => {
            const { email, password } = req.body;
            try {
                const user = await adminCredentials.findOne({ admin_email: email });

                if (user) {
                    if (user.admin_password === password) {
                        return res.status(200).json({
                            success: true,
                            message: "Login successful",
                        });
                    } else {
                        return res.status(401).json({
                            success: false,
                            message: "Password mismatched",
                        });
                    }
                } else {
                    return res.status(404).json({
                        success: false,
                        message: "Email not found",
                    });
                }
            } catch (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                });
            }
        });

        app.get('/check-name/:email',async(req,res) => {
            const { email } = req.params;
            try{
                const verifyEmail = await adminCredentials.findOne({admin_email:email});
                if( verifyEmail ){
                    return res.json(verifyEmail);
                }
            }catch(error){
                console.error(error);
            }
        })
        app.post("/fetch-goal",async ( req,res) => {
            const {clerkId } = req.body;
            try{
                const user = await usersCollection.findOne({clerkId});
                if(user){
                    return res.json(user);
                }
                else{
                    return res.status(404).json({
                        success: false,
                        message: "credentials-mismatched",
                    });
                }

            }catch(error){
                console.error("Internal server error");
            }
        })

        // Endpoint to reset password
        app.put("/reset-password", async (req, res) => {
            const { email, oldPassword, newPassword } = req.body;

            try {
                if (oldPassword === newPassword) {
                    return res.status(400).json({
                        success: false,
                        message: "same-password",
                    });
                }

                const user = await adminCredentials.findOne({ admin_email: email });

                if (user && user.admin_password === oldPassword) {
                    await adminCredentials.updateOne(
                        { admin_email: email },
                        { $set: { admin_password: newPassword } }
                    );

                    return res.status(200).json({
                        success: true,
                        message: "Password updated successfully",
                    });
                } else {
                    return res.status(404).json({
                        success: false,
                        message: "credentials-mismatched",
                    });
                }
            } catch (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    message: "Internal server error",
                });
            }
        });

        app.post("/add-exercise", async (req, res) => {
            try {
                const exercise = req.body;
                await exercisesCollection.insertOne(exercise);
                res.status(200).send({ success: true, message: "Exercise added successfully" });
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: "Internal server error" });
            }
        });

        // Get All Users
        app.get("/users", async (req, res) => {
            try {
                const users = await usersCollection.find().toArray();
                res.json(users);
            } catch (error) {
                res.status(500).json({ message: "Error fetching users", error });
            }
        });

        // Delete User
        app.delete("/users/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const result = await usersCollection.deleteOne({ _id: id });
                if (result.deletedCount === 1) {
                    res.json({ message: "User deleted successfully" });
                } else {
                    res.status(404).json({ message: "User not found" });
                }
            } catch (error) {
                res.status(500).json({ message: "Error deleting user", error });
            }
        });

        // Analytics Data (Daily Entries)
        app.get("/analytics", async (req, res) => {
            try {
                const users = await usersCollection.aggregate([
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                ]).toArray();

                res.json(users);
            } catch (error) {
                res.status(500).json({ message: "Error fetching analytics", error });
            }
        });

        app.post("/admins", async (req, res) => {
            const { admin_name, admin_email, admin_password, god_access } = req.body;

            try {
                await adminCredentials.insertOne({
                    admin_name,
                    admin_email,
                    admin_password,
                    god_access,
                });
                res.status(201).json({ message: "Admin created successfully" });
            } catch (err) {
                res.status(400).send({ message: "Error creating admin", error: err.message });
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

        
        // Route to insert daily usage data
        app.post('/daily-usage', async (req, res) => {
            try {
                const { clerk_id, isDailyGoalAchieved, dailySteps ,totalKilometers,estimatedCalories} = req.body;

                if (!clerk_id) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }
                
                const result = await dailyTargetCollection.insertOne({
                    clerkId : clerk_id,
                    dailySteps,
                    estimatedCalories,
                    isDailyGoalAchieved,
                    totalKilometers,
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

        // Route to get daily data
        app.get('/daily-data', async (req, res) => {
            try {
                const { clerkId } = req.query;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing clerkId' });
                }

                const response = await dailyTargetCollection.find({
                    clerkId,
                    created_at: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) },
                }).toArray();
                const averageSteps = response.reduce((acc, curr) => acc + (curr.dailySteps || 0), 0) / response.length;

                res.status(200).json({ data: response, averageSteps });
            } catch (error) {
                console.error('Error fetching daily data:', error);
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


        app.get('/yearly-data', async (req, res) => {
            try {
                const { clerkId } = req.query;
        
                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing clerkId' });
                }
        
                const startDate = new Date(new Date().setDate(new Date().getDate() - 365));
                const targetData = await dailyTargetCollection.find({
                    clerkId: clerkId,
                    created_at: { $gte: startDate },
                }).toArray();
        
                const averageSteps = targetData.reduce((acc, curr) => acc + (curr.dailySteps || 0), 0) / targetData.length;
                res.status(200).json({ data: targetData, averageSteps });
            } catch (error) {
                console.error('Error fetching data for the last 365 days:', error);
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
                const { clerkId, gender,email,imageUrl } = req.body;

                if (!clerkId) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                const result = await usersCollection.updateOne(
                    { clerkId },
                    { $set: { gender,email,imageUrl,createdAt: new Date() } },
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

    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
}

run().catch(console.error);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
