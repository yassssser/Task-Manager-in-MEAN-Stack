const express = require('express')
const app = express()

const jwt = require('jsonwebtoken')

const { mongoose } = require('./db/mongoose')

/*  import the Body Parse */
const bodyParse = require('body-parser')

/* load Midlleware */
app.use(bodyParse.json())

/* enable cors midlleware */
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id");

    res.header(
        'Access-Control-Expose-Headers',
        'x-access-token, x-refresh-token'
    );

    next();
});

/* Load the Mongoose Models */
const { List, Task, User } = require('./db/models')


/* Auth middleware */

// check whether the request has a valid JWT access token
let authenticate = (req, res, next) => {
    let token = req.header('x-access-token');

    // verify the JWT
    jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
        if (err) {
            // there was an error
            // jwt is invalid - * DO NOT AUTHENTICATE *
            res.status(401).send(err);
        } else {
            // jwt is valid
            req.user_id = decoded._id;
            next();
        }
    });
}



// Verify Refresh Token Middleware (which will be verifying the session)
let verifySession = (req, res, next) => {
    // grab the refresh token from the request header
    let refreshToken = req.header('x-refresh-token');

    // grab the _id from the request header
    let _id = req.header('_id');

    User.findByIdAndToken(_id, refreshToken).then((user) => {
        if (!user) {
            // user couldn't be found
            return Promise.reject({
                'error': 'User not found. Make sure that the refresh token and user id are correct'
            });
        }


        // if the code reaches here - the user was found
        // therefore the refresh token exists in the database - but we still have to check if it has expired or not

        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;

        let isSessionValid = false;

        user.sessions.forEach((session) => {
            if (session.token === refreshToken) {
                // check if the session has expired
                if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                    // refresh token has not expired
                    isSessionValid = true;
                }
            }
        });

        if (isSessionValid) {
            // the session is VALID - call next() to continue with processing this web request
            next();
        } else {
            // the session is not valid
            return Promise.reject({
                'error': 'Refresh token has expired or the session is invalid'
            })
        }

    }).catch((e) => {
        res.status(401).send(e);
    })
}

/* End Auth middleware */

/* Route Handler */

/**
 * Get /lists
 * Purpose: get all the lists
 */
app.get('/lists', authenticate, (req, res) => {
    // send the array of list
    List.find({
        _userId: req.user_id
    }).then((lists) => res.send(lists))
                 .catch((e) => res.send(e))
})


/**
 * Post /list
 * Purpose: create list
 */
app.post('/lists', authenticate, (req, res) => {
    // create a new list and return it with it's id
    let title = req.body.title

    let newList = new List({
        title,
        _userId: req.user_id
    })

    newList.save().then((listDoc) => {
        // the list will be returned with it's Id
        res.send(listDoc)
    })
    .catch((e) => res.send(e))
})

/**
 * Patch /lists/:id
 * Purpose: edit a specified list
 */
app.patch('/lists/:id', authenticate, (req, res) => {
    // update the list 
    List.findOneAndUpdate({ _id: req.params.id, _userId: req.user_id }, {
        $set: req.body
    }).then(() => {
        res.send({'message': 'updated successfully'})
    })
})


/**
 * Delete /lists/:id
 * Purpose: delete the list
 */
app.delete('/lists/:id', authenticate, (req, res) => {
    // deleting the list 
    List.findOneAndRemove({ _id: req.params.id, _userId: req.user_id})
        .then((removedListDoc) => {
         res.send(removedListDoc)

         // if we delete the list all tha task in that list will be deleted also
            deleteTaskFromList(removedListDoc._id)
    })
})

/**
 * Get /lists/:listId/tasks
 * Purpose: get all tasks from a specific list
 */
app.get('/lists/:listId/tasks', authenticate, (req, res) => {
    // it will return all tasks that belong to a specific list
    Task.find({
        _listId: req.params.listId
    }).then((tasks) => {
        res.send(tasks)
    })
})

/**
 * Post /lists/:listId/tasks
 * Purpose: create new task in a specified list
 */
app.post('/lists/:listId/tasks', authenticate, (req, res) => {

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if(list){
            return true
        }
        return false
    }).then((canCreateTask) => {
        if(canCreateTask){
            let newTask = new Task({
                title: req.body.title,
                _listId: req.params.listId
            });
            newTask.save().then((newTaskDoc) => {
                res.send(newTaskDoc);
            })
        } else {
            res.sendStatus(404)
        }
    })
})

/**
 * Patch /lists/:listId/tasks/:taskId
 * Purpose: update a task in specified list
 */
app.patch('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {
    
    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if(list){
            return true
        }
        return false
    }).then((canUpdateTask) => {
        if(canUpdateTask){
            Task.findOneAndUpdate({ 
                _id: req.params.taskId,
                _listId: req.params.listId
            },{
                $set: req.body
            }).then(() => {
                res.send({'message': 'updated successfully'})
            })
        }else {
            res.sendStatus(404)
        }
    })
})

/**
 * Delete lists/:listId/tasks/:taskId
 * Pusrpose: delete a task in specified list
 */
app.delete('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {
    
    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if(list){
            return true
        }
        return false
    }).then((canDeleteTask) => {
        if(canDeleteTask){
            Task.findOneAndRemove({
                _id: req.params.taskId,
                _listId: req.params.listId
            }).then((removedTaskDoc) => {
                res.send(removedTaskDoc)
           })
        }else {
            res.sendStatus(404)
        }
    })
})


/*  User Route */

/**
 * POST /users
 * Purpose: Sign up
 */
app.post('/users', (req, res) => {
    // User sign up

    let body = req.body;
    let newUser = new User(body);

    newUser.save().then(() => {
        return newUser.createSession();
    }).then((refreshToken) => {
        // Session created successfully - refreshToken returned.
        // now we geneate an access auth token for the user

        return newUser.generateAccessAuthToken().then((accessToken) => {
            // access auth token generated successfully, now we return an object containing the auth tokens
            return { accessToken, refreshToken }
        });
    }).then((authTokens) => {
        // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
        res
            .header('x-refresh-token', authTokens.refreshToken)
            .header('x-access-token', authTokens.accessToken)
            .send(newUser);
    }).catch((e) => {
        res.status(400).send(e);
    })
})


/**
 * POST /users/login
 * Purpose: Login
 */
app.post('/users/login', (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    User.findByCredentials(email, password).then((user) => {
        return user.createSession().then((refreshToken) => {
            // Session created successfully - refreshToken returned.
            // now we geneate an access auth token for the user

            return user.generateAccessAuthToken().then((accessToken) => {
                // access auth token generated successfully, now we return an object containing the auth tokens
                return { accessToken, refreshToken }
            });
        }).then((authTokens) => {
            // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
            res
                .header('x-refresh-token', authTokens.refreshToken)
                .header('x-access-token', authTokens.accessToken)
                .send(user);
        })
    }).catch((e) => {
        res.status(400).send(e);
    });
})

/**
 * GET /users/me/access-token
 * Purpose: generates and returns an access token
 */
app.get('/users/me/access-token', verifySession, (req, res) => {
    // we know that the user/caller is authenticated and we have the user_id and user object available to us
    req.userObject.generateAccessAuthToken().then((accessToken) => {
        res.header('x-access-token', accessToken).send({ accessToken });
    }).catch((e) => {
        res.status(400).send(e);
    });
})

/* Helper Methods */
let deleteTaskFromList = (_listId) => {
    Task.deleteMany({
        _listId
    }).then(() => {
        console.log("Tasks from "+ _listId + " were deleted")
    })
}

app.listen(3000, () => {
    console.log("the server is listening on port 3000")  
})
