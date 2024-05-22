const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');

// Configuration and Setup
const app = express();
const PORT = 3000;

// Handlebars Helpers
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            getUserById: function (users, userId) {
                if (Array.isArray(users)) {
                    return users.find(user => user.id === userId);
                }
                return null;
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

// Middleware
app.use(
    session({
        secret: 'oneringtorulethemall',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
    })
);

app.use((req, res, next) => {
    res.locals.appName = 'The Forum';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    const posts = getPosts();
    const user = getCurrentUser(req) || {};
    res.render('home', { posts, user, users });
});

app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

app.get('/error', (req, res) => {
    res.render('error');
});

app.post('/posts', (req, res) => {
    const { title, content } = req.body;
    const user = getCurrentUser(req);
    if (user) {
        addPost(title, content, user);
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

app.post('/like/:id', (req, res) => {
    updatePostLikes(req, res);
});

app.get('/profile', isAuthenticated, (req, res) => {
    renderProfile(req, res);
});

app.get('/avatar/:username', (req, res) => {
    handleAvatar(req, res);
});

app.post('/register', (req, res) => {
    registerUser(req, res);
});

app.post('/login', (req, res) => {
    loginUser(req, res);
});

app.get('/logout', (req, res) => {
    logoutUser(req, res);
});

app.post('/delete/:id', isAuthenticated, (req, res) => {
    const postId = parseInt(req.params.id);
    const user = getCurrentUser(req);
    const postIndex = posts.findIndex(post => post.id === postId && post.username === user.username);
    if (postIndex !== -1) {
        posts.splice(postIndex, 1);
        res.sendStatus(200);
    } else {
        res.sendStatus(403);
    }
});

// Server Activation
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Support Functions and Variables
let posts = [];
let users = [];

function findUserByUsername(username) {
    return users.find(user => user.username === username);
}

function findUserById(userId) {
    return users.find(user => user.id === userId);
}

function addUser(username) {
    const newUser = {
        id: users.length + 1,
        username,
        avatarColor: generateRandomColor(),
        memberSince: new Date().toISOString(),
    };
    users.push(newUser);
    return newUser;
}

function generateRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

function registerUser(req, res) {
    const { username } = req.body;
    if (findUserByUsername(username)) {
        res.redirect('/register?error=Username already exists');
    } else {
        const newUser = addUser(username);
        req.session.userId = newUser.id;
        req.session.loggedIn = true;
        res.redirect('/');
    }
}

function loginUser(req, res) {
    const { username } = req.body;
    const user = findUserByUsername(username);
    if (user) {
        req.session.userId = user.id;
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.redirect('/login?error=Invalid username');
    }
}

function logoutUser(req, res) {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
}

function renderProfile(req, res) {
    const user = getCurrentUser(req);
    if (user) {
        const userPosts = posts.filter(post => post.username === user.username);
        res.render('profile', { user, posts: userPosts });
    } else {
        res.redirect('/login');
    }
}

function updatePostLikes(req, res) {
    const postId = parseInt(req.params.id);
    const post = posts.find(post => post.id === postId);
    if (post && post.username !== req.session.username) {
        post.likes++;
        res.json({ success: true, likes: post.likes });
    } else {
        res.json({ success: false });
    }
}

function handleAvatar(req, res) {
    const { username } = req.params;
    const user = findUserByUsername(username);
    if (user) {
        const avatarBuffer = generateAvatar(user);
        res.contentType('image/png');
        res.send(avatarBuffer);
    } else {
        res.sendStatus(404);
    }
}

function getCurrentUser(req) {
    return findUserById(req.session.userId);
}

function getPosts() {
    return posts.slice().reverse();
}

function addPost(title, content, user) {
    const newPost = {
        id: posts.length + 1,
        title,
        content,
        username: user.username,
        timestamp: new Date().toISOString(),
        likes: 0,
    };
    posts.push(newPost);
}

function generateAvatar(user, width = 100, height = 100) {
    const canvas = require('canvas').createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = user.avatarColor;
    ctx.fillRect(0, 0, width, height);

    const letter = user.username.charAt(0).toUpperCase();
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, width / 2, height / 2);

    return canvas.toBuffer();
}