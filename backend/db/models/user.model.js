const mongoose = require('mongoose')
const _ = require('lodash')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

// Jwt Secret
const jwtSecret = "0377845650gdhgehbeufbuybsuboui"

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        minlength: 5,
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        minlength: 5
    },
    sessions: [{
        token: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Number,
            required: true
        }
    }]

})
 /* Instance methode */
UserSchema.methods.toJSON = function(){
    const user = this;
    const userObject = user.toObject();
    // return the doc except the password and the session
    return _.omit(userObject, ['password', 'sessions'])
}

UserSchema.methods.generateAccessAuthToken = function(){
    const user = this;
    return new Promise((resolve, reject) => {
        // create the Json Web Token 
        jwt.sign({_id: user._id.toHexString()}, jwtSecret, {expiresIn : "15m"}, (err, token) => {
            if(!err){
                resolve(token)
            } else {
                reject()
            }
        })
    })
}

UserSchema.methods.generateRefreshAuthToken = function(){
    // generate a 64byte hex string
    return new Promise((resolve, reject) => {
        crypto.randomBytes(64, (err, buf)=>{
            if(!err){
                let token = buf.toString('hex')
                return resolve(token)
            }
        })
    })
}

UserSchema.methods.createSession = function(){
    let user = this
    return user.generateRefreshAuthToken().then((refreshToken) => {
        return saveSessionToDatabase(user, refreshToken)
    }).then((refreshToken) => {
        return refreshToken
    }).catch((e) => {
        return Promise.reject('Failed to save session to the database :/ \n' +e)
    })
}

/* Model Static Methods */

UserSchema.statics.getJWTSecret = () => {
    return jwtSecret;
}

UserSchema.statics.findByIdAndToken = function(_id, token) {
    const User = this
    return User.findOne({
        _id,
        'sessions.token' : token
    })
}

UserSchema.statics.findByCredentials = function(email, password){
    let User = this

    return User.findOne({email}).then((user) => {
        if(!user)
            return Promise.reject()
        
            return new Promise((resolve, reject) => {
                bcrypt.compare(password, user.password, (err, res) => {
                    if(res){
                        resolve(user)
                    } else {
                        reject()
                    }
                })
            })
    })
}

UserSchema.statics.hasRefreshTokenExpired = (expiresAt) => {
    let secondsSinceEpoch = Date.now() / 1000
    if( expiresAt > secondsSinceEpoch){
        return false
    } else {
        return true
    }
}

/* Middlewere */
// this will run before user document is saved
UserSchema.pre('save', function(next){
    let user = this
    let coastFactor = 10

    if(user.isModified('password')){
        // generate salt and hash password
        bcrypt.genSalt(coastFactor, (err, salt) => {
            bcrypt.hash(user.password, salt, (err, hash) => {
                user.password = hash
                next()
            })
        })
    } else {
        next()
    }
}) 


/* Helper Methods */

let saveSessionToDatabase = (user, refreshToken) => {
    // save the session to database
    return new Promise((resolve, reject) => {
        let expiresAt = generateRefreshTokenExpiryTime()

        user.sessions.push({'token': refreshToken, expiresAt})

        user.save().then(() =>{
            return resolve(refreshToken)
        }).catch((e) => reject(e))
    })
}

let generateRefreshTokenExpiryTime = () => {
    let daysUntilExpire = "10"
    let secondsUntilExpire = ((daysUntilExpire * 24) * 60 ) * 60
    return ((Date.now() / 1000) + secondsUntilExpire)
}




const User = mongoose.model('User', UserSchema)

module.exports = { User }