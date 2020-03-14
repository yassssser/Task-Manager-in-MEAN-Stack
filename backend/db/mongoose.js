// to enable the cnx between node and MongoDB

const mongoose = require('mongoose')

mongoose.Promise = global.Promise

mongoose.connect('mongodb://localhost:27017/TaskManager', { useNewUrlParser: true})
        .then(()=>{
            console.log("cnx okey")
        })
        .catch((e)=>{
            console.log(e)
        })

// To prevent deprectation warnings (from MongoDB native driver)
mongoose.set('useCreateIndex', true);
mongoose.set('useFindAndModify', false);

module.exports = {
    mongoose
};