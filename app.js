const express = require("express");
const sqlite3 = require("sqlite3");
const path = require("path");
const { open } = require("sqlite");
const { v4: uuid } = require('uuid');
const cors = require('cors')

const app = express();
app.use(express.json());
app.use(cors());
const dbPath = path.join(__dirname, "padhakku.db");
const port = process.env.PORT || 8008;
let db;

(async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        app.listen(port, () => {
            console.log("Server started at port: 8008");
        });
    } catch (error) {
        console.log(error.message);
    }
})();

// check wether email is valid or not using regular expression
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ADDITIONAL
// Get all the users 
app.get('/api/users', async (request, response) => {
    const getAllUsersQuery = `
        SELECT * FROM users;
    `
    try {
        const dbResp = await db.all(getAllUsersQuery)
        if (dbResp.length === 0) return response.status(400).send('No users found.')
        response.status(200).send(dbResp)
        response.setHeader("Access-Control-Allow-Credentials", true);
    } catch (error) {
        console.error('Error fetching users:', error);
        response.status(500).send('Internal server error.');
    }
})


// New user Sign-UP api - 1
app.post("/api/signup", async (request, response) => {
    const { name, email } = request.body;
    const userId = uuid() // unique string for every user 
    const isEmailValid = isValidEmail(email)

    try {
        const selectUserQuery = `SELECT * FROM users WHERE email = '${email}'`;
        const dbUser = await db.get(selectUserQuery);

        if (dbUser === undefined) {
            if (isEmailValid) {
                const createUserQuery = `
                    INSERT INTO 
                    users (name, email, userId) 
                    VALUES 
                    (
                        '${name.trim()}',
                        '${email.trim()}',
                        '${userId}'
                    )`;
                await db.run(createUserQuery);
                response.send('Successful user sign-up.');
            } else {
                response.status(400).send('Invalid email format.');
            }
        } else {
            response.status(400).send("Email already registered.");
        }
    } catch (error) {
        console.log('Error during user creation.')
        response.status(500).send('"Internal server error. Please try again later."')
    }
});


// Create new post api - 2
app.post('/api/posts', async (request, response) => {
    const { userId, content } = request.body
    const postId = uuid() // unique post id

    try {
        const getUserIdQuery = `SELECT userId FROM users WHERE userId = ?;`
        // userId of current logged-in user 
        const uniqueUserId = await db.get(getUserIdQuery, userId)

        // Failure response - 1
        if (!uniqueUserId) return response.status(404).send('User ID not found.')

        // Failure response - 2 
        if (!content) return response.status(400).send('Content cannot be empty.')

        const addNewPostQuery = `INSERT INTO
                                 posts (postId, content, userId)
                                 VALUES
                                 (
                                    '${postId}',
                                    '${content.trim()}',
                                    '${userId}'
                                 );`
        await db.run(addNewPostQuery)
        // Success response 
        response.send('Successfully created.')
    } catch (error) {
        console.log('Error during post creation.')
        response.status(500).send('"Internal server error. Please try again later."')
    }
})

// ADDITIONAL
// Get all the posts so far 
app.get('/api/posts', async (req, res) => {
    try {
        const dbResp = await db.all('SELECT * FROM posts;')
        if (dbResp.length === 0) return res.status(400).send('No posts found.')
        res.status(200).send(dbResp)
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).send('Internal server error.');
    }
})

// Delete post api - 3
app.delete('/api/deletepost/:postId', async (request, response) => {
    const { postId } = request.params

    // We can get this userId from currently logged-in user but here we can provide in the body for testing the API
    const { loggedInUserId } = request.body

    try {
        const getPostIdQuery = `SELECT postId, userId
                                FROM posts
                                WHERE postId = ?;`
        const postDetails = await db.get(getPostIdQuery, postId)

        // Failure response - 1 
        if (!postDetails) return response.status(404).send('Post ID not found.')

        const { userId: userIdOfPost, postId: deletingPostId } = postDetails

        // Failure response - 2 
        // user not authorized if userID of post is not same as logged-in user 
        if (loggedInUserId !== userIdOfPost) return response.status(403).send('Unauthorized to delete this post.')

        const deletePostQuery = `DELETE FROM posts WHERE postId = ?`;
        await db.run(deletePostQuery, deletingPostId);

        // Success response 
        response.send('Successful post deletion.')
    } catch (error) {
        console.error('Error deleting post:', error);
        response.status(500).send('Internal server error.');
    }
})

// Fetch user's posts - 4
app.get('/API/posts/:userId', async (request, response) => {
    const { userId } = request.params

    try {
        // check user exists? 
        const getUserQuery = `SELECT * FROM users WHERE userId = ?;`
        const user = await db.get(getUserQuery, userId)

        // Failure response - 1
        if (!user) return response.status(404).send('User ID not found.')

        // check if user has any posts 
        const getPostsQuery = `SELECT * FROM posts WHERE userId = ?;`
        const posts = await db.all(getPostsQuery, userId)

        // Failure response - 2 
        if (posts.length === 0) return response.status(404).send('No posts found for this user.')

        // Success response 
        response.send(posts)

    } catch (error) {
        console.error('Error Fetching posts:', error);
        response.status(500).send('Internal server error.');
    }
})
